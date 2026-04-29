'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('student_progress', 'exercise_answers', {
      type: Sequelize.JSONB,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('student_progress', 'exercise_answers');
  }
};