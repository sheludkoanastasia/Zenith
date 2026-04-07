const db = require('../models');
const { handleError } = require('../utils/errorHandler');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

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
    
    getSectionById: async (req, res) => {
        try {
            const { sectionId } = req.params;
            
            const section = await db.Section.findByPk(sectionId, {
                include: [
                    { 
                        model: db.TheoryContent, 
                        as: 'theoryContent' 
                    },
                    { 
                        model: db.Exercise, 
                        as: 'exercise' 
                    },
                    { 
                        model: db.Test, 
                        as: 'test' 
                    },
                    {
                        model: db.Block,
                        as: 'block',
                        include: [
                            {
                                model: db.Theme,
                                as: 'theme',
                                include: [
                                    {
                                        model: db.Course,
                                        as: 'course'
                                    }
                                ]
                            }
                        ]
                    }
                ]
            });
            
            if (!section) {
                return res.status(404).json({
                    success: false,
                    message: 'Раздел не найден'
                });
            }
            
            // Проверяем права доступа (только преподаватель-владелец курса)
            if (section.block.theme.course.teacher_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Нет доступа к этому разделу'
                });
            }
            
            // Убираем лишние вложенности для чистоты ответа
            const responseData = {
                id: section.id,
                title: section.title,
                type: section.type,
                order_index: section.order_index,
                block_id: section.block_id,
                theoryContent: section.theoryContent,
                exercise: section.exercise,
                test: section.test
            };
            
            res.json({
                success: true,
                section: responseData
            });
            
        } catch (error) {
            console.error('Ошибка при получении раздела:', error);
            handleError(res, error, 'Ошибка при получении раздела');
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
                        exercises: [],  // ← поменять с questions на exercises
                        passing_score: 70,
                        time_limit: null,
                        deadline: null
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
            
            // Обновляем название, если оно передано
            if (title !== undefined) {
                await section.update({ title }, { transaction });
            }
            
            // Обновляем содержимое теории ТОЛЬКО если оно передано
            if (section.theoryContent) {
                const updateData = {};
                if (text !== undefined) updateData.text = text;
                if (file_url !== undefined) updateData.file_url = file_url;
                
                // Обновляем только если есть что обновлять
                if (Object.keys(updateData).length > 0) {
                    await section.theoryContent.update(updateData, { transaction });
                }
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
            console.error('Ошибка при обновлении раздела теории:', error);
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
            const { title, exercises, passing_score, time_limit, deadline } = req.body;
            
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
                const updateData = {};
                
                if (exercises !== undefined) updateData.exercises = exercises;
                if (passing_score !== undefined) updateData.passing_score = passing_score;
                if (time_limit !== undefined) updateData.time_limit = time_limit;
                
                // Исправление: преобразуем пустую строку в null
                if (deadline !== undefined) {
                    updateData.deadline = deadline && deadline.trim() !== '' ? deadline : null;
                }
                
                console.log('Updating test with data:', updateData);
                
                await section.test.update(updateData, { transaction });
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
            console.error('Ошибка при обновлении итогового теста:', error);
            handleError(res, error, 'Ошибка при обновлении итогового теста');
        }
    },

    // ===== ЗАГРУЗКА ФАЙЛА ДЛЯ ТЕОРИИ =====
    uploadTheoryFile: async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Файл не загружен'
                });
            }
            
            const filePath = req.file.path;
            const fileExt = path.extname(req.file.originalname).toLowerCase();
            let extractedText = '';
            
            console.log('Обработка файла:', req.file.originalname, 'Расширение:', fileExt);
            
            // Извлекаем текст в зависимости от типа файла
            if (fileExt === '.txt') {
                extractedText = fs.readFileSync(filePath, 'utf8');
            } 
            else if (fileExt === '.pdf') {
                try {
                    const dataBuffer = fs.readFileSync(filePath);
                    const pdfData = await pdfParse(dataBuffer);
                    extractedText = pdfData.text;
                    console.log('PDF обработан, длина текста:', extractedText.length);
                } catch (pdfError) {
                    console.error('Ошибка парсинга PDF:', pdfError);
                    extractedText = 'Не удалось извлечь текст из PDF файла. Пожалуйста, скопируйте текст вручную.';
                }
            } 
            else if (fileExt === '.docx') {
                try {
                    const result = await mammoth.extractRawText({ path: filePath });
                    extractedText = result.value;
                    console.log('DOCX обработан, длина текста:', extractedText.length);
                } catch (docxError) {
                    console.error('Ошибка парсинга DOCX:', docxError);
                    extractedText = 'Не удалось извлечь текст из DOCX файла. Пожалуйста, скопируйте текст вручную.';
                }
            }
            
            // Удаляем временный файл
            try {
                fs.unlinkSync(filePath);
            } catch(e) {
                console.log('Ошибка удаления файла:', e);
            }
            
            // Очищаем текст от лишних символов
            extractedText = extractedText
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n')
                .trim();
            
            // Преобразуем текст в HTML с сохранением структуры
            let htmlText = '';
            
            if (extractedText) {
                // Разбиваем на параграфы по пустым строкам
                const paragraphs = extractedText.split(/\n\s*\n/);
                
                htmlText = paragraphs.map(para => {
                    // Обрабатываем строки внутри параграфа
                    const lines = para.split('\n').filter(line => line.trim());
                    
                    // Проверяем, является ли параграф списком
                    const isList = lines.some(line => line.trim().match(/^[•\-*]\s/));
                    
                    if (isList) {
                        const listItems = lines.map(line => {
                            const cleanLine = line.replace(/^[•\-*]\s*/, '');
                            return `<li>${cleanLine}</li>`;
                        }).join('');
                        return `<ul>${listItems}</ul>`;
                    } else {
                        // Обычный параграф
                        const paraText = lines.join('<br>');
                        return `<p>${paraText}</p>`;
                    }
                }).join('');
            } else {
                htmlText = '<p>Текст не извлечен</p>';
            }
            
            res.json({
                success: true,
                message: 'Файл успешно обработан',
                extractedText: htmlText,
                fileName: req.file.originalname
            });
            
        } catch (error) {
            console.error('Ошибка при обработке файла:', error);
            
            // Удаляем файл в случае ошибки
            if (req.file && req.file.path) {
                try { fs.unlinkSync(req.file.path); } catch(e) {}
            }
            
            res.status(500).json({
                success: false,
                message: 'Ошибка при обработке файла: ' + error.message
            });
        }
    },

    // Добавьте эти функции в module.exports перед uploadTheoryFile

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
            
            // Проверяем права доступа
            if (section.block.theme.course.teacher_id !== req.user.id) {
                await transaction.rollback();
                return res.status(403).json({
                    success: false,
                    message: 'Нет прав на удаление этого раздела'
                });
            }
            
            // Удаляем раздел (связанные данные удалятся каскадно благодаря настройкам БД)
            await section.destroy({ transaction });
            
            await transaction.commit();
            
            res.json({
                success: true,
                message: 'Раздел успешно удален'
            });
            
        } catch (error) {
            await transaction.rollback();
            console.error('Ошибка при удалении раздела:', error);
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
            console.error('Ошибка при изменении порядка разделов:', error);
            handleError(res, error, 'Ошибка при изменении порядка разделов');
        }
    }
};