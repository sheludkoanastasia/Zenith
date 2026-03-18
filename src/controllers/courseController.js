const db = require('../models');
const { handleError } = require('../utils/errorHandler');

module.exports = {
    // Создание нового курса (пока без тем и блоков)
    createCourse: async (req, res) => {
        try {
            const { title, cover_image } = req.body; // Убрали description
            
            if (!title) {
                return res.status(400).json({
                    success: false,
                    message: 'Название курса обязательно'
                });
            }

            const course = await db.Course.create({
                title,
                // description удалено
                cover_image,
                teacher_id: req.user.id,
                status: 'draft'
            });

            res.status(201).json({
                success: true,
                message: 'Курс успешно создан',
                course: {
                    id: course.id,
                    title: course.title,
                    cover_image: course.cover_image,
                    status: course.status
                }
            });

        } catch (error) {
            handleError(res, error, 'Ошибка при создании курса');
        }
    },

    // Получение всех курсов преподавателя
    getTeacherCourses: async (req, res) => {
        try {
            const courses = await db.Course.findAll({
                where: { teacher_id: req.user.id },
                order: [['created_at', 'DESC']],
                include: [
                    {
                        model: db.Theme,
                        as: 'themes',
                        include: [
                            {
                                model: db.Block,
                                as: 'blocks'
                            }
                        ]
                    }
                ]
            });

            res.json({
                success: true,
                courses
            });

        } catch (error) {
            handleError(res, error, 'Ошибка при получении курсов');
        }
    },

    // Получение курса по ID
    getCourseById: async (req, res) => {
        try {
            const course = await db.Course.findByPk(req.params.id, {
                include: [
                    {
                        model: db.Theme,
                        as: 'themes',
                        include: [
                            {
                                model: db.Block,
                                as: 'blocks'
                            }
                        ]
                    }
                ]
            });

            if (!course) {
                return res.status(404).json({
                    success: false,
                    message: 'Курс не найден'
                });
            }

            // Проверяем права доступа
            if (course.teacher_id !== req.user.id && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Нет доступа к этому курсу'
                });
            }

            res.json({
                success: true,
                course
            });

        } catch (error) {
            handleError(res, error, 'Ошибка при получении курса');
        }
    },

    // Обновление курса (включая темы и блоки)
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

            // Проверяем, что это преподаватель этого курса
            if (course.teacher_id !== req.user.id) {
                await transaction.rollback();
                return res.status(403).json({
                    success: false,
                    message: 'Нет прав на редактирование этого курса'
                });
            }

            const { title, cover_image, status, themes } = req.body; // Убрали description

            // Обновляем основную информацию курса
            await course.update({
                title: title || course.title,
                cover_image: cover_image !== undefined ? cover_image : course.cover_image,
                status: status || course.status
                // description удалено
            }, { transaction });

            // Если переданы темы, обновляем структуру курса
            if (themes && Array.isArray(themes)) {
                // Удаляем старые темы и блоки
                await db.Theme.destroy({
                    where: { course_id: course.id },
                    transaction
                });

                // Создаем новые темы и блоки
                for (let themeIndex = 0; themeIndex < themes.length; themeIndex++) {
                    const themeData = themes[themeIndex];
                    
                    const theme = await db.Theme.create({
                        title: themeData.title,
                        course_id: course.id,
                        order_index: themeIndex
                    }, { transaction });

                    // Создаем блоки для темы
                    if (themeData.blocks && Array.isArray(themeData.blocks)) {
                        for (let blockIndex = 0; blockIndex < themeData.blocks.length; blockIndex++) {
                            const blockData = themeData.blocks[blockIndex];
                            
                            await db.Block.create({
                                title: blockData.title || 'Новый блок',
                                description: blockData.description || '',
                                theme_id: theme.id,
                                order_index: blockIndex,
                                type: 'text' // Пока только текстовые блоки
                            }, { transaction });
                        }
                    }
                }
            }

            await transaction.commit();

            // Получаем обновленный курс со всеми связями
            const updatedCourse = await db.Course.findByPk(course.id, {
                include: [
                    {
                        model: db.Theme,
                        as: 'themes',
                        include: [
                            {
                                model: db.Block,
                                as: 'blocks'
                            }
                        ]
                    }
                ]
            });

            res.json({
                success: true,
                message: 'Курс успешно обновлен',
                course: updatedCourse
            });

        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Ошибка при обновлении курса');
        }
    },

    // Загрузка изображения курса (НОВЫЙ МЕТОД)
    uploadCourseImage: async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Файл не загружен'
                });
            }

            // Формируем URL для доступа к изображению
            const imageUrl = `/public/uploads/courses/${req.file.filename}`;

            res.json({
                success: true,
                message: 'Изображение успешно загружено',
                imageUrl: imageUrl
            });

        } catch (error) {
            handleError(res, error, 'Ошибка при загрузке изображения');
        }
    }
};