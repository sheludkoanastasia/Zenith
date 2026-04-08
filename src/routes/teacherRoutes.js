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

// Страница конструктора курса (редактирование)
router.get('/course-constructor', (req, res) => {
    console.log('GET /teacher/course-constructor - отправляем courseConstructor.html');
    const filePath = path.join(__dirname, '../../public/views/courseConstructor.html');
    
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
        console.error('Файл не найден:', filePath);
        return res.status(404).send('Файл courseConstructor.html не найден');
    }
    
    res.sendFile(filePath);
});

// НОВЫЙ МАРШРУТ: Страница предпросмотра курса
router.get('/course-preview', (req, res) => {
    console.log('GET /teacher/course-preview - отправляем coursePreview.html');
    const filePath = path.join(__dirname, '../../public/views/coursePreview.html');
    
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
        console.error('Файл не найден:', filePath);
        return res.status(404).send('Файл coursePreview.html не найден');
    }
    
    res.sendFile(filePath);
});

// НОВЫЙ МАРШРУТ: Страница предпросмотра конструктора (просмотр блоков)
router.get('/course-constructor-preview', (req, res) => {
    console.log('GET /teacher/course-constructor-preview - отправляем courseConstructorPreview.html');
    const filePath = path.join(__dirname, '../../public/views/courseConstructorPreview.html');
    
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
        console.error('Файл не найден:', filePath);
        return res.status(404).send('Файл courseConstructorPreview.html не найден');
    }
    
    res.sendFile(filePath);
});

// Тестовый маршрут для отладки
router.get('/test', (req, res) => {
    console.log('GET /teacher/test - тестовый маршрут работает');
    res.send('Тестовый маршрут работает!');
});

module.exports = router;