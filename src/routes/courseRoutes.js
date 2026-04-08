const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../config/upload');

// Публичный маршрут (без авторизации) для проверки ссылки
router.get('/join/:joinCode', courseController.getCourseByJoinCode);

// Все остальные роуты требуют авторизации
router.use(authMiddleware.verifyToken);

router.post('/upload-image',
    authMiddleware.checkRole(['teacher']),
    upload.single('image'),
    courseController.uploadCourseImage
);

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

// НОВЫЕ МАРШРУТЫ
router.get('/my-courses',
    authMiddleware.checkRole(['student']),
    courseController.getStudentCourses
);

router.post('/join',
    authMiddleware.checkRole(['student']),
    courseController.joinCourseByCode
);

router.get('/:id',
    courseController.getCourseById
);

module.exports = router;