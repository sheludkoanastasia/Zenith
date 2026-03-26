const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ChoiceQuestion = sequelize.define('ChoiceQuestion', {
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
    question_text: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'question_text'
    },
    options: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    correct_option_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'correct_option_index'
    }
  }, {
    tableName: 'choice_questions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return ChoiceQuestion;
};