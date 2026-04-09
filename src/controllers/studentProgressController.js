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
    }
};