const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SectionComment = sequelize.define('SectionComment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    section_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'sections',
        key: 'id'
      }
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    parent_comment_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'section_comments',
        key: 'id'
      }
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, {
    tableName: 'section_comments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return SectionComment;
};
