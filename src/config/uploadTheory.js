const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Создаем папку для временных файлов
const uploadDir = path.join(__dirname, '../../public/uploads/theory');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'theory-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /\.(pdf|docx|txt)$/i;
    const extname = allowedTypes.test(path.extname(file.originalname));
    
    if (extname) {
        cb(null, true);
    } else {
        cb(new Error('Только PDF, DOCX и TXT файлы разрешены'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: fileFilter
});

module.exports = upload;