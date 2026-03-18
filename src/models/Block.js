const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Block = sequelize.define('Block', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    theme_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'theme_id',
      references: {
        model: 'themes',
        key: 'id'
      }
    },
    order_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'order_index'
    },
    type: {
      type: DataTypes.ENUM('text', 'task'),
      defaultValue: 'text'
    }
  }, {
    tableName: 'blocks',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return Block;
};