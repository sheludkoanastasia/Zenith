const express = require('express');
const path = require('path');
const fs = require('fs'); // ДОБАВИТЬ для проверки существования файлов
const app = express();

// Импорт маршрутов
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const apiRoutes = require('./routes/apiRoutes');
const courseRoutes = require('./routes/courseRoutes');
const sectionRoutes = require('./routes/sectionRoutes');

const db = require('./models');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статические файлы
app.use('/public', express.static(path.join(__dirname, '../public')));
app.use('/images', express.static(path.join(__dirname, '../public/images')));

// API маршруты
app.use('/api', apiRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api', sectionRoutes);

// HTML маршруты - ВАЖНО: эти маршруты должны обрабатываться до статического файла 404
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/teacher', teacherRoutes);
app.use('/', indexRoutes);

// Синхронизация базы данных
db.sequelize.sync({ alter: true })
  .then(() => {
    console.log('✅ База данных синхронизирована');
  })
  .catch(err => {
    console.error('❌ Ошибка синхронизации БД:', err);
  });

// 404 - УБРАТЬ перенаправление на mainPage для всех маршрутов
app.use((req, res) => {
    // Проверяем, не является ли запрос API
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ 
            success: false, 
            message: 'API маршрут не найден' 
        });
    }
    
    // Проверяем, существует ли HTML файл по этому пути
    const possibleViews = [
        path.join(__dirname, '../public/views', req.path + '.html'),
        path.join(__dirname, '../public/views', req.path.split('/').pop() + '.html')
    ];
    
    for (const viewPath of possibleViews) {
        if (fs.existsSync(viewPath)) {
            return res.sendFile(viewPath);
        }
    }
    
    // Если ничего не найдено, отправляем 404
    res.status(404).sendFile(path.join(__dirname, '../public/views/404.html'));
});

module.exports = app;