const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FillBlanksQuestion = sequelize.define('FillBlanksQuestion', {
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
    sentence: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    words: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    correct_mapping: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      field: 'correct_mapping'
    }
  }, {
    tableName: 'fill_blanks_questions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return FillBlanksQuestion;
};