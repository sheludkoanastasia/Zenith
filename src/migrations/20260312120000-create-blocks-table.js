'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('blocks', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      theme_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'themes',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      order_index: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      type: {
        type: Sequelize.ENUM('text', 'task'),
        defaultValue: 'text'
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

    // Индексы
    await queryInterface.addIndex('blocks', ['theme_id']);
    await queryInterface.addIndex('blocks', ['order_index']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('blocks');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_blocks_type";');
  }
};