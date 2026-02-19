// test-db.js
require('dotenv').config();
const { Sequelize } = require('sequelize');

console.log('Параметры подключения:');
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'postgres',
    port: process.env.DB_PORT,
    logging: console.log
  }
);

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✅ Подключение к БД успешно!');
  } catch (error) {
    console.error('❌ Ошибка подключения к БД:');
    console.error('Сообщение:', error.message);
    console.error('Подробнее:', error);
  } finally {
    await sequelize.close();
  }
}

testConnection();