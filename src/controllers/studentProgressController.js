const db = require('../models');
const { handleError } = require('../utils/errorHandler');

const MAX_TEST_ATTEMPTS = 4;

function isDeadlinePassed(deadline) {
    if (!deadline) return false;
    const deadlineDate = new Date(deadline);
    return !Number.isNaN(deadlineDate.getTime()) && deadlineDate.getTime() <= Date.now();
}

function getExerciseMaxScore(exercise) {
    return exercise?.scoring?.firstAttempt ?? 100;
}

function getBestPreviousExerciseResult(attempts, exerciseId) {
    return attempts.reduce((bestResult, attempt) => {
        if (attempt.exercise_results?._deadlineClosed === true) return bestResult;

        const result = attempt.exercise_results?.[exerciseId];
        if (!result) return bestResult;

        const resultScore = Number(result.score) || 0;
        const bestScore = Number(bestResult?.score) || 0;

        return resultScore > bestScore || result.isFullyCorrect === true ? result : bestResult;
    }, null);
}

function buildDeadlineExerciseResults(test, previousAttempts = []) {
    const exerciseResults = {
        _deadlineClosed: true
    };
    let totalScore = 0;
    let totalMaxScore = 0;

    (test.exercises || []).forEach(exercise => {
        const maxScore = getExerciseMaxScore(exercise);
        const previousResult = getBestPreviousExerciseResult(previousAttempts, exercise.id) || {};
        const preservedScore = Number(previousResult.score) || 0;
        totalMaxScore += maxScore;
        totalScore += preservedScore;

        exerciseResults[exercise.id] = {
            score: preservedScore,
            maxScore,
            isFullyCorrect: previousResult.isFullyCorrect === true,
            answers: previousResult.answers || {},
            type: exercise.type
        };
    });

    return { exerciseResults, totalScore, totalMaxScore };
}

function isTestPassed(test, attempts) {
    if (!attempts || attempts.length === 0) return false;

    const exercises = test.exercises || [];
    const lastAttempt = attempts[attempts.length - 1];
    const exerciseResults = lastAttempt.exercise_results || {};

    if (exercises.length > 0) {
        return exercises.every(exercise => exerciseResults[exercise.id]?.isFullyCorrect === true);
    }

    return lastAttempt.max_score > 0 && lastAttempt.total_score >= lastAttempt.max_score;
}

