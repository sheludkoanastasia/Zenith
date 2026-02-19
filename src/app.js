const express = require('express');
const path = require('path');
const app = express();

// Импорт маршрутов
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const apiRoutes = require('./routes/apiRoutes');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статические файлы - они должны быть ПЕРВЫМИ
app.use('/public', express.static(path.join(__dirname, '../public')));
app.use('/images', express.static(path.join(__dirname, '../public/images')));

// ВАЖНО: API маршруты должны быть перед HTML маршрутами
app.use('/api', apiRoutes);

// HTML маршруты - в правильном порядке
app.use('/auth', authRoutes);  // Страница авторизации
app.use('/user', userRoutes);  // Страница пользователя
app.use('/', indexRoutes);     // Главная страница (должна быть ПОСЛЕДНЕЙ среди HTML)

// 404 - В САМОМ КОНЦЕ, если ни один маршрут не подошел
app.use((req, res) => {
    // Если запрос начинается с /api, возвращаем JSON, иначе HTML
    if (req.path.startsWith('/api')) {
        res.status(404).json({ 
            success: false, 
            message: 'API маршрут не найден' 
        });
    } else {
        res.sendFile(path.join(__dirname, '../public/views/mainPage.html'));
    }
});

module.exports = app;