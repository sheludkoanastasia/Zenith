const db = require('../models');
const { Op } = require('sequelize');

const TYPES = {
  DEADLINE_REMINDER: 'deadline_reminder',
  COMMENT_REPLY: 'comment_reply',
  NEW_CONTENT: 'new_content',
  SECTION_EDITED: 'section_edited',
  TEACHER_NEW_COMMENT: 'teacher_new_comment',
  TEACHER_COMMENT_REPLY: 'teacher_comment_reply'
};

async function getEnrolledStudentIds(courseId) {
  const rows = await db.CourseStudent.findAll({
    where: { course_id: courseId },
    attributes: ['student_id']
  });
  return rows.map((r) => r.student_id);
}

async function bulkNotify(users, payload) {
  if (!users?.length) return;
  const rows = users.map((userId) => ({
    user_id: userId,
    type: payload.type,
    course_id: payload.course_id || null,
    theme_id: payload.theme_id || null,
    block_id: payload.block_id || null,
    section_id: payload.section_id || null,
    title: payload.title,
    subtitle: payload.subtitle || null
  }));
  await db.Notification.bulkCreate(rows);
}

async function notifyStudentsNewSection(courseId, section, blockId, themeId) {
  const studentIds = await getEnrolledStudentIds(courseId);
  const course = await db.Course.findByPk(courseId, { attributes: ['title'] });
  const courseTitle = course?.title || 'Курс';
  await bulkNotify(studentIds, {
    type: TYPES.NEW_CONTENT,
    course_id: courseId,
    theme_id: themeId,
    block_id: blockId,
    section_id: section.id,
    title: 'Новый материал в курсе',
    subtitle: `Раздел «${section.title}» · ${courseTitle}`
  });
}

async function notifyStudentsNewTheme(courseId, theme) {
  const studentIds = await getEnrolledStudentIds(courseId);
  const course = await db.Course.findByPk(courseId, { attributes: ['title'] });
  const courseTitle = course?.title || 'Курс';
  await bulkNotify(studentIds, {
    type: TYPES.NEW_CONTENT,
    course_id: courseId,
    theme_id: theme.id,
    block_id: null,
    section_id: null,
    title: 'Добавлена новая тема',
    subtitle: `«${theme.title}» · ${courseTitle}`
  });
}

async function notifyStudentsNewBlock(courseId, themeId, block) {
  const studentIds = await getEnrolledStudentIds(courseId);
  const course = await db.Course.findByPk(courseId, { attributes: ['title'] });
  const courseTitle = course?.title || 'Курс';
  await bulkNotify(studentIds, {
    type: TYPES.NEW_CONTENT,
    course_id: courseId,
    theme_id: themeId,
    block_id: block.id,
    section_id: null,
    title: 'Добавлен новый блок',
    subtitle: `«${block.title}» · ${courseTitle}`
  });
}

async function notifyStudentsSectionEdited(courseId, section, blockId, themeId) {
  const studentIds = await getEnrolledStudentIds(courseId);
  const course = await db.Course.findByPk(courseId, { attributes: ['title'] });
  const courseTitle = course?.title || 'Курс';
  await bulkNotify(studentIds, {
    type: TYPES.SECTION_EDITED,
    course_id: courseId,
    theme_id: themeId,
    block_id: blockId,
    section_id: section.id,
    title: 'Раздел изменён',
    subtitle: `«${section.title}» — прогресс сброшен, пройдите снова · ${courseTitle}`
  });
}

function isTestPassed(test, attempts) {
  if (!attempts || attempts.length === 0) return false;
  const exercises = test.exercises || [];
  const lastAttempt = attempts[attempts.length - 1];
  const exerciseResults = lastAttempt.exercise_results || {};
  if (exercises.length > 0) {
    return exercises.every((exercise) => exerciseResults[exercise.id]?.isFullyCorrect === true);
  }
  return lastAttempt.max_score > 0 && lastAttempt.total_score >= lastAttempt.max_score;
}

function isDeadlinePassed(deadline) {
  if (!deadline) return false;
  const d = new Date(deadline);
  return !Number.isNaN(d.getTime()) && d.getTime() <= Date.now();
}

async function buildDeadlineRemindersForStudent(studentId) {
  const enrollments = await db.CourseStudent.findAll({
    where: { student_id: studentId },
    attributes: ['course_id']
  });
  const courseIds = enrollments.map((e) => e.course_id);
  if (!courseIds.length) return [];

  const tests = await db.Test.findAll({
    where: {
      deadline: { [Op.gt]: new Date() }
    },
    include: [{
      model: db.Section,
      as: 'section',
      required: true,
      include: [{
        model: db.Block,
        as: 'block',
        required: true,
        include: [{
          model: db.Theme,
          as: 'theme',
          required: true,
          where: { course_id: { [Op.in]: courseIds } },
          include: [{ model: db.Course, as: 'course', attributes: ['id', 'title'] }]
        }]
      }]
    }]
  });

  const items = [];
  for (const test of tests) {
    if (!test.deadline || isDeadlinePassed(test.deadline)) continue;

    const attempts = await db.TestAttempt.findAll({
      where: { test_id: test.id, student_id: studentId },
      order: [['attempt_number', 'ASC']]
    });
    if (isTestPassed(test, attempts)) continue;

    const section = test.section;
    const course = section?.block?.theme?.course;
    if (!course) continue;

    const deadlineLabel = new Date(test.deadline).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    items.push({
      id: `deadline-${test.id}`,
      type: TYPES.DEADLINE_REMINDER,
      title: 'Напоминание о дедлайне',
      subtitle: `«${section.title}» · сдать до ${deadlineLabel}`,
      courseId: course.id,
      courseName: course.title,
      themeId: section.block.theme_id,
      blockId: section.block_id,
      sectionId: section.id,
      createdAt: new Date(test.deadline).toISOString(),
      synthetic: true
    });
  }

  return items;
}

async function notifyAfterSectionComment(section, author, parentCommentId) {
  const course = section?.block?.theme?.course;
  if (!course) return;

  const teacherId = course.teacher_id;
  const courseTitle = course.title || 'Курс';
  const sectionTitle = section.title || 'Раздел';
  const base = {
    course_id: course.id,
    section_id: section.id,
    block_id: section.block_id,
    theme_id: section.block.theme_id
  };

  if (parentCommentId) {
    const parent = await db.SectionComment.findByPk(parentCommentId);
    if (parent && parent.user_id !== author.id) {
      const parentUser = await db.User.findByPk(parent.user_id, { attributes: ['id', 'role'] });
      if (parentUser?.role === 'student') {
        await db.Notification.create({
          user_id: parent.user_id,
          type: TYPES.COMMENT_REPLY,
          ...base,
          title: 'Ответ на ваш комментарий',
          subtitle: `«${sectionTitle}» · ${courseTitle}`
        });
      }
    }
  }

  if (author.role === 'student') {
    await db.Notification.create({
      user_id: teacherId,
      type: parentCommentId ? TYPES.TEACHER_COMMENT_REPLY : TYPES.TEACHER_NEW_COMMENT,
      ...base,
      title: parentCommentId ? 'Ответ в обсуждении раздела' : 'Новый комментарий в разделе',
      subtitle: `«${sectionTitle}» · ${courseTitle}`
    });
  }
}

module.exports = {
  TYPES,
  bulkNotify,
  getEnrolledStudentIds,
  notifyStudentsNewSection,
  notifyStudentsNewTheme,
  notifyStudentsNewBlock,
  notifyStudentsSectionEdited,
  buildDeadlineRemindersForStudent,
  notifyAfterSectionComment
};
