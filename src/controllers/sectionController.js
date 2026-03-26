const db = require('../models');
const { handleError } = require('../utils/errorHandler');

module.exports = {
    getSectionsByBlock: async (req, res) => {
        try {
            const { blockId } = req.params;
            
            const block = await db.Block.findByPk(blockId, {
                include: [
                    {
                        model: db.Theme,
                        as: 'theme',
                        include: [{ model: db.Course, as: 'course' }]
                    }
                ]
            });
            
            if (!block) {
                return res.status(404).json({
                    success: false,
                    message: 'Блок не найден'
                });
            }
            
            if (block.theme.course.teacher_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Нет доступа к этому блоку'
                });
            }
            
            const sections = await db.Section.findAll({
                where: { block_id: blockId },
                order: [['order_index', 'ASC']],
                include: [
                    { model: db.TheoryContent, as: 'theoryContent' },
                    { model: db.Exercise, as: 'exercise' },
                    { model: db.Test, as: 'test' }
                ]
            });
            
            res.json({ success: true, sections });
            
        } catch (error) {
            handleError(res, error, 'Ошибка при получении разделов');
        }
    },
    
    createSection: async (req, res) => {
        const transaction = await db.sequelize.transaction();
        
        try {
            const { blockId } = req.params;
            const { title, type } = req.body;
            
            const block = await db.Block.findByPk(blockId, {
                include: [
                    {
                        model: db.Theme,
                        as: 'theme',
                        include: [{ model: db.Course, as: 'course' }]
                    }
                ]
            });
            
            if (!block) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Блок не найден'
                });
            }
            
            if (block.theme.course.teacher_id !== req.user.id) {
                await transaction.rollback();
                return res.status(403).json({
                    success: false,
                    message: 'Нет прав на создание разделов в этом блоке'
                });
            }
            
            const maxOrder = await db.Section.max('order_index', {
                where: { block_id: blockId }
            });
            
            const section = await db.Section.create({
                block_id: blockId,
                title: title || `Новый ${type === 'theory' ? 'раздел теории' : type === 'exercise' ? 'раздел упражнений' : 'итоговый тест'}`,
                type: type,
                order_index: (maxOrder !== null ? maxOrder + 1 : 0)
            }, { transaction });
            
            let content = null;
            
            switch (type) {
                case 'theory':
                    content = await db.TheoryContent.create({
                        section_id: section.id,
                        text: '',
                        file_url: null
                    }, { transaction });
                    break;
                case 'exercise':
                    content = await db.Exercise.create({
                        section_id: section.id,
                        exercise_type: 'matching'
                    }, { transaction });
                    break;
                case 'test':
                    content = await db.Test.create({
                        section_id: section.id,
                        questions: []
                    }, { transaction });
                    break;
                default:
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        message: 'Некорректный тип раздела. Доступные типы: theory, exercise, test'
                    });
            }
            
            await transaction.commit();
            
            const createdSection = await db.Section.findByPk(section.id, {
                include: [
                    { model: db.TheoryContent, as: 'theoryContent' },
                    { model: db.Exercise, as: 'exercise' },
                    { model: db.Test, as: 'test' }
                ]
            });
            
            res.status(201).json({
                success: true,
                message: 'Раздел успешно создан',
                section: createdSection
            });
            
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Ошибка при создании раздела');
        }
    },
    
    updateTheorySection: async (req, res) => {
        const transaction = await db.sequelize.transaction();
        
        try {
            const { sectionId } = req.params;
            const { title, text, file_url } = req.body;
            
            const section = await db.Section.findByPk(sectionId, {
                include: [
                    {
                        model: db.Block,
                        as: 'block',
                        include: [
                            {
                                model: db.Theme,
                                as: 'theme',
                                include: [{ model: db.Course, as: 'course' }]
                            }
                        ]
                    },
                    { model: db.TheoryContent, as: 'theoryContent' }
                ]
            });
            
            if (!section) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Раздел не найден'
                });
            }
            
            if (section.block.theme.course.teacher_id !== req.user.id) {
                await transaction.rollback();
                return res.status(403).json({
                    success: false,
                    message: 'Нет прав на редактирование этого раздела'
                });
            }
            
            if (title) {
                await section.update({ title }, { transaction });
            }
            
            if (section.theoryContent) {
                await section.theoryContent.update({
                    text: text !== undefined ? text : section.theoryContent.text,
                    file_url: file_url !== undefined ? file_url : section.theoryContent.file_url
                }, { transaction });
            }
            
            await transaction.commit();
            
            const updatedSection = await db.Section.findByPk(sectionId, {
                include: [{ model: db.TheoryContent, as: 'theoryContent' }]
            });
            
            res.json({
                success: true,
                message: 'Раздел теории успешно обновлен',
                section: updatedSection
            });
            
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Ошибка при обновлении раздела теории');
        }
    },
    
    updateExerciseSection: async (req, res) => {
        const transaction = await db.sequelize.transaction();
        
        try {
            const { sectionId } = req.params;
            const { title, exercise_type, question_text, options, left_column, right_column, matches, correct_answer } = req.body;
            
            const section = await db.Section.findByPk(sectionId, {
                include: [
                    {
                        model: db.Block,
                        as: 'block',
                        include: [
                            {
                                model: db.Theme,
                                as: 'theme',
                                include: [{ model: db.Course, as: 'course' }]
                            }
                        ]
                    },
                    { model: db.Exercise, as: 'exercise' }
                ]
            });
            
            if (!section) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Раздел не найден'
                });
            }
            
            if (section.block.theme.course.teacher_id !== req.user.id) {
                await transaction.rollback();
                return res.status(403).json({
                    success: false,
                    message: 'Нет прав на редактирование этого раздела'
                });
            }
            
            if (title) {
                await section.update({ title }, { transaction });
            }
            
            if (section.exercise) {
                await section.exercise.update({
                    exercise_type: exercise_type !== undefined ? exercise_type : section.exercise.exercise_type,
                    question_text: question_text !== undefined ? question_text : section.exercise.question_text,
                    options: options !== undefined ? options : section.exercise.options,
                    left_column: left_column !== undefined ? left_column : section.exercise.left_column,
                    right_column: right_column !== undefined ? right_column : section.exercise.right_column,
                    matches: matches !== undefined ? matches : section.exercise.matches,
                    correct_answer: correct_answer !== undefined ? correct_answer : section.exercise.correct_answer
                }, { transaction });
            }
            
            await transaction.commit();
            
            const updatedSection = await db.Section.findByPk(sectionId, {
                include: [{ model: db.Exercise, as: 'exercise' }]
            });
            
            res.json({
                success: true,
                message: 'Упражнение успешно обновлено',
                section: updatedSection
            });
            
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Ошибка при обновлении упражнения');
        }
    },
    
    updateTestSection: async (req, res) => {
        const transaction = await db.sequelize.transaction();
        
        try {
            const { sectionId } = req.params;
            const { title, questions, passing_score, time_limit } = req.body;
            
            const section = await db.Section.findByPk(sectionId, {
                include: [
                    {
                        model: db.Block,
                        as: 'block',
                        include: [
                            {
                                model: db.Theme,
                                as: 'theme',
                                include: [{ model: db.Course, as: 'course' }]
                            }
                        ]
                    },
                    { model: db.Test, as: 'test' }
                ]
            });
            
            if (!section) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Раздел не найден'
                });
            }
            
            if (section.block.theme.course.teacher_id !== req.user.id) {
                await transaction.rollback();
                return res.status(403).json({
                    success: false,
                    message: 'Нет прав на редактирование этого раздела'
                });
            }
            
            if (title) {
                await section.update({ title }, { transaction });
            }
            
            if (section.test) {
                await section.test.update({
                    questions: questions !== undefined ? questions : section.test.questions,
                    passing_score: passing_score !== undefined ? passing_score : section.test.passing_score,
                    time_limit: time_limit !== undefined ? time_limit : section.test.time_limit
                }, { transaction });
            }
            
            await transaction.commit();
            
            const updatedSection = await db.Section.findByPk(sectionId, {
                include: [{ model: db.Test, as: 'test' }]
            });
            
            res.json({
                success: true,
                message: 'Итоговый тест успешно обновлен',
                section: updatedSection
            });
            
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Ошибка при обновлении итогового теста');
        }
    },
    
    deleteSection: async (req, res) => {
        const transaction = await db.sequelize.transaction();
        
        try {
            const { sectionId } = req.params;
            
            const section = await db.Section.findByPk(sectionId, {
                include: [
                    {
                        model: db.Block,
                        as: 'block',
                        include: [
                            {
                                model: db.Theme,
                                as: 'theme',
                                include: [{ model: db.Course, as: 'course' }]
                            }
                        ]
                    }
                ]
            });
            
            if (!section) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Раздел не найден'
                });
            }
            
            if (section.block.theme.course.teacher_id !== req.user.id) {
                await transaction.rollback();
                return res.status(403).json({
                    success: false,
                    message: 'Нет прав на удаление этого раздела'
                });
            }
            
            await section.destroy({ transaction });
            await transaction.commit();
            
            res.json({
                success: true,
                message: 'Раздел успешно удален'
            });
            
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Ошибка при удалении раздела');
        }
    },
    
    reorderSections: async (req, res) => {
        const transaction = await db.sequelize.transaction();
        
        try {
            const { blockId } = req.params;
            const { sectionOrders } = req.body;
            
            const block = await db.Block.findByPk(blockId, {
                include: [
                    {
                        model: db.Theme,
                        as: 'theme',
                        include: [{ model: db.Course, as: 'course' }]
                    }
                ]
            });
            
            if (!block) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Блок не найден'
                });
            }
            
            if (block.theme.course.teacher_id !== req.user.id) {
                await transaction.rollback();
                return res.status(403).json({
                    success: false,
                    message: 'Нет прав на изменение порядка разделов'
                });
            }
            
            for (const item of sectionOrders) {
                await db.Section.update(
                    { order_index: item.order_index },
                    { where: { id: item.id, block_id: blockId }, transaction }
                );
            }
            
            await transaction.commit();
            
            res.json({
                success: true,
                message: 'Порядок разделов успешно обновлен'
            });
            
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Ошибка при изменении порядка разделов');
        }
    }
};