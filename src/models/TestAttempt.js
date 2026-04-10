const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TestAttempt = sequelize.define('TestAttempt', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    test_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'test_id',
      references: {
        model: 'tests',
        key: 'id'
      }
    },
    student_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'student_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    attempt_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'attempt_number'
    },
    total_score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'total_score'
    },
    max_score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'max_score'
    },
    exercise_results: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'exercise_results'
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'completed_at'
    }
  }, {
    tableName: 'test_attempts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return TestAttempt;
};