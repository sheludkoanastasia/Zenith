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

module.exports = router;