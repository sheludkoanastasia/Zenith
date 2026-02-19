const db = require('../models');
const jwtUtils = require('../utils/jwt'); // Импортируем весь объект, а не конкретную функцию

module.exports = {
  verifyToken: async (req, res, next) => {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ 
          success: false, 
          message: 'Токен не предоставлен' 
        });
      }

      // Используем jwtUtils.verifyToken, а не локальную функцию
      const decoded = jwtUtils.verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ 
          success: false, 
          message: 'Недействительный токен' 
        });
      }

      const user = await db.User.findByPk(decoded.id);
      if (!user || !user.isActive) {
        return res.status(401).json({ 
          success: false, 
          message: 'Пользователь не найден или деактивирован' 
        });
      }

      req.user = user;
      req.userId = decoded.id;
      next();
    } catch (error) {
      console.error('Ошибка проверки токена:', error);
      res.status(401).json({ 
        success: false, 
        message: 'Ошибка авторизации' 
      });
    }
  },

  checkRole: (roles) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Не авторизован' 
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Недостаточно прав' 
        });
      }

      next();
    };
  }
};