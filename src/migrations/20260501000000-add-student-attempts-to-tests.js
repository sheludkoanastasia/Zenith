'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('tests');

    if (!tableDescription.student_attempts) {
      await queryInterface.addColumn('tests', 'student_attempts', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {}
      });
    }
  },

  down: async (queryInterface) => {
    const tableDescription = await queryInterface.describeTable('tests');

    if (tableDescription.student_attempts) {
      await queryInterface.removeColumn('tests', 'student_attempts');
    }
  }
};
