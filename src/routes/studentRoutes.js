const express = require('express');
const router = express.Router();
const studentProgressController = require('../controllers/studentProgressController');
const authMiddleware = require('../middleware/authMiddleware');

// Все маршруты требуют авторизации
router.use(authMiddleware.verifyToken);
router.use(authMiddleware.checkRole(['student']));

// Прогресс теории
router.get('/progress/theory/:sectionId', studentProgressController.getTheoryProgress);
router.post('/progress/theory', studentProgressController.markTheoryCompleted);

// Прогресс упражнения
router.get('/progress/exercise/:sectionId', studentProgressController.getExerciseProgress);
router.post('/progress/exercise', studentProgressController.markExerciseCompleted);

// Проверка упражнений
router.post('/exercise/matching/check', studentProgressController.checkMatching);
router.post('/exercise/choice/check', studentProgressController.checkChoice);
router.post('/exercise/fillblanks/check', studentProgressController.checkFillBlanks);

// Проверка упражнения в тесте
router.post('/test/:testId/exercise/:exerciseId/check', studentProgressController.checkTestExercise);

// Попытки теста
router.get('/test/:testId/attempts', studentProgressController.getTestAttempts);
router.post('/test/:testId/attempt', studentProgressController.saveTestAttempt);

// Добавьте маршрут для очистки (только для администратора/преподавателя)
router.delete('/test/:testId/attempts', authMiddleware.checkRole(['admin', 'teacher']), studentProgressController.clearTestAttempts);
router.delete('/test/:testId/student/:studentId/attempts', authMiddleware.checkRole(['admin', 'teacher']), studentProgressController.clearTestAttempts);

module.exports = router;