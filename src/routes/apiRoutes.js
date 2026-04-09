const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const validationMiddleware = require('../middleware/validationMiddleware');
const studentRoutes = require('./studentRoutes');

// Маршруты
router.post('/auth/register', 
    validationMiddleware.validateRegistration, 
    authController.register
);

router.post('/auth/login', 
    validationMiddleware.validateLogin, 
    authController.login
);

router.get('/auth/check', 
    authMiddleware.verifyToken, 
    authController.check
);

router.post('/auth/check-email', authController.checkEmail);

router.use('/student', studentRoutes);

module.exports = router;

// Тестовый маршрут
router.get('/test', (req, res) => {
    res.json({ success: true, message: 'API работает!' });
});

module.exports = router;