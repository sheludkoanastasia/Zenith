// src/routes/userRoutes.js
const express = require('express');
const path = require('path');
const router = express.Router();

// Страница пользователя
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/views/userMainPanel.html'));
});

module.exports = router;