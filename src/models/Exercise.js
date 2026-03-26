const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Exercise = sequelize.define('Exercise', {
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
    exercise_type: {
      type: DataTypes.ENUM('matching', 'choice', 'fill_blanks'),
      allowNull: false,
      field: 'exercise_type',
      defaultValue: 'matching'
    },
    question_text: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'question_text'
    },
    options: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: []
    },
    left_column: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      field: 'left_column'
    },
    right_column: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      field: 'right_column'
    },
    matches: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: []
    },
    correct_answer: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'correct_answer'
    }
  }, {
    tableName: 'exercises',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return Exercise;
};