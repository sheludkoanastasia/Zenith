const { Sequelize } = require('sequelize');
const config = require('../config/database')[process.env.NODE_ENV || 'development'];

console.log('Используемая конфигурация:', {
  database: config.database,
  username: config.username,
  host: config.host,
  dialect: config.dialect,
  ssl: config.dialectOptions?.ssl ? 'enabled' : 'disabled'
});

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    dialect: config.dialect,
    port: config.port,
    logging: console.log,
    dialectOptions: config.dialectOptions
  }
);

const db = {};

// Импортируем модели
db.User = require('./User')(sequelize);
db.Course = require('./Course')(sequelize);
db.Theme = require('./Theme')(sequelize);
db.Block = require('./Block')(sequelize);

// ===== НАСТРАИВАЕМ СВЯЗИ МЕЖДУ МОДЕЛЯМИ =====

// Связи User (преподаватель) с Course
db.User.hasMany(db.Course, { 
  as: 'courses', 
  foreignKey: 'teacher_id' 
});

db.Course.belongsTo(db.User, { 
  as: 'teacher', 
  foreignKey: 'teacher_id' 
});

// Связи Course с Theme
db.Course.hasMany(db.Theme, { 
  as: 'themes', 
  foreignKey: 'course_id',
  onDelete: 'CASCADE' // Если удаляем курс, удаляются все его темы
});

db.Theme.belongsTo(db.Course, { 
  as: 'course', 
  foreignKey: 'course_id' 
});

// Связи Theme с Block
db.Theme.hasMany(db.Block, { 
  as: 'blocks', 
  foreignKey: 'theme_id',
  onDelete: 'CASCADE' // Если удаляем тему, удаляются все её блоки
});

db.Block.belongsTo(db.Theme, { 
  as: 'theme', 
  foreignKey: 'theme_id' 
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;