const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Theme = sequelize.define('Theme', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    course_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'course_id',
      references: {
        model: 'courses',
        key: 'id'
      }
    },
    order_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'order_index'
    }
  }, {
    tableName: 'themes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return Theme;
};