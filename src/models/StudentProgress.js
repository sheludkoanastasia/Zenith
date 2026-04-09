const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const StudentProgress = sequelize.define('StudentProgress', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    student_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    section_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'sections',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('not_started', 'in_progress', 'completed'),
      defaultValue: 'not_started'
    },
    attempts_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    best_score: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'student_progress',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return StudentProgress;
};