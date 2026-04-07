'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Переименовываем колонку questions в exercises
    await queryInterface.renameColumn('tests', 'questions', 'exercises');
    
    // Добавляем колонку deadline если её нет
    const tableDescription = await queryInterface.describeTable('tests');
    if (!tableDescription.deadline) {
      await queryInterface.addColumn('tests', 'deadline', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Откат: переименовываем обратно
    await queryInterface.renameColumn('tests', 'exercises', 'questions');
    
    // Удаляем колонку deadline
    await queryInterface.removeColumn('tests', 'deadline');
  }
};