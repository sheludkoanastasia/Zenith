console.log('========== ЗАГРУЗКА AUTH CONTROLLER ==========');
console.log('Модели загружены:', !!db);
console.log('User модель загружена:', !!db.User);
console.log('JWT утилиты загружены:', !!generateToken);
console.log('Обработчик ошибок загружен:', !!handleError);
console.log('==============================================');

const { validationResult } = require('express-validator');
const db = require('../models');
const { generateToken } = require('../utils/jwt');
const { handleError, handleValidationError } = require('../utils/errorHandler');

module.exports = {
  register: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return handleValidationError(res, errors);
      }

      const { email, password, role, firstName, lastName, patronymic } = req.body;

      const existingUser = await db.User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Пользователь с таким email уже существует'
        });
      }

      const user = await db.User.create({
        email,
        password,
        role: role || 'student',
        firstName,
        lastName,
        patronymic
      });

      const token = generateToken(user);

      res.status(201).json({
        success: true,
        message: 'Регистрация прошла успешно',
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          patronymic: user.patronymic
        }
      });

    } catch (error) {
      handleError(res, error, 'Ошибка сервера при регистрации');
    }
  },

  login: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return handleValidationError(res, errors);
      }

      const { email, password } = req.body;

      const user = await db.User.findOne({ where: { email } });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Неверный email или пароль'
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Аккаунт деактивирован'
        });
      }

      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Неверный email или пароль'
        });
      }

      await user.update({ lastLogin: new Date() });

      const token = generateToken(user);

      res.json({
        success: true,
        message: 'Вход выполнен успешно',
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          patronymic: user.patronymic
        }
      });

    } catch (error) {
      handleError(res, error, 'Ошибка сервера при входе');
    }
  },

  check: async (req, res) => {
    try {
      res.json({
        success: true,
        user: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          patronymic: req.user.patronymic
        }
      });
    } catch (error) {
      handleError(res, error, 'Ошибка при проверке токена');
    }
  },

  checkEmail: async (req, res) => {
  try {
    console.log('========== ПОЛУЧЕН ЗАПРОС /api/auth/check-email ==========');
    console.log('Тело запроса:', req.body);
    
    const { email } = req.body;
    console.log('Email для проверки:', email);
    
    if (!email) {
      console.log('Ошибка: Email не предоставлен');
      return res.status(400).json({
        success: false,
        message: 'Email не предоставлен'
      });
    }
    
    console.log('Попытка подключения к БД...');
    console.log('Параметры подключения:', {
      DB_NAME: process.env.DB_NAME,
      DB_USER: process.env.DB_USER,
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT
    });
    
    const user = await db.User.findOne({ 
      where: { email },
      attributes: ['id']
    });
    
    console.log('Результат поиска в БД:', user ? 'пользователь НАЙДЕН' : 'пользователь НЕ НАЙДЕН');
    
    res.json({
      success: true,
      exists: !!user
    });
    
  } catch (error) {
    console.error('========== ОШИБКА В checkEmail ==========');
    console.error('Тип ошибки:', error.name);
    console.error('Сообщение:', error.message);
    console.error('Полный стек:', error.stack);
    console.error('=========================================');
    
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
}
};