const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Test = sequelize.define('Test', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    section_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'section_id',
      references: {
        model: 'sections',
        key: 'id'
      }
    },
    exercises: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    passing_score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 70,
      field: 'passing_score'
    },
    deadline: {
      type: DataTypes.DATE,
      allowNull: true
    },
    time_limit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'time_limit'
    },
    student_attempts: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      field: 'student_attempts'
    }
  }, {
    tableName: 'tests',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return Test;
};