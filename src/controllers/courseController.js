const db = require('../models');
const { handleError } = require('../utils/errorHandler');

module.exports = {
    createCourse: async (req, res) => {
        try {
            const { title, cover_image } = req.body;
            
            if (!title) {
                return res.status(400).json({
                    success: false,
                    message: 'Название курса обязательно'
                });
            }

            const course = await db.Course.create({
                title,
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
                    }
                ]
            });

            if (!course) {
                return res.status(404).json({
                    success: false,
                    message: 'Курс не найден'
                });
            }

            if (course.teacher_id !== req.user.id && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Нет доступа к этому курсу'
                });
            }

            res.json({ success: true, course });
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
                course: updatedCourse
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
    }
};