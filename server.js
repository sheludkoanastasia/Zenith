// server.js
const app = require('./src/app');
const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log('=================================');
    console.log(`🚀 Сервер запущен на порту ${port}`);
    console.log(`🌍 http://localhost:${port}`);
    console.log('=================================');
});