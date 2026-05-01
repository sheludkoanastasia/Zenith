const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id'
    },
    type: {
      type: DataTypes.STRING(64),
      allowNull: false
    },
    course_id: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'course_id'
    },
    theme_id: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'theme_id'
    },
    block_id: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'block_id'
    },
    section_id: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'section_id'
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    subtitle: {
      type: DataTypes.STRING(500),
      allowNull: true
    }
  }, {
    tableName: 'notifications',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  return Notification;
};
