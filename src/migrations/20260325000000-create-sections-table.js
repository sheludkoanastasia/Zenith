'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Создаем ENUM тип для типа раздела
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_sections_type" AS ENUM ('theory', 'matching', 'choice', 'fill_blanks');
    `);

    await queryInterface.createTable('sections', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      block_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'blocks',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
          notEmpty: true
        }
      },
      type: {
        type: Sequelize.ENUM('theory', 'matching', 'choice', 'fill_blanks'),
        allowNull: false
      },
      order_index: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Добавляем индексы для быстрого поиска
    await queryInterface.addIndex('sections', ['block_id']);
    await queryInterface.addIndex('sections', ['order_index']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('sections');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_sections_type";');
  }
};