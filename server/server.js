const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Подключаем папку с картинками
const imagesPath = path.join(__dirname, '../images');
app.use('/images', express.static(imagesPath));

// Подключаем всю папку app целиком - это самое простое решение!
const appPath = path.join(__dirname, '../app');
app.use('/app', express.static(appPath));

// Отдельно обрабатываем корневой маршрут
app.get('/', (req, res) => {
    res.sendFile(path.join(appPath, 'main/mainPage.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Main page: http://localhost:${port}/`);
    console.log(`Main page (direct): http://localhost:${port}/app/main/mainPage.html`);
    console.log(`Auth page: http://localhost:${port}/app/authorization/auth.html`);
});