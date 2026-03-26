const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TheoryContent = sequelize.define('TheoryContent', {
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
    text: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    file_url: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'file_url'
    }
  }, {
    tableName: 'theory_contents',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return TheoryContent;
};