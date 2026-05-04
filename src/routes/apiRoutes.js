const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const validationMiddleware = require('../middleware/validationMiddleware');
const studentRoutes = require('./studentRoutes');
const userProfileController = require('../controllers/userProfileController');
const notificationController = require('../controllers/notificationController');
const uploadAvatar = require('../config/uploadAvatar');

router.post('/auth/register',
  validationMiddleware.validateRegistration,
  authController.register
);

router.post('/auth/login',
  validationMiddleware.validateLogin,
  authController.login
);

router.get('/auth/check',
  authMiddleware.verifyToken,
  authController.check
);

router.get('/notifications/bell',
  authMiddleware.verifyToken,
  notificationController.bell
);

router.get('/notifications',
  authMiddleware.verifyToken,
  notificationController.list
);

router.post('/auth/check-email', authController.checkEmail);

router.get('/users/me',
  authMiddleware.verifyToken,
  userProfileController.getMe
);

router.patch('/users/me/email',
  authMiddleware.verifyToken,
  userProfileController.updateEmail
);

router.patch('/users/me/password',
  authMiddleware.verifyToken,
  userProfileController.updatePassword
);

router.delete('/users/me',
  authMiddleware.verifyToken,
  userProfileController.deleteAccount
);

router.patch('/users/me',
  authMiddleware.verifyToken,
  (req, res, next) => {
    uploadAvatar.single('avatar')(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'Неверный файл аватара (нужен JPEG или PNG)'
        });
      }
      next();
    });
  },
  userProfileController.updateProfile
);

router.use('/student', studentRoutes);

router.get('/test', (req, res) => {
  res.json({ success: true, message: 'API работает!' });
});

module.exports = router;