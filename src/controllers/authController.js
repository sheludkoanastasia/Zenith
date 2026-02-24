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
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email не предоставлен'
        });
      }
      
      const user = await db.User.findOne({ 
        where: { email },
        attributes: ['id']
      });
      
      res.json({
        success: true,
        exists: !!user
      });
      
    } catch (error) {
      handleError(res, error, 'Ошибка сервера при проверке email');
    }
  }
};