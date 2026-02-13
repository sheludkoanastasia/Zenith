const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Корневая папка проекта
const rootDir = path.join(__dirname, '..');
const appDir = path.join(rootDir, 'app');
const mainDir = path.join(appDir, 'main');
const authDir = path.join(appDir, 'authorization');
const imagesDir = path.join(rootDir, 'images');

// ============ СТАТИЧЕСКИЕ ФАЙЛЫ ============

// Для картинок
app.use('/images', express.static(imagesDir));

// Для CSS и JS из корня
app.use(express.static(mainDir));
app.use(express.static(authDir));

// Для доступа через /app/
app.use('/app', express.static(appDir));

// ============ HTML СТРАНИЦЫ ============

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(mainDir, 'mainPage.html'));
});

// Страница авторизации - обрабатываем все варианты с хэшем
app.get('/auth', (req, res) => {
    res.sendFile(path.join(authDir, 'auth.html'));
});

app.get('/auth/', (req, res) => {
    res.sendFile(path.join(authDir, 'auth.html'));
});

// Для обратной совместимости
app.get('/app/main/mainPage.html', (req, res) => {
    res.redirect('/');
});

app.get('/app/authorization/auth.html', (req, res) => {
    res.redirect('/auth');
});

// ============ ЯВНЫЕ МАРШРУТЫ ДЛЯ CSS/JS ============

app.get('/auth.css', (req, res) => {
    res.sendFile(path.join(authDir, 'auth.css'));
});

app.get('/auth.js', (req, res) => {
    res.sendFile(path.join(authDir, 'auth.js'));
});

app.get('/mainPage.css', (req, res) => {
    res.sendFile(path.join(mainDir, 'mainPage.css'));
});

app.get('/mainPage.js', (req, res) => {
    res.sendFile(path.join(mainDir, 'mainPage.js'));
});

// ============ 404 - ВСЕ НА ГЛАВНУЮ ============
app.use((req, res) => {
    res.sendFile(path.join(mainDir, 'mainPage.html'));
});

app.listen(port, () => {
    console.log('=================================');
    console.log(`🚀 SERVER RUNNING ON PORT ${port}`);
    console.log('=================================');
});