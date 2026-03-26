'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_exercises_exercise_type" AS ENUM ('matching', 'choice', 'fill_blanks');
    `);

    await queryInterface.createTable('exercises', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      section_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: 'sections',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      exercise_type: {
        type: Sequelize.ENUM('matching', 'choice', 'fill_blanks'),
        allowNull: false,
        defaultValue: 'matching'
      },
      question_text: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      options: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: []
      },
      left_column: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: []
      },
      right_column: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: []
      },
      matches: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: []
      },
      correct_answer: {
        type: Sequelize.JSONB,
        allowNull: true
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

    await queryInterface.addIndex('exercises', ['section_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('exercises');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_exercises_exercise_type";');
  }
};