async function ensureDeadlineAttempt(test, studentId) {
    const attempts = await db.TestAttempt.findAll({
        where: {
            test_id: test.id,
            student_id: studentId
        },
        order: [['attempt_number', 'ASC']]
    });

    const deadlinePassed = isDeadlinePassed(test.deadline);
    if (!deadlinePassed) {
        return { attempts, deadlinePassed, deadlineClosed: false };
    }

    const deadlineAttempt = attempts.find(attempt => attempt.exercise_results?._deadlineClosed === true);
    const previousAttempts = attempts.filter(attempt => attempt.exercise_results?._deadlineClosed !== true);
    const alreadyClosedByDeadline = Boolean(deadlineAttempt);
    const shouldCloseByDeadline = attempts.length < MAX_TEST_ATTEMPTS && !isTestPassed(test, attempts);

    if (!alreadyClosedByDeadline && shouldCloseByDeadline) {
        const { exerciseResults, totalScore, totalMaxScore } = buildDeadlineExerciseResults(test, previousAttempts);
        const newDeadlineAttempt = await db.TestAttempt.create({
            test_id: test.id,
            student_id: studentId,
            attempt_number: attempts.length + 1,
            total_score: totalScore,
            max_score: totalMaxScore,
            exercise_results: exerciseResults,
            completed_at: new Date()
        });

        attempts.push(newDeadlineAttempt);
    } else if (deadlineAttempt && previousAttempts.length > 0) {
        const { exerciseResults, totalScore, totalMaxScore } = buildDeadlineExerciseResults(test, previousAttempts);
        if (deadlineAttempt.total_score !== totalScore || deadlineAttempt.max_score !== totalMaxScore) {
            await deadlineAttempt.update({
                total_score: totalScore,
                max_score: totalMaxScore,
                exercise_results: exerciseResults
            });
        }
    }

    return {
        attempts,
        deadlinePassed,
        deadlineClosed: attempts.some(attempt => attempt.exercise_results?._deadlineClosed === true)
    };
}

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
            const { sectionId, userPairs } = req.body; // userPairs: { targetId: itemId }
            
            const section = await db.Section.findByPk(sectionId, {
                include: [{ model: db.Exercise, as: 'exercise' }]
            });
            
            if (!section || !section.exercise) {
                return res.status(404).json({ success: false, message: 'Упражнение не найдено' });
            }
            
            const exercise = section.exercise;
            const correctPairs = exercise.matches || []; // [{ itemId, targetId }]
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
            
            // Получаем текущую версию раздела
            const section = await db.Section.findByPk(sectionId);
            if (!section) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: 'Раздел не найден' });
            }
            
            const currentSectionVersion = section.version || 1;
            
            const existingProgress = await db.StudentProgress.findOne({
                where: {
                    student_id: studentId,
                    section_id: sectionId
                },
                transaction
            });
            
            if (existingProgress) {
                // Проверяем, изменилась ли версия раздела
                if (existingProgress.section_version !== currentSectionVersion) {
                    // Версия изменилась — сбрасываем прогресс
                    await existingProgress.update({
                        status: 'not_started',
                        best_score: 0,
                        attempts_count: 0,
                        section_version: currentSectionVersion,
                        completed_at: null
                    }, { transaction });
                } else if (existingProgress.status !== 'completed') {
                    await existingProgress.update({
                        status: 'completed',
                        best_score: score,
                        completed_at: new Date()
                    }, { transaction });
                }
                // Если уже completed и версия совпадает — не обновляем
            } else {
                await db.StudentProgress.create({
                    student_id: studentId,
                    section_id: sectionId,
                    status: 'completed',
                    best_score: score,
                    section_version: currentSectionVersion,
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
                // Преобразуем строки в числа, если нужно
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
            const { sectionId, userAnswers } = req.body; // userAnswers: { sentenceId: [selectedWords] }
            
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

    // Получение количества попыток теста для студента
// Получение количества попыток теста для студента
getTestAttempts: async (req, res) => {
    try {
        const { testId } = req.params;
        const studentId = req.user.id;
        
        const test = await db.Test.findOne({
            where: { section_id: testId }
        });
        
        if (!test) {
            return res.status(404).json({ success: false, message: 'Тест не найден' });
        }

        const deadlineState = await ensureDeadlineAttempt(test, studentId);
        const attempts = deadlineState.attempts;
        
        res.json({
            success: true,
            attemptsCount: attempts.length,
            attempts: attempts.map(a => ({
                attemptNumber: a.attempt_number,
                totalScore: a.total_score,
                maxScore: a.max_score,
                exerciseResults: a.exercise_results,
                completedAt: a.completed_at
            })),
            maxAttempts: MAX_TEST_ATTEMPTS,
            deadlinePassed: deadlineState.deadlinePassed,
            deadlineClosed: deadlineState.deadlineClosed
        });
    } catch (error) {
        console.error('Ошибка получения попыток теста:', error);
        handleError(res, error, 'Ошибка получения попыток теста');
    }
},

saveTestAttempt: async (req, res) => {
    try {
        const { testId } = req.params;
        const studentId = req.user.id;
        const { attemptNumber, totalScore, maxScore, exerciseResults } = req.body;
        
        const test = await db.Test.findOne({
            where: { section_id: testId }
        });
        
        if (!test) {
            return res.status(404).json({ success: false, message: 'Тест не найден' });
        }

        const deadlineState = await ensureDeadlineAttempt(test, studentId);
        if (deadlineState.deadlinePassed) {
            return res.json({
                success: true,
                attempt: deadlineState.attempts[deadlineState.attempts.length - 1] || null,
                attemptsCount: deadlineState.attempts.length,
                deadlinePassed: true,
                deadlineClosed: deadlineState.deadlineClosed
            });
        }
        
        // Проверяем, не существует ли уже такой попытки
        const existingAttempt = await db.TestAttempt.findOne({
            where: {
                test_id: test.id,
                student_id: studentId,
                attempt_number: attemptNumber
            }
        });
        
        if (existingAttempt) {
            // Если попытка уже существует, просто возвращаем успех
            return res.json({
                success: true,
                attempt: existingAttempt,
                attemptsCount: await db.TestAttempt.count({
                    where: { test_id: test.id, student_id: studentId }
                })
            });
        }
        
        // Проверяем лимит попыток
        const attemptsCount = await db.TestAttempt.count({
            where: {
                test_id: test.id,
                student_id: studentId
            }
        });
        
        if (attemptsCount >= MAX_TEST_ATTEMPTS) {
            return res.status(400).json({
                success: false,
                message: 'Лимит попыток исчерпан'
            });
        }
        
        // Сохраняем новую попытку
        const newAttempt = await db.TestAttempt.create({
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
            attempt: newAttempt,
            attemptsCount: attemptsCount + 1
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
            
            // Находим тест
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
                // Упражнение считается выполненным ТОЛЬКО если ВСЕ ответы правильные
                const isFullyCorrect = allCorrect && correctCount === totalTargets && totalTargets > 0;
                // Баллы: maxScore если всё правильно, иначе 0
                const earnedScore = isFullyCorrect ? maxScore : 0;
                
                console.log(`Matching: correctCount=${correctCount}, totalTargets=${totalTargets}, isFullyCorrect=${isFullyCorrect}, earnedScore=${earnedScore}, maxScore=${maxScore}`);
                
                res.json({
                    success: true,
                    correct: isFullyCorrect,
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
                // Упражнение считается выполненным ТОЛЬКО если ВСЕ утверждения правильные
                const isFullyCorrect = allCorrect && correctCount === totalStatements && totalStatements > 0;
                // Баллы: maxScore если всё правильно, иначе 0
                const earnedScore = isFullyCorrect ? maxScore : 0;
                
                console.log(`Choice: correctCount=${correctCount}, totalStatements=${totalStatements}, isFullyCorrect=${isFullyCorrect}, earnedScore=${earnedScore}, maxScore=${maxScore}`);
                
                res.json({
                    success: true,
                    correct: isFullyCorrect,
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
                // Упражнение считается выполненным ТОЛЬКО если ВСЕ предложения правильные
                const isFullyCorrect = allCorrect && correctCount === totalSentences && totalSentences > 0;
                // Баллы: maxScore если всё правильно, иначе 0
                const earnedScore = isFullyCorrect ? maxScore : 0;
                
                console.log(`FillBlanks: correctCount=${correctCount}, totalSentences=${totalSentences}, isFullyCorrect=${isFullyCorrect}, earnedScore=${earnedScore}, maxScore=${maxScore}`);
                
                // В studentProgressController.js, в checkTestExercise
                res.json({
                    success: true,
                    correct: isFullyCorrect,  // true если все ответы правильные
                    isFullyCorrect: isFullyCorrect,  // добавляем отдельный флаг
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
    }
};