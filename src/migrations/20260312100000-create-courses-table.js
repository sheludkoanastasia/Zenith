'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('courses', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      // ПОЛЕ description УДАЛЕНО - у курса нет описания
      cover_image: {
        type: Sequelize.STRING,
        allowNull: true
      },
      teacher_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      status: {
        type: Sequelize.ENUM('draft', 'published', 'archived'),
        defaultValue: 'draft'
      },
      students_count: {
        type: Sequelize.INTEGER,
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
    await queryInterface.addIndex('courses', ['teacher_id']);
    await queryInterface.addIndex('courses', ['status']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('courses');
    // Удаляем ENUM тип
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_courses_status";');
  }
};