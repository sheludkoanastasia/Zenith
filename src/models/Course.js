const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Course = sequelize.define('Course', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 200]
      }
    },
    // ПОЛЕ description УДАЛЕНО - у курса нет описания
    cover_image: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'cover_image'
    },
    teacher_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'teacher_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('draft', 'published', 'archived'),
      defaultValue: 'draft'
    },
    students_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'students_count'
    }
  }, {
    tableName: 'courses',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return Course;
};