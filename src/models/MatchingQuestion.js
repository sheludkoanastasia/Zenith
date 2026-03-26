const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MatchingQuestion = sequelize.define('MatchingQuestion', {
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
    left_column: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    right_column: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    matches: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    }
  }, {
    tableName: 'matching_questions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return MatchingQuestion;
};