// src/routes/userRoutes.js - для студентов
const express = require('express');
const path = require('path');
const router = express.Router();

// Страница студента
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/views/userMainPanel.html'));
});

module.exports = router;