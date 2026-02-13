const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Определяем корень проекта
// Если server.js в папке server/
const projectRoot = path.join(__dirname, '..');
// Если server.js в корне:
// const projectRoot = __dirname;

console.log('Project root:', projectRoot);
console.log('__dirname:', __dirname);

// Подключаем папки относительно корня проекта
app.use('/images', express.static(path.join(projectRoot, 'images')));
app.use('/app', express.static(path.join(projectRoot, 'app')));

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(projectRoot, 'app/main/mainPage.html'));
});

// Обработка прямых ссылок на HTML
app.get('*.html', (req, res) => {
    const filePath = path.join(projectRoot, req.path);
    res.sendFile(filePath);
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});