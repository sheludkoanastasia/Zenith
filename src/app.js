const express = require('express');
const path = require('path');
const app = express();

// Импорт маршрутов
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const apiRoutes = require('./routes/apiRoutes');

// ИМПОРТ МОДЕЛЕЙ БАЗЫ ДАННЫХ - ЭТО НУЖНО ДОБАВИТЬ!
const db = require('./models');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статические файлы
app.use('/public', express.static(path.join(__dirname, '../public')));
app.use('/images', express.static(path.join(__dirname, '../public/images')));

// API маршруты
app.use('/api', apiRoutes);

// HTML маршруты
app.use('/auth', authRoutes);
app.use('/', indexRoutes);
app.use('/user', userRoutes);

// СИНХРОНИЗАЦИЯ БАЗЫ ДАННЫХ - ТЕПЕРЬ db ОПРЕДЕЛЕН!
db.sequelize.sync({ alter: true })
  .then(() => {
    console.log('✅ База данных синхронизирована');
  })
  .catch(err => {
    console.error('❌ Ошибка синхронизации БД:', err);
  });

// 404
app.use((req, res) => {
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