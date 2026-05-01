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
db.CourseStudent = require('./CourseStudent')(sequelize);
db.StudentProgress = require('./StudentProgress')(sequelize);
db.TestAttempt = require('./TestAttempt')(sequelize); // ДОБАВЛЯЕМ МОДЕЛЬ TestAttempt
db.SectionComment = require('./SectionComment')(sequelize);

// ===== НАСТРАИВАЕМ СВЯЗИ =====

// User <-> Course
db.User.hasMany(db.Course, { as: 'courses', foreignKey: 'teacher_id' });
db.Course.belongsTo(db.User, { as: 'teacher', foreignKey: 'teacher_id' });

// User <-> CourseStudent (как студент)
db.User.hasMany(db.CourseStudent, { as: 'enrollments', foreignKey: 'student_id' });
db.CourseStudent.belongsTo(db.User, { as: 'student', foreignKey: 'student_id' });

// Course <-> CourseStudent
db.Course.hasMany(db.CourseStudent, { as: 'enrollments', foreignKey: 'course_id' });
db.CourseStudent.belongsTo(db.Course, { as: 'course', foreignKey: 'course_id' });

// Связь many-to-many через CourseStudent
db.User.belongsToMany(db.Course, {
  through: db.CourseStudent,
  as: 'studentCourses',
  foreignKey: 'student_id',
  otherKey: 'course_id'
});
db.Course.belongsToMany(db.User, {
  through: db.CourseStudent,
  as: 'students',
  foreignKey: 'course_id',
  otherKey: 'student_id'
});

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

// User <-> StudentProgress
db.User.hasMany(db.StudentProgress, { as: 'progress', foreignKey: 'student_id' });
db.StudentProgress.belongsTo(db.User, { as: 'student', foreignKey: 'student_id' });

// Section <-> StudentProgress
db.Section.hasMany(db.StudentProgress, { as: 'progress', foreignKey: 'section_id' });
db.StudentProgress.belongsTo(db.Section, { as: 'section', foreignKey: 'section_id' });

// ДОБАВЛЯЕМ СВЯЗИ ДЛЯ TestAttempt
// Test <-> TestAttempt
db.Test.hasMany(db.TestAttempt, { as: 'attempts', foreignKey: 'test_id', onDelete: 'CASCADE' });
db.TestAttempt.belongsTo(db.Test, { as: 'test', foreignKey: 'test_id' });

// User <-> TestAttempt
db.User.hasMany(db.TestAttempt, { as: 'testAttempts', foreignKey: 'student_id' });
db.TestAttempt.belongsTo(db.User, { as: 'student', foreignKey: 'student_id' });

// Section <-> SectionComment
db.Section.hasMany(db.SectionComment, { as: 'comments', foreignKey: 'section_id', onDelete: 'CASCADE' });
db.SectionComment.belongsTo(db.Section, { as: 'section', foreignKey: 'section_id' });

// User <-> SectionComment
db.User.hasMany(db.SectionComment, { as: 'sectionComments', foreignKey: 'user_id' });
db.SectionComment.belongsTo(db.User, { as: 'author', foreignKey: 'user_id' });

// Threaded comments
db.SectionComment.hasMany(db.SectionComment, { as: 'replies', foreignKey: 'parent_comment_id', onDelete: 'CASCADE' });
db.SectionComment.belongsTo(db.SectionComment, { as: 'parent', foreignKey: 'parent_comment_id' });

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;