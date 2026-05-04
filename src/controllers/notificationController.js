const { Op } = require('sequelize');
const db = require('../models');
const { handleError } = require('../utils/errorHandler');
const notificationService = require('../services/notificationService');

/** Храним уведомления в БД не дольше 7 суток (с 1 мая по 7 мая включительно; с 8 мая — удалены). */
const NOTIFICATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function notificationsFreshnessCutoff() {
  return new Date(Date.now() - NOTIFICATION_RETENTION_MS);
}

async function purgeExpiredNotifications(beforeDate) {
  await db.Notification.destroy({
    where: { created_at: { [Op.lt]: beforeDate } }
  });
}

const ICONS = {
  deadline_reminder: '/images/notificationPage/deadlineTime.svg',
  comment_reply: '/images/notificationPage/reply.svg',
  new_content: '/images/notificationPage/newContent.svg',
  section_edited: '/images/notificationPage/editedSection.svg',
  teacher_new_comment: '/images/notificationPage/newComment.svg',
  teacher_comment_reply: '/images/notificationPage/reply.svg'
};

function iconForType(type) {
  return ICONS[type] || '/images/notificationPage/notification.svg';
}

function serializeDbRow(row, courseName) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: plain.id,
    type: plain.type,
    title: plain.title,
    subtitle: plain.subtitle || '',
    courseId: plain.course_id,
    courseName: courseName || '',
    themeId: plain.theme_id,
    blockId: plain.block_id,
    sectionId: plain.section_id,
    createdAt: plain.created_at,
    icon: iconForType(plain.type),
    synthetic: false
  };
}

async function loadCourseNamesMap(courseIds) {
  const unique = [...new Set(courseIds.filter(Boolean))];
  if (!unique.length) return new Map();
  const courses = await db.Course.findAll({
    where: { id: unique },
    attributes: ['id', 'title']
  });
  return new Map(courses.map((c) => [c.id, c.title]));
}

function buildHref(userRole, item) {
  const isTeacher = userRole === 'teacher';
  const basePreview = isTeacher ? '/teacher/course-preview' : '/course-preview';
  const baseConstructor = isTeacher ? '/teacher/course-constructor-preview' : '/course-constructor-preview';

  if (item.sectionId && item.blockId && item.themeId && item.courseId) {
    return `${baseConstructor}?courseId=${item.courseId}&blockId=${item.blockId}&themeId=${item.themeId}&sectionId=${item.sectionId}`;
  }
  if (item.blockId && item.themeId && item.courseId) {
    return `${baseConstructor}?courseId=${item.courseId}&blockId=${item.blockId}&themeId=${item.themeId}`;
  }
  if (item.themeId && item.courseId && !item.blockId) {
    return `${baseConstructor}?courseId=${item.courseId}&themeId=${item.themeId}`;
  }
  if (item.courseId) {
    return `${basePreview}?id=${item.courseId}`;
  }
  return basePreview;
}

function studentCategoryMatches(category, type) {
  if (!category || category === 'all') return true;
  if (category === 'deadline') return type === 'deadline_reminder';
  if (category === 'comments') return type === 'comment_reply';
  if (category === 'new_content') return type === 'new_content';
  if (category === 'section_change') return type === 'section_edited';
  return true;
}

function sortByDate(items, order) {
  const mult = order === 'oldest' ? 1 : -1;
  return [...items].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return (ta - tb) * mult;
  });
}

/**
 * Список уведомлений как на странице ленты (без href), с теми же фильтрами.
 */
async function loadMergedNotifications(user, { courseFilter, category, dateOrder }) {
  const cutoff = notificationsFreshnessCutoff();
  await purgeExpiredNotifications(cutoff);

  const where = {
    user_id: user.id,
    created_at: { [Op.gte]: cutoff }
  };
  if (courseFilter) {
    where.course_id = courseFilter;
  }

  const rows = await db.Notification.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit: 500
  });

  const courseIds = rows.map((r) => r.course_id).filter(Boolean);
  const nameMap = await loadCourseNamesMap(courseIds);

  let items = rows.map((r) => serializeDbRow(r, nameMap.get(r.course_id) || ''));

  if (user.role === 'student') {
    items = items.filter((it) => studentCategoryMatches(category, it.type));
    if (category === 'all' || category === 'deadline') {
      const deadlines = await notificationService.buildDeadlineRemindersForStudent(user.id);
      let dItems = deadlines;
      if (courseFilter) {
        dItems = dItems.filter((d) => d.courseId === courseFilter);
      }
      if (category !== 'all' && category !== 'deadline') {
        dItems = [];
      }
      items = items.concat(dItems.map((d) => ({
        ...d,
        icon: iconForType(d.type)
      })));
    }
  } else if (user.role === 'teacher') {
    items = items.filter((it) =>
      it.type === 'teacher_new_comment' || it.type === 'teacher_comment_reply'
    );
  }

  return sortByDate(items, dateOrder);
}

function latestCreatedAtIso(items) {
  let latestMs = 0;
  for (const it of items) {
    const t = new Date(it.createdAt).getTime();
    if (!Number.isNaN(t) && t > latestMs) latestMs = t;
  }
  return latestMs ? new Date(latestMs).toISOString() : null;
}

module.exports = {
  bell: async (req, res) => {
    try {
      const user = req.user;
      const items = await loadMergedNotifications(user, {
        courseFilter: null,
        category: 'all',
        dateOrder: 'newest'
      });
      const latestNotificationAt = latestCreatedAtIso(items);
      res.json({
        success: true,
        hasAny: items.length > 0,
        latestNotificationAt
      });
    } catch (error) {
      handleError(res, error, 'Ошибка статуса уведомлений');
    }
  },

  list: async (req, res) => {
    try {
      const user = req.user;
      const dateOrder = req.query.date === 'oldest' ? 'oldest' : 'newest';
      const courseFilter = req.query.courseId && req.query.courseId !== 'all' ? req.query.courseId : null;
      const category = req.query.category || 'all';

      const items = await loadMergedNotifications(user, { courseFilter, category, dateOrder });

      const withHref = items.map((it) => ({
        ...it,
        href: buildHref(user.role, it)
      }));

      let coursesForFilter = [];
      if (user.role === 'student') {
        const enrollments = await db.CourseStudent.findAll({
          where: { student_id: user.id },
          include: [{ model: db.Course, as: 'course', attributes: ['id', 'title'] }]
        });
        coursesForFilter = enrollments
          .map((e) => e.course)
          .filter(Boolean)
          .map((c) => ({ id: c.id, title: c.title }));
      } else if (user.role === 'teacher') {
        const teaching = await db.Course.findAll({
          where: { teacher_id: user.id },
          attributes: ['id', 'title'],
          order: [['title', 'ASC']]
        });
        coursesForFilter = teaching.map((c) => ({ id: c.id, title: c.title }));
      }

      res.json({
        success: true,
        role: user.role,
        notifications: withHref,
        courses: coursesForFilter
      });
    } catch (error) {
      handleError(res, error, 'Ошибка загрузки уведомлений');
    }
  }
};
