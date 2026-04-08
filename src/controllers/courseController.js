const db = require('../models');
const { handleError } = require('../utils/errorHandler');

// Добавьте эту функцию в начало файла, после require
function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

module.exports = {
    createCourse: async (req, res) => {
        const transaction = await db.sequelize.transaction();
        
        try {
            const { title, cover_image } = req.body;
            
            if (!title) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Название курса обязательно'
                });
            }

            // Генерируем уникальный join_code
            let joinCode = generateJoinCode();
            let isUnique = false;
            let attempts = 0;
            
            while (!isUnique && attempts < 10) {
                const existing = await db.Course.findOne({ 
                    where: { join_code: joinCode },
                    transaction
                });
                if (!existing) {
                    isUnique = true;
                } else {
                    joinCode = generateJoinCode();
                    attempts++;
                }
            }

            const course = await db.Course.create({
                title,
                cover_image,
                teacher_id: req.user.id,
                status: 'draft',
                join_code: joinCode
            }, { transaction });

            await transaction.commit();

            res.status(201).json({
                success: true,
                message: 'Курс успешно создан',
                course: {
                    id: course.id,
                    title: course.title,
                    cover_image: course.cover_image,
                    status: course.status,
                    join_code: course.join_code  // ← УБЕДИТЕСЬ, ЧТО ЭТА СТРОКА ЕСТЬ
                }
            });

        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Ошибка при создании курса');
        }
    },

    getTeacherCourses: async (req, res) => {
        try {
            const courses = await db.Course.findAll({
                where: { teacher_id: req.user.id },
                order: [['created_at', 'DESC']],
                include: [
                    {
                        model: db.Theme,
                        as: 'themes',
                        include: [{ model: db.Block, as: 'blocks' }]
                    }
                ]
            });

            res.json({ success: true, courses });
        } catch (error) {
            handleError(res, error, 'Ошибка при получении курсов');
        }
    },

   getCourseById: async (req, res) => {
        try {
            const course = await db.Course.findByPk(req.params.id, {
                include: [
                    {
                        model: db.Theme,
                        as: 'themes',
                        include: [{ model: db.Block, as: 'blocks' }]
                    },
                    {
                        model: db.User,
                        as: 'teacher',
                        attributes: ['id', 'first_name', 'last_name', 'patronymic']
                    }
                ]
            });

            if (!course) {
                return res.status(404).json({
                    success: false,
                    message: 'Курс не найден'
                });
            }

            // Для студентов: проверяем, подключен ли он к курсу
            if (req.user.role === 'student') {
                const isEnrolled = await db.CourseStudent.findOne({
                    where: {
                        course_id: course.id,
                        student_id: req.user.id
                    }
                });
                
                if (!isEnrolled) {
                    return res.status(403).json({
                        success: false,
                        message: 'Вы не подключены к этому курсу'
                    });
                }
            } else if (course.teacher_id !== req.user.id && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Нет доступа к этому курсу'
                });
            }

            // Возвращаем курс с join_code
            res.json({ 
                success: true, 
                course: {
                    id: course.id,
                    title: course.title,
                    cover_image: course.cover_image,
                    status: course.status,
                    join_code: course.join_code,  // ← ДОБАВЬТЕ ЭТУ СТРОКУ
                    teacher_id: course.teacher_id,
                    students_count: course.students_count,
                    themes: course.themes,
                    teacher: course.teacher
                }
            });
        } catch (error) {
            handleError(res, error, 'Ошибка при получении курса');
        }
    },

    // ИСПРАВЛЕННАЯ ВЕРСИЯ - НЕ УДАЛЯЕТ ТЕМЫ!
    updateCourse: async (req, res) => {
        const transaction = await db.sequelize.transaction();
        
        try {
            const course = await db.Course.findByPk(req.params.id);
            
            if (!course) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Курс не найден'
                });
            }

            if (course.teacher_id !== req.user.id) {
                await transaction.rollback();
                return res.status(403).json({
                    success: false,
                    message: 'Нет прав на редактирование этого курса'
                });
            }

            const { title, cover_image, status, themes } = req.body;

            // Обновляем основную информацию курса
            await course.update({
                title: title || course.title,
                cover_image: cover_image !== undefined ? cover_image : course.cover_image,
                status: status || course.status
            }, { transaction });

            if (themes && Array.isArray(themes)) {
                // Получаем существующие темы (НЕ УДАЛЯЕМ!)
                const existingThemes = await db.Theme.findAll({
                    where: { course_id: course.id },
                    transaction
                });
                
                const existingThemesMap = new Map();
                existingThemes.forEach(theme => {
                    existingThemesMap.set(theme.id, theme);
                });

                const newThemeIds = [];

                // Обрабатываем каждую тему
                for (let themeIndex = 0; themeIndex < themes.length; themeIndex++) {
                    const themeData = themes[themeIndex];
                    let theme;

                    if (themeData.id && existingThemesMap.has(themeData.id)) {
                        // Обновляем существующую тему
                        theme = existingThemesMap.get(themeData.id);
                        await theme.update({
                            title: themeData.title,
                            order_index: themeIndex
                        }, { transaction });
                    } else {
                        // Создаем новую тему
                        theme = await db.Theme.create({
                            title: themeData.title,
                            course_id: course.id,
                            order_index: themeIndex
                        }, { transaction });
                    }
                    
                    newThemeIds.push(theme.id);

                    // Получаем существующие блоки в этой теме
                    const existingBlocks = await db.Block.findAll({
                        where: { theme_id: theme.id },
                        transaction
                    });
                    
                    const existingBlocksMap = new Map();
                    existingBlocks.forEach(block => {
                        existingBlocksMap.set(block.id, block);
                    });

                    const newBlockIds = [];

                    // Обрабатываем блоки
                    if (themeData.blocks && Array.isArray(themeData.blocks)) {
                        for (let blockIndex = 0; blockIndex < themeData.blocks.length; blockIndex++) {
                            const blockData = themeData.blocks[blockIndex];
                            let block;

                            if (blockData.id && existingBlocksMap.has(blockData.id)) {
                                // Обновляем существующий блок
                                block = existingBlocksMap.get(blockData.id);
                                await block.update({
                                    title: blockData.title || 'Новый блок',
                                    description: blockData.description || '',
                                    order_index: blockIndex,
                                    type: 'text'
                                }, { transaction });
                            } else {
                                // Создаем новый блок
                                block = await db.Block.create({
                                    title: blockData.title || 'Новый блок',
                                    description: blockData.description || '',
                                    theme_id: theme.id,
                                    order_index: blockIndex,
                                    type: 'text'
                                }, { transaction });
                            }
                            
                            newBlockIds.push(block.id);
                        }
                    }

                    // Удаляем только те блоки, которых больше нет
                    for (const oldBlock of existingBlocks) {
                        if (!newBlockIds.includes(oldBlock.id)) {
                            await db.Section.destroy({ 
                                where: { block_id: oldBlock.id }, 
                                transaction 
                            });
                            await oldBlock.destroy({ transaction });
                        }
                    }
                }

                // Удаляем только те темы, которых больше нет
                for (const oldTheme of existingThemes) {
                    if (!newThemeIds.includes(oldTheme.id)) {
                        const blocksToDelete = await db.Block.findAll({
                            where: { theme_id: oldTheme.id },
                            transaction
                        });
                        for (const block of blocksToDelete) {
                            await db.Section.destroy({ 
                                where: { block_id: block.id }, 
                                transaction 
                            });
                            await block.destroy({ transaction });
                        }
                        await oldTheme.destroy({ transaction });
                    }
                }
            }

            await transaction.commit();

            // Получаем обновленный курс
            const updatedCourse = await db.Course.findByPk(course.id, {
                include: [
                    {
                        model: db.Theme,
                        as: 'themes',
                        include: [{ model: db.Block, as: 'blocks' }]
                    }
                ]
            });

            res.json({
                success: true,
                message: 'Курс успешно обновлен',
                course: {
                    id: updatedCourse.id,
                    title: updatedCourse.title,
                    cover_image: updatedCourse.cover_image,
                    status: updatedCourse.status,
                    join_code: updatedCourse.join_code,  // ← ДОБАВЬТЕ ЭТУ СТРОКУ
                    themes: updatedCourse.themes
                }
            });

        } catch (error) {
            await transaction.rollback();
            console.error('Ошибка при обновлении курса:', error);
            handleError(res, error, 'Ошибка при обновлении курса');
        }
    },

    uploadCourseImage: async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Файл не загружен'
                });
            }

            const imageUrl = `/public/uploads/courses/${req.file.filename}`;

            res.json({
                success: true,
                message: 'Изображение успешно загружено',
                imageUrl: imageUrl
            });
        } catch (error) {
            handleError(res, error, 'Ошибка при загрузке изображения');
        }
    },

    // Получение курса по join_code (публичный)
    getCourseByJoinCode: async (req, res) => {
        try {
            const { joinCode } = req.params;
            
            const course = await db.Course.findOne({
                where: { join_code: joinCode },
                attributes: ['id', 'title', 'cover_image', 'teacher_id', 'status']
            });
            
            if (!course) {
                return res.status(404).json({
                    success: false,
                    message: 'Курс не найден'
                });
            }
            
            if (course.status !== 'published') {
                return res.status(403).json({
                    success: false,
                    message: 'Курс еще не опубликован'
                });
            }
            
            res.json({ success: true, course });
        } catch (error) {
            handleError(res, error, 'Ошибка при поиске курса');
        }
    },

    // Подключение студента к курсу по коду
    joinCourseByCode: async (req, res) => {
        const transaction = await db.sequelize.transaction();
        
        try {
            const { joinCode } = req.body;
            const studentId = req.user.id;
            
            const course = await db.Course.findOne({
                where: { join_code: joinCode }
            });
            
            if (!course) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Курс не найден'
                });
            }
            
            if (course.teacher_id === studentId) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Вы являетесь преподавателем этого курса'
                });
            }
            
            const existing = await db.CourseStudent.findOne({
                where: {
                    course_id: course.id,
                    student_id: studentId
                }
            });
            
            if (existing) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Вы уже подключены к этому курсу'
                });
            }
            
            await db.CourseStudent.create({
                course_id: course.id,
                student_id: studentId,
                status: 'active'
            }, { transaction });
            
            await course.increment('students_count', { transaction });
            
            await transaction.commit();
            
            res.json({
                success: true,
                message: 'Вы успешно подключились к курсу',
                course: {
                    id: course.id,
                    title: course.title,
                    cover_image: course.cover_image
                }
            });
            
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Ошибка при подключении к курсу');
        }
    },

    // Получение всех курсов студента
    getStudentCourses: async (req, res) => {
        try {
            const studentId = req.user.id;
            
            const courses = await db.Course.findAll({
                include: [
                    {
                        model: db.User,
                        as: 'students',
                        where: { id: studentId },
                        through: { attributes: [] },
                        required: true
                    },
                    {
                        model: db.Theme,
                        as: 'themes',
                        include: [{ model: db.Block, as: 'blocks' }]
                    },
                    {
                        model: db.User,
                        as: 'teacher',
                        attributes: ['id', 'first_name', 'last_name', 'patronymic']
                    }
                ],
                order: [['created_at', 'DESC']]
            });
            
            res.json({ success: true, courses });
        } catch (error) {
            handleError(res, error, 'Ошибка при получении курсов студента');
        }
    }
};