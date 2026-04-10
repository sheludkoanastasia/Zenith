const db = require('../models');
const { handleError } = require('../utils/errorHandler');

module.exports = {
    // Получение прогресса теории
    getTheoryProgress: async (req, res) => {
        try {
            const { sectionId } = req.params;
            const studentId = req.user.id;
            
            const progress = await db.StudentProgress.findOne({
                where: {
                    student_id: studentId,
                    section_id: sectionId
                }
            });
            
            res.json({ 
                success: true, 
                completed: progress?.status === 'completed' 
            });
        } catch (error) {
            handleError(res, error, 'Ошибка при получении прогресса');
        }
    },
    
    // Сохранение прогресса теории (отметить пройденным)
    markTheoryCompleted: async (req, res) => {
        const transaction = await db.sequelize.transaction();
        
        try {
            const { sectionId } = req.body;
            const studentId = req.user.id;
            
            // Проверяем, существует ли уже запись
            const existingProgress = await db.StudentProgress.findOne({
                where: {
                    student_id: studentId,
                    section_id: sectionId
                },
                transaction
            });
            
            if (existingProgress) {
                if (existingProgress.status !== 'completed') {
                    await existingProgress.update({
                        status: 'completed',
                        completed_at: new Date()
                    }, { transaction });
                }
            } else {
                await db.StudentProgress.create({
                    student_id: studentId,
                    section_id: sectionId,
                    status: 'completed',
                    completed_at: new Date()
                }, { transaction });
            }
            
            await transaction.commit();
            
            res.json({ success: true });
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Ошибка при сохранении прогресса');
        }
    },

    // Проверка сопоставления
    checkMatching: async (req, res) => {
        try {
            const { sectionId, userPairs } = req.body;
            
            const section = await db.Section.findByPk(sectionId, {
                include: [{ model: db.Exercise, as: 'exercise' }]
            });
            
            if (!section || !section.exercise) {
                return res.status(404).json({ success: false, message: 'Упражнение не найдено' });
            }
            
            const exercise = section.exercise;
            const correctPairs = exercise.matches || [];
            const targets = exercise.right_column || [];
            
            const results = {};
            let correctCount = 0;
            
            for (const target of targets) {
                const userSelectedItemId = userPairs[target.id];
                const correctMatch = correctPairs.find(p => p.targetId == target.id);
                const isCorrect = correctMatch && correctMatch.itemId == userSelectedItemId;
                results[target.id] = isCorrect;
                if (isCorrect) correctCount++;
            }
            
            const totalTargets = targets.length;
            const score = Math.round((correctCount / totalTargets) * 100);
            const isFullyCorrect = correctCount === totalTargets;
            
            res.json({
                success: true,
                correct: isFullyCorrect,
                score: score,
                maxScore: 100,
                results: results
            });
        } catch (error) {
            handleError(res, error, 'Ошибка проверки сопоставления');
        }
    },
    
    // Получение прогресса упражнения
    getExerciseProgress: async (req, res) => {
        try {
            const { sectionId } = req.params;
            const studentId = req.user.id;
            
            const progress = await db.StudentProgress.findOne({
                where: {
                    student_id: studentId,
                    section_id: sectionId
                }
            });
            
            res.json({ 
                success: true, 
                completed: progress?.status === 'completed' 
            });
        } catch (error) {
            handleError(res, error, 'Ошибка при получении прогресса');
        }
    },

    // Сохранение прогресса упражнения
    markExerciseCompleted: async (req, res) => {
        const transaction = await db.sequelize.transaction();
        
        try {
            const { sectionId, score, maxScore } = req.body;
            const studentId = req.user.id;
            
            const existingProgress = await db.StudentProgress.findOne({
                where: {
                    student_id: studentId,
                    section_id: sectionId
                },
                transaction
            });
            
            if (existingProgress) {
                if (existingProgress.status !== 'completed') {
                    await existingProgress.update({
                        status: 'completed',
                        best_score: score,
                        completed_at: new Date()
                    }, { transaction });
                }
            } else {
                await db.StudentProgress.create({
                    student_id: studentId,
                    section_id: sectionId,
                    status: 'completed',
                    best_score: score,
                    completed_at: new Date()
                }, { transaction });
            }
            
            await transaction.commit();
            res.json({ success: true });
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Ошибка при сохранении прогресса');
        }
    },

    // Проверка выбора правильного (choice)
    checkChoice: async (req, res) => {
        try {
            const { sectionId, userAnswers } = req.body;
            
            console.log('userAnswers:', JSON.stringify(userAnswers, null, 2));
            
            const section = await db.Section.findByPk(sectionId, {
                include: [{ model: db.Exercise, as: 'exercise' }]
            });
            
            if (!section || !section.exercise) {
                return res.status(404).json({ success: false, message: 'Упражнение не найдено' });
            }
            
            const exercise = section.exercise;
            const statements = exercise.options || [];
            
            console.log('statements from DB:', JSON.stringify(statements, null, 2));
            
            const results = {};
            let correctCount = 0;
            
            for (const statement of statements) {
                const userSelectedAnswerIds = userAnswers[statement.id] || [];
                const userSelectedNumbers = userSelectedAnswerIds.map(id => parseInt(id));
                const correctAnswers = statement.answers.filter(a => a.isCorrect === true).map(a => a.id);
                
                console.log(`Statement ${statement.id}: userSelected=${userSelectedNumbers}, correct=${correctAnswers}`);
                
                const hasAllCorrect = correctAnswers.every(id => userSelectedNumbers.includes(id));
                const hasNoExtra = userSelectedNumbers.every(id => correctAnswers.includes(id));
                const isCorrect = hasAllCorrect && hasNoExtra;
                
                console.log(`  hasAllCorrect: ${hasAllCorrect}, hasNoExtra: ${hasNoExtra}, isCorrect: ${isCorrect}`);
                
                results[statement.id] = isCorrect;
                if (isCorrect) correctCount++;
            }
            
            const totalStatements = statements.length;
            const score = Math.round((correctCount / totalStatements) * 100);
            const isFullyCorrect = correctCount === totalStatements;
            
            console.log(`correctCount: ${correctCount}, totalStatements: ${totalStatements}, score: ${score}, isFullyCorrect: ${isFullyCorrect}`);
            
            res.json({
                success: true,
                correct: isFullyCorrect,
                score: score,
                maxScore: 100,
                results: results
            });
        } catch (error) {
            console.error('Ошибка проверки выбора правильного:', error);
            handleError(res, error, 'Ошибка проверки выбора правильного');
        }
    },
    
    // Проверка дополнения (fill_blanks)
    checkFillBlanks: async (req, res) => {
        try {
            const { sectionId, userAnswers } = req.body;
            
            const section = await db.Section.findByPk(sectionId, {
                include: [{ model: db.Exercise, as: 'exercise' }]
            });
            
            if (!section || !section.exercise) {
                return res.status(404).json({ success: false, message: 'Упражнение не найдено' });
            }
            
            const exercise = section.exercise;
            const sentences = exercise.options?.sentences || [];
            
            const results = {};
            let correctCount = 0;
            let totalBlanks = 0;
            
            for (const sentence of sentences) {
                const userSelectedWords = userAnswers[sentence.id] || [];
                const correctWords = sentence.correctAnswers || [];
                totalBlanks += correctWords.length;
                
                let sentenceCorrect = true;
                const blankResults = [];
                
                for (let i = 0; i < correctWords.length; i++) {
                    const isBlankCorrect = userSelectedWords[i] === correctWords[i];
                    blankResults.push(isBlankCorrect);
                    if (!isBlankCorrect) sentenceCorrect = false;
                }
                
                results[sentence.id] = {
                    correct: sentenceCorrect,
                    blanks: blankResults
                };
                if (sentenceCorrect) correctCount++;
            }
            
            const score = Math.round((correctCount / sentences.length) * 100);
            const isFullyCorrect = correctCount === sentences.length;
            
            res.json({
                success: true,
                correct: isFullyCorrect,
                score: score,
                maxScore: 100,
                results: results
            });
        } catch (error) {
            handleError(res, error, 'Ошибка проверки дополнения');
        }
    },

    // Получение количества попыток теста для студента (из таблицы test_attempts)
    getTestAttempts: async (req, res) => {
        try {
            const { testId } = req.params;
            const studentId = req.user.id;
            
            // Находим тест по section_id
            const test = await db.Test.findOne({
                where: { section_id: testId }
            });
            
            if (!test) {
                return res.status(404).json({ success: false, message: 'Тест не найден' });
            }
            
            // Получаем попытки из таблицы test_attempts
            const attempts = await db.TestAttempt.findAll({
                where: {
                    test_id: test.id,
                    student_id: studentId
                },
                order: [['attempt_number', 'ASC']]
            });
            
            res.json({
                success: true,
                attemptsCount: attempts.length,
                attempts: attempts,
                maxAttempts: 4
            });
        } catch (error) {
            console.error('Ошибка получения попыток теста:', error);
            handleError(res, error, 'Ошибка получения попыток теста');
        }
    },

    // Сохранение результата попытки теста (в таблицу test_attempts)
    saveTestAttempt: async (req, res) => {
        try {
            const { testId } = req.params;
            const studentId = req.user.id;
            const { attemptNumber, totalScore, maxScore, exerciseResults } = req.body;
            
            // Находим тест по section_id
            const test = await db.Test.findOne({
                where: { section_id: testId }
            });
            
            if (!test) {
                return res.status(404).json({ success: false, message: 'Тест не найден' });
            }
            
            // Проверяем лимит попыток
            const existingAttemptsCount = await db.TestAttempt.count({
                where: {
                    test_id: test.id,
                    student_id: studentId
                }
            });
            
            if (existingAttemptsCount >= 4) {
                return res.status(400).json({
                    success: false,
                    message: 'Лимит попыток исчерпан'
                });
            }
            
            // Сохраняем попытку в таблицу test_attempts
            const attempt = await db.TestAttempt.create({
                test_id: test.id,
                student_id: studentId,
                attempt_number: attemptNumber,
                total_score: totalScore,
                max_score: maxScore,
                exercise_results: exerciseResults,
                completed_at: new Date()
            });
            
            res.json({
                success: true,
                attempt: attempt,
                attemptsCount: existingAttemptsCount + 1
            });
        } catch (error) {
            console.error('Ошибка сохранения попытки теста:', error);
            handleError(res, error, 'Ошибка сохранения попытки теста');
        }
    },

    // Проверка упражнения в тесте (по exerciseId из массива exercises)
    checkTestExercise: async (req, res) => {
        try {
            const { testId, exerciseId } = req.params;
            const { userAnswers } = req.body;
            
            console.log('=== checkTestExercise ===');
            console.log('testId:', testId);
            console.log('exerciseId:', exerciseId);
            console.log('userAnswers:', JSON.stringify(userAnswers, null, 2));
            
            // Находим тест по section_id
            const test = await db.Test.findOne({
                where: { section_id: testId }
            });
            
            if (!test) {
                return res.status(404).json({ success: false, message: 'Тест не найден' });
            }
            
            // Находим упражнение в массиве exercises
            const exercises = test.exercises || [];
            const exercise = exercises.find(e => e.id == exerciseId);
            
            if (!exercise) {
                return res.status(404).json({ success: false, message: 'Упражнение не найдено в тесте' });
            }
            
            console.log('Тип упражнения:', exercise.type);
            
            // Получаем максимальный балл за упражнение (из scoring.firstAttempt)
            const maxScore = exercise.scoring?.firstAttempt ?? 100;
            
            // Проверяем в зависимости от типа
            if (exercise.type === 'matching') {
                const correctPairs = exercise.data.pairs || [];
                const targets = exercise.data.targets || [];
                
                let allCorrect = true;
                let correctCount = 0;
                
                for (const target of targets) {
                    const userSelectedItemId = userAnswers[target.id];
                    const correctMatch = correctPairs.find(p => p.targetId == target.id);
                    const isCorrect = correctMatch && correctMatch.itemId == userSelectedItemId;
                    if (!isCorrect) {
                        allCorrect = false;
                    } else {
                        correctCount++;
                    }
                }
                
                const totalTargets = targets.length;
                const isFullyCorrect = allCorrect && correctCount === totalTargets && totalTargets > 0;
                const earnedScore = isFullyCorrect ? maxScore : 0;
                
                console.log(`Matching: correctCount=${correctCount}, totalTargets=${totalTargets}, isFullyCorrect=${isFullyCorrect}, earnedScore=${earnedScore}, maxScore=${maxScore}`);
                
                res.json({
                    success: true,
                    correct: isFullyCorrect,
                    isFullyCorrect: isFullyCorrect,
                    score: earnedScore,
                    maxScore: maxScore,
                    results: {}
                });
            }
            else if (exercise.type === 'choice') {
                const statements = exercise.data.statements || [];
                
                let allCorrect = true;
                let correctCount = 0;
                
                for (const statement of statements) {
                    const userSelectedAnswerIds = userAnswers[statement.id] || [];
                    const userSelectedStrings = userSelectedAnswerIds.map(id => String(id));
                    
                    const correctAnswers = statement.answers
                        .filter(a => a.isCorrect === true)
                        .map(a => String(a.id));
                    
                    const hasAllCorrect = correctAnswers.every(id => userSelectedStrings.includes(id));
                    const hasNoExtra = userSelectedStrings.every(id => correctAnswers.includes(id));
                    const isCorrect = hasAllCorrect && hasNoExtra && userSelectedStrings.length === correctAnswers.length;
                    
                    if (!isCorrect) {
                        allCorrect = false;
                    } else {
                        correctCount++;
                    }
                }
                
                const totalStatements = statements.length;
                const isFullyCorrect = allCorrect && correctCount === totalStatements && totalStatements > 0;
                const earnedScore = isFullyCorrect ? maxScore : 0;
                
                console.log(`Choice: correctCount=${correctCount}, totalStatements=${totalStatements}, isFullyCorrect=${isFullyCorrect}, earnedScore=${earnedScore}, maxScore=${maxScore}`);
                
                res.json({
                    success: true,
                    correct: isFullyCorrect,
                    isFullyCorrect: isFullyCorrect,
                    score: earnedScore,
                    maxScore: maxScore,
                    results: {}
                });
            }
            else if (exercise.type === 'fill_blanks') {
                const sentences = exercise.data.sentences || [];
                
                let allCorrect = true;
                let correctCount = 0;
                
                for (const sentence of sentences) {
                    const userSelectedWords = userAnswers[sentence.id] || [];
                    const correctWords = sentence.correctAnswers || [];
                    
                    let sentenceCorrect = true;
                    for (let i = 0; i < correctWords.length; i++) {
                        const isBlankCorrect = String(userSelectedWords[i]) === String(correctWords[i]);
                        if (!isBlankCorrect) {
                            sentenceCorrect = false;
                            break;
                        }
                    }
                    
                    if (!sentenceCorrect) {
                        allCorrect = false;
                    } else {
                        correctCount++;
                    }
                }
                
                const totalSentences = sentences.length;
                const isFullyCorrect = allCorrect && correctCount === totalSentences && totalSentences > 0;
                const earnedScore = isFullyCorrect ? maxScore : 0;
                
                console.log(`FillBlanks: correctCount=${correctCount}, totalSentences=${totalSentences}, isFullyCorrect=${isFullyCorrect}, earnedScore=${earnedScore}, maxScore=${maxScore}`);
                
                res.json({
                    success: true,
                    correct: isFullyCorrect,
                    isFullyCorrect: isFullyCorrect,
                    score: earnedScore,
                    maxScore: maxScore,
                    results: {}
                });
            }
            else {
                res.status(400).json({ success: false, message: 'Неизвестный тип упражнения' });
            }
        } catch (error) {
            console.error('Ошибка проверки упражнения теста:', error);
            handleError(res, error, 'Ошибка проверки упражнения');
        }
    },

    // Очистка попыток теста (для администратора/преподавателя)
    clearTestAttempts: async (req, res) => {
        try {
            const { testId } = req.params;
            const { studentId } = req.body;
            
            // Находим тест по section_id
            const test = await db.Test.findOne({
                where: { section_id: testId }
            });
            
            if (!test) {
                return res.status(404).json({ success: false, message: 'Тест не найден' });
            }
            
            const whereClause = { test_id: test.id };
            if (studentId) {
                whereClause.student_id = studentId;
            }
            
            const deletedCount = await db.TestAttempt.destroy({ where: whereClause });
            
            res.json({
                success: true,
                message: `Удалено ${deletedCount} записей о попытках`,
                deletedCount
            });
        } catch (error) {
            console.error('Ошибка очистки попыток теста:', error);
            handleError(res, error, 'Ошибка очистки попыток теста');
        }
    }
};