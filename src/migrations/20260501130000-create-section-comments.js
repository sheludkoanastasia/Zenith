'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('section_comments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      section_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'sections',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      parent_comment_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'section_comments',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      text: {
        type: Sequelize.TEXT,
        allowNull: false
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

    await queryInterface.addIndex('section_comments', ['section_id']);
    await queryInterface.addIndex('section_comments', ['parent_comment_id']);
    await queryInterface.addIndex('section_comments', ['created_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('section_comments');
  }
};
