// migrations/20260427000000-add-version-to-sections-and-progress.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Добавляем колонку version в sections
    await queryInterface.addColumn('sections', 'version', {
      type: Sequelize.INTEGER,
      defaultValue: 1,
      allowNull: false
    });

    // 2. Добавляем колонку section_version в student_progress
    await queryInterface.addColumn('student_progress', 'section_version', {
      type: Sequelize.INTEGER,
      defaultValue: 1,
      allowNull: false
    });

    // 3. Создаём индекс для быстрого поиска
    await queryInterface.addIndex('student_progress', ['student_id', 'section_id', 'section_version']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('sections', 'version');
    await queryInterface.removeColumn('student_progress', 'section_version');
  }
};