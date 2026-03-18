const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../config/upload'); // <-- ИМПОРТИРУЕМ

// Все роуты курсов требуют авторизации
router.use(authMiddleware.verifyToken);

// Роут для загрузки изображения курса (НОВЫЙ)
router.post('/upload-image',
    authMiddleware.checkRole(['teacher']),
    upload.single('image'), // 'image' - имя поля в форме
    courseController.uploadCourseImage
);

// Роуты для преподавателей
router.post('/',
    authMiddleware.checkRole(['teacher']),
    courseController.createCourse
);

router.put('/:id',
    authMiddleware.checkRole(['teacher']),
    courseController.updateCourse
);

router.get('/teacher',
    authMiddleware.checkRole(['teacher']),
    courseController.getTeacherCourses
);

router.get('/:id',
    courseController.getCourseById
);

module.exports = router;