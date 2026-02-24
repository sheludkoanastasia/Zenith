const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const validationMiddleware = require('../middleware/validationMiddleware');

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

// Тестовый маршрут
router.get('/test', (req, res) => {
    res.json({ success: true, message: 'API работает!' });
});

module.exports = router;