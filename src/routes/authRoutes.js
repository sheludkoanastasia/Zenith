const express = require('express');
const path = require('path');
const router = express.Router();

// Страница авторизации - обрабатываем все варианты
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/views/auth.html'));
});

// Если есть прямой переход на /auth/login или /auth/register
router.get('/login', (req, res) => {
    res.redirect('/auth');
});

router.get('/register', (req, res) => {
    res.redirect('/auth');
});

module.exports = router;