const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Корневая папка проекта (там где папки app, images и server)
const rootDir = path.join(__dirname, '..');

// Пути к вашим папкам
const appDir = path.join(rootDir, 'app');
const mainDir = path.join(appDir, 'main');
const authDir = path.join(appDir, 'authorization');
const imagesDir = path.join(rootDir, 'images');

// ============ ВАЖНО: Правильная настройка статических файлов ============

// 1. Для картинок - работают везде по пути /images/
app.use('/images', express.static(imagesDir));

// 2. Для mainPage.css, mainPage.js - делаем доступными из корня
app.use(express.static(mainDir)); // Теперь /mainPage.css работает!

// 3. Для доступа ко всем файлам app через /app/
app.use('/app', express.static(appDir));

// 4. Явно указываем пути для подстраховки
app.use('/app/main', express.static(mainDir));
app.use('/app/authorization', express.static(authDir));

// ============ HTML СТРАНИЦЫ ============

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(mainDir, 'mainPage.html'));
});

// Страница авторизации (короткая красивая ссылка)
app.get('/auth', (req, res) => {
    res.sendFile(path.join(authDir, 'auth.html'));
});

// Для обратной совместимости
app.get('/app/main/mainPage.html', (req, res) => {
    res.redirect('/');
});

app.get('/app/authorization/auth.html', (req, res) => {
    res.redirect('/auth');
});

app.get('/auth#register', (req, res) => {
    res.redirect('/auth#register');
});

// ============ ЯВНЫЕ МАРШРУТЫ ДЛЯ CSS/JS (НА ВСЯКИЙ СЛУЧАЙ) ============

app.get('/mainPage.css', (req, res) => {
    res.sendFile(path.join(mainDir, 'mainPage.css'));
});

app.get('/mainPage.js', (req, res) => {
    res.sendFile(path.join(mainDir, 'mainPage.js'));
});

app.get('/auth.css', (req, res) => {
    res.sendFile(path.join(authDir, 'auth.css'));
});

app.get('/auth.js', (req, res) => {
    res.sendFile(path.join(authDir, 'auth.js'));
});

// ============ 404 - ВСЕ НА ГЛАВНУЮ ============

app.use((req, res) => {
    res.sendFile(path.join(mainDir, 'mainPage.html'));
});

// ============ ЗАПУСК ============

app.listen(port, () => {
    console.log('=================================');
    console.log(`🚀 SERVER RUNNING ON PORT ${port}`);
    console.log('=================================');
    console.log(`📁 Root directory: ${rootDir}`);
    console.log(`📁 Main directory: ${mainDir}`);
    console.log(`📁 Auth directory: ${authDir}`);
    console.log('=================================');
    console.log(`📍 Главная страница: /`);
    console.log(`📍 Авторизация: /auth`);
    console.log('=================================');
    console.log(`✅ mainPage.css доступен по: /mainPage.css`);
    console.log(`✅ mainPage.js доступен по: /mainPage.js`);
    console.log(`✅ auth.css доступен по: /auth.css`);
    console.log(`✅ auth.js доступен по: /auth.js`);
    console.log('=================================');
});