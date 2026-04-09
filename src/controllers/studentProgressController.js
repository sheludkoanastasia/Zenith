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
    }
};