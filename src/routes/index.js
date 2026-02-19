// src/routes/index.js
const express = require('express');
const path = require('path');
const router = express.Router();

// Главная страница
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/views/mainPage.html'));
});

// Перенаправление со старых URL
router.get('/app/main/mainPage.html', (req, res) => {
    res.redirect('/');
});

module.exports = router;