const express = require('express');
const router = express.Router();

console.log('=== ЗАГРУЗКА МОДУЛЕЙ ===');

// Загружаем модули по одному и проверяем
const authController = require('../controllers/authController');
console.log('1. authController:', authController);

const authMiddleware = require('../middleware/authMiddleware');
console.log('2. authMiddleware:', authMiddleware);
console.log('   - verifyToken:', authMiddleware.verifyToken);

const validationMiddleware = require('../middleware/validationMiddleware');
console.log('3. validationMiddleware:', validationMiddleware);
console.log('   - validateRegistration:', validationMiddleware.validateRegistration);
console.log('   - validateLogin:', validationMiddleware.validateLogin);

// Проверяем типы
console.log('\n=== ПРОВЕРКА ТИПОВ ===');
console.log('typeof authController.register:', typeof authController.register);
console.log('typeof authController.login:', typeof authController.login);
console.log('typeof authController.check:', typeof authController.check);
console.log('typeof authMiddleware.verifyToken:', typeof authMiddleware.verifyToken);
console.log('Array.isArray(validateRegistration):', Array.isArray(validationMiddleware.validateRegistration));
console.log('Array.isArray(validateLogin):', Array.isArray(validationMiddleware.validateLogin));

// Временные заглушки на случай если что-то undefined
const registerHandler = authController.register || ((req, res) => res.json({ message: 'register stub' }));
const loginHandler = authController.login || ((req, res) => res.json({ message: 'login stub' }));
const checkHandler = authController.check || ((req, res) => res.json({ message: 'check stub' }));
const verifyTokenHandler = authMiddleware.verifyToken || ((req, res, next) => next());
const validateRegHandler = validationMiddleware.validateRegistration || ((req, res, next) => next());
const validateLoginHandler = validationMiddleware.validateLogin || ((req, res, next) => next());

// Маршруты
router.post('/auth/register', validateRegHandler, registerHandler);
router.post('/auth/login', validateLoginHandler, loginHandler);
router.get('/auth/check', verifyTokenHandler, checkHandler);
router.post('/auth/check-email', authController.checkEmail);

// Тестовый маршрут
router.get('/test', (req, res) => {
    res.json({ success: true, message: 'API работает!' });
});

console.log('=== МАРШРУТЫ НАСТРОЕНЫ ===\n');

module.exports = router;