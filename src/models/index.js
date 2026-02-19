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
    dialectOptions: config.dialectOptions // Добавляем dialectOptions из конфига
  }
);

const db = {};

db.User = require('./User')(sequelize);

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;