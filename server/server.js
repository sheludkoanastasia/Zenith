const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Определяем пути относительно текущего файла
const rootDir = path.join(__dirname, '..'); // поднимаемся на уровень выше из папки server/
const appDir = path.join(rootDir, 'app');
const mainDir = path.join(appDir, 'main');
const imagesDir = path.join(rootDir, 'images');

// Подключаем статические файлы
app.use('/images', express.static(imagesDir));
app.use('/app', express.static(appDir));
app.use(express.static(mainDir)); // для прямого доступа к mainPage.css, mainPage.js

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(mainDir, 'mainPage.html'));
});

// Для обратной совместимости - редирект со старого пути
app.get('/app/main/mainPage.html', (req, res) => {
    res.redirect('/');
});

// Страница авторизации (если нужен прямоsй доступ)
app.get('/auth', (req, res) => {
    res.sendFile(path.join(appDir, 'authorization/auth.html'));
});

// 404 - все что не найдено, отдаем главную (для SPA)
app.use((req, res) => {
    res.sendFile(path.join(mainDir, 'mainPage.html'));
});

app.listen(port, () => {
    console.log(`🚀 Server is running on port ${port}`);
    console.log(`📍 Главная страница: http://localhost:${port}/`);
    console.log(`📍 Авторизация: http://localhost:${port}/auth`);
    console.log(`📁 App directory: ${appDir}`);
});