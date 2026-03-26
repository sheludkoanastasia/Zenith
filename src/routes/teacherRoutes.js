const express = require('express');
const path = require('path');
const router = express.Router();

// Страница преподавателя
router.get('/', (req, res) => {
    console.log('GET /teacher - отправляем teacherMainPanel.html');
    res.sendFile(path.join(__dirname, '../../public/views/teacherMainPanel.html'));
});

// Страница создания курса
router.get('/create-course', (req, res) => {
    console.log('GET /teacher/create-course - отправляем createCourse.html');
    res.sendFile(path.join(__dirname, '../../public/views/createCourse.html'));
});

// Страница конструктора курса
router.get('/course-constructor', (req, res) => {
    console.log('GET /teacher/course-constructor - отправляем courseConstructor.html');
    const filePath = path.join(__dirname, '../../public/views/courseConstructor.html');
    
    // Проверяем существование файла
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
        console.error('Файл не найден:', filePath);
        return res.status(404).send('Файл courseConstructor.html не найден');
    }
    
    res.sendFile(filePath);
});

// Тестовый маршрут для отладки
router.get('/test', (req, res) => {
    console.log('GET /teacher/test - тестовый маршрут работает');
    res.send('Тестовый маршрут работает!');
});

module.exports = router;