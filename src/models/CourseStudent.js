const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CourseStudent = sequelize.define('CourseStudent', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    course_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'courses',
        key: 'id'
      }
    },
    student_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('active', 'completed'),
      defaultValue: 'active'
    }
  }, {
    tableName: 'course_students',
    timestamps: true,
    createdAt: 'joined_at',
    updatedAt: 'updated_at'
  });

  return CourseStudent;
};