'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      type: {
        type: Sequelize.STRING(64),
        allowNull: false
      },
      course_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'courses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      theme_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'themes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      block_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'blocks', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      section_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'sections', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      title: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      subtitle: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    await queryInterface.addIndex('notifications', ['user_id', 'created_at']);
    await queryInterface.addIndex('notifications', ['course_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notifications');
  }
};
