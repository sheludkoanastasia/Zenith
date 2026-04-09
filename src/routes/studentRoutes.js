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

module.exports = router;