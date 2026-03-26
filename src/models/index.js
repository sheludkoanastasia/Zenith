const { Sequelize } = require('sequelize');
const config = require('../config/database')[process.env.NODE_ENV || 'development'];

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    dialect: config.dialect,
    port: config.port,
    logging: console.log,
    dialectOptions: config.dialectOptions
  }
);

const db = {};

// Импортируем модели
db.User = require('./User')(sequelize);
db.Course = require('./Course')(sequelize);
db.Theme = require('./Theme')(sequelize);
db.Block = require('./Block')(sequelize);
db.Section = require('./Section')(sequelize);
db.TheoryContent = require('./TheoryContent')(sequelize);
db.Exercise = require('./Exercise')(sequelize);
db.Test = require('./Test')(sequelize);

// ===== НАСТРАИВАЕМ СВЯЗИ =====

// User <-> Course
db.User.hasMany(db.Course, { as: 'courses', foreignKey: 'teacher_id' });
db.Course.belongsTo(db.User, { as: 'teacher', foreignKey: 'teacher_id' });

// Course <-> Theme
db.Course.hasMany(db.Theme, { as: 'themes', foreignKey: 'course_id', onDelete: 'CASCADE' });
db.Theme.belongsTo(db.Course, { as: 'course', foreignKey: 'course_id' });

// Theme <-> Block
db.Theme.hasMany(db.Block, { as: 'blocks', foreignKey: 'theme_id', onDelete: 'CASCADE' });
db.Block.belongsTo(db.Theme, { as: 'theme', foreignKey: 'theme_id' });

// Block <-> Section
db.Block.hasMany(db.Section, { as: 'sections', foreignKey: 'block_id', onDelete: 'CASCADE' });
db.Section.belongsTo(db.Block, { as: 'block', foreignKey: 'block_id' });

// Section <-> TheoryContent
db.Section.hasOne(db.TheoryContent, { as: 'theoryContent', foreignKey: 'section_id', onDelete: 'CASCADE' });
db.TheoryContent.belongsTo(db.Section, { as: 'section', foreignKey: 'section_id' });

// Section <-> Exercise
db.Section.hasOne(db.Exercise, { as: 'exercise', foreignKey: 'section_id', onDelete: 'CASCADE' });
db.Exercise.belongsTo(db.Section, { as: 'section', foreignKey: 'section_id' });

// Section <-> Test
db.Section.hasOne(db.Test, { as: 'test', foreignKey: 'section_id', onDelete: 'CASCADE' });
db.Test.belongsTo(db.Section, { as: 'section', foreignKey: 'section_id' });

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;