const db = require('../models');
const { handleError } = require('../utils/errorHandler');
const { toPublicUser } = require('../utils/userSerializer');

async function getSectionWithCourse(sectionId) {
  return db.Section.findByPk(sectionId, {
    include: [{
      model: db.Block,
      as: 'block',
      include: [{
        model: db.Theme,
        as: 'theme',
        include: [{ model: db.Course, as: 'course' }]
      }]
    }]
  });
}

async function canAccessSection(section, user) {
  const course = section?.block?.theme?.course;
  if (!course) return false;

  if (user.role === 'teacher') {
    return course.teacher_id === user.id;
  }

  if (user.role === 'student') {
    const enrollment = await db.CourseStudent.findOne({
      where: {
        course_id: course.id,
        student_id: user.id
      }
    });
    return Boolean(enrollment);
  }

  return false;
}

async function isSectionDiscussionUnlocked(section, user) {
  if (user.role === 'teacher') return true;
  if (user.role !== 'student') return false;

  if (section.type === 'test') {
    const test = await db.Test.findOne({ where: { section_id: section.id } });
    if (!test) return false;

    const attemptsCount = await db.TestAttempt.count({
      where: {
        test_id: test.id,
        student_id: user.id
      }
    });

    return attemptsCount > 0;
  }

  const progress = await db.StudentProgress.findOne({
    where: {
      section_id: section.id,
      student_id: user.id,
      status: 'completed'
    }
  });

  return Boolean(progress);
}

function serializeComment(comment) {
  const plain = comment.get ? comment.get({ plain: true }) : comment;
  return {
    id: plain.id,
    sectionId: plain.section_id,
    parentCommentId: plain.parent_comment_id || null,
    text: plain.text,
    createdAt: plain.created_at,
    updatedAt: plain.updated_at,
    author: toPublicUser(plain.author)
  };
}

function buildCommentTree(comments) {
  const items = comments.map(serializeComment).map(comment => ({ ...comment, replies: [] }));
  const byId = new Map(items.map(comment => [comment.id, comment]));
  const roots = [];

  items.forEach(comment => {
    if (comment.parentCommentId && byId.has(comment.parentCommentId)) {
      byId.get(comment.parentCommentId).replies.push(comment);
    } else {
      roots.push(comment);
    }
  });

  return roots;
}

async function collectCommentBranchIds(rootId) {
  const ids = [rootId];
  const replies = await db.SectionComment.findAll({
    where: { parent_comment_id: rootId },
    attributes: ['id']
  });

  for (const reply of replies) {
    const childIds = await collectCommentBranchIds(reply.id);
    ids.push(...childIds);
  }

  return ids;
}

module.exports = {
  listComments: async (req, res) => {
    try {
      const { sectionId } = req.params;
      const section = await getSectionWithCourse(sectionId);

      if (!section) {
        return res.status(404).json({ success: false, message: 'Раздел не найден' });
      }

      const hasAccess = await canAccessSection(section, req.user);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Нет доступа к обсуждению раздела' });
      }

      const unlocked = await isSectionDiscussionUnlocked(section, req.user);
      if (!unlocked) {
        return res.json({
          success: true,
          unlocked: false,
          message: 'После решения задания будет доступно обсуждение раздела',
          comments: []
        });
      }

      const comments = await db.SectionComment.findAll({
        where: { section_id: sectionId },
        order: [['created_at', 'ASC']],
        include: [{
          model: db.User,
          as: 'author',
          attributes: [
            'id',
            'email',
            'role',
            'firstName',
            'lastName',
            'patronymic',
            'avatarUrl'
          ]
        }]
      });

      res.json({
        success: true,
        unlocked: true,
        comments: buildCommentTree(comments)
      });
    } catch (error) {
      handleError(res, error, 'Ошибка загрузки комментариев');
    }
  },

  createComment: async (req, res) => {
    try {
      const { sectionId } = req.params;
      const text = String(req.body.text || '').trim();
      const parentCommentId = req.body.parentCommentId || null;

      if (!text) {
        return res.status(400).json({ success: false, message: 'Введите текст комментария' });
      }

      if (text.length > 3000) {
        return res.status(400).json({ success: false, message: 'Комментарий не должен превышать 3000 символов' });
      }

      const section = await getSectionWithCourse(sectionId);
      if (!section) {
        return res.status(404).json({ success: false, message: 'Раздел не найден' });
      }

      const hasAccess = await canAccessSection(section, req.user);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Нет доступа к обсуждению раздела' });
      }

      const unlocked = await isSectionDiscussionUnlocked(section, req.user);
      if (!unlocked) {
        return res.status(403).json({
          success: false,
          message: 'После решения задания будет доступно обсуждение раздела'
        });
      }

      if (parentCommentId) {
        const parent = await db.SectionComment.findOne({
          where: {
            id: parentCommentId,
            section_id: sectionId
          }
        });

        if (!parent) {
          return res.status(400).json({ success: false, message: 'Комментарий для ответа не найден' });
        }
      }

      await db.SectionComment.create({
        section_id: sectionId,
        user_id: req.user.id,
        parent_comment_id: parentCommentId,
        text
      });

      res.status(201).json({
        success: true,
        message: 'Комментарий добавлен'
      });
    } catch (error) {
      handleError(res, error, 'Ошибка добавления комментария');
    }
  },

  deleteComment: async (req, res) => {
    try {
      const { sectionId, commentId } = req.params;

      const section = await getSectionWithCourse(sectionId);
      if (!section) {
        return res.status(404).json({ success: false, message: 'Раздел не найден' });
      }

      const hasAccess = await canAccessSection(section, req.user);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Нет доступа к обсуждению раздела' });
      }

      const comment = await db.SectionComment.findOne({
        where: {
          id: commentId,
          section_id: sectionId
        }
      });

      if (!comment) {
        return res.status(404).json({ success: false, message: 'Комментарий не найден' });
      }

      if (comment.user_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Можно удалить только свой комментарий' });
      }

      const branchIds = await collectCommentBranchIds(commentId);
      for (const id of branchIds.reverse()) {
        await db.SectionComment.destroy({ where: { id } });
      }

      res.json({
        success: true,
        message: 'Комментарий удалён'
      });
    } catch (error) {
      handleError(res, error, 'Ошибка удаления комментария');
    }
  }
};
