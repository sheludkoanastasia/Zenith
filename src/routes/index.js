// src/routes/index.js
const express = require('express');
const path = require('path');
const router = express.Router();

// Главная страница
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/views/mainPage.html'));
});

// Перенаправление со старых URL
router.get('/app/main/mainPage.html', (req, res) => {
    res.redirect('/');
});

// Маршрут для подключения к курсу по ссылке
router.get('/join/:joinCode', async (req, res) => {
    try {
        const { joinCode } = req.params;
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Подключение к курсу - Zenith</title>
                <style>
                    body {
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        font-family: 'Ysabeau', sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        margin: 0;
                    }
                    .loader-container {
                        text-align: center;
                        color: white;
                    }
                    .loader {
                        width: 50px;
                        height: 50px;
                        border: 3px solid rgba(255,255,255,0.3);
                        border-top: 3px solid white;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 20px auto;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
                <script>
                    const joinCode = '${joinCode}';
                    
                    async function handleJoin() {
                        const token = localStorage.getItem('token');
                        
                        if (token) {
                            try {
                                const response = await fetch('/api/courses/join', {
                                    method: 'POST',
                                    headers: {
                                        'Authorization': 'Bearer ' + token,
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ joinCode })
                                });
                                
                                const data = await response.json();
                                
                                if (data.success) {
                                    window.location.href = '/user';
                                } else {
                                    alert(data.message || 'Ошибка подключения');
                                    window.location.href = '/user';
                                }
                            } catch (err) {
                                alert('Ошибка при подключении');
                                window.location.href = '/user';
                            }
                        } else {
                            localStorage.setItem('pending_join_code', joinCode);
                            window.location.href = '/auth';
                        }
                    }
                    
                    handleJoin();
                </script>
            </head>
            <body>
                <div class="loader-container">
                    <div class="loader"></div>
                    <p>Подключение к курсу...</p>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send('Ошибка сервера');
    }
});

// Маршрут для просмотра курса (студент)
router.get('/course-preview', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/views/coursePreview.html'));
});

// Маршрут для просмотра конструктора курса (студент)
router.get('/course-constructor-preview', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/views/courseConstructorPreview.html'));
});

// Маршрут для создания/редактирования курса (преподаватель)
router.get('/create-course', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/views/createCourse.html'));
});

// Маршрут для конструктора курса (преподаватель)
router.get('/course-constructor', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/views/courseConstructor.html'));
});

module.exports = router;