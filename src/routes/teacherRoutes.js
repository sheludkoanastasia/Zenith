// src/routes/teacherRoutes.js - для преподавателей
const express = require('express');
const path = require('path');
const router = express.Router();

// Страница преподавателя
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/views/teacherMainPanel.html'));
});

// Страница создания курса
router.get('/create-course', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/views/createCourse.html'));
});

module.exports = router;