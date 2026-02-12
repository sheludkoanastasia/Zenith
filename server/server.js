const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Подключаем папку с картинками
const imagesPath = path.join(__dirname, '../images');
app.use('/images', express.static(imagesPath));

// Подключаем папку с HTML, CSS, JS
const frontendPath = path.join(__dirname, '../app/main');
app.use(express.static(frontendPath));

// Вместо app.get('*', ...) используем app.use
app.use((req, res) => {
    res.sendFile(path.join(frontendPath, 'mainPage.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});