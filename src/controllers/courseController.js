const { Op } = require('sequelize');
const db = require('../models');
const { handleError } = require('../utils/errorHandler');
const notificationService = require('../services/notificationService');

// Добавьте эту функцию в начало файла, после require
function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function isStudentSectionCompleted(section, studentId) {
  const progress = await db.StudentProgress.findOne({
    where: {
      student_id: studentId,
      section_id: section.id
    }
  });

  if (progress && progress.section_version !== section.version) {
    return false;
  }

  if (section.type === 'theory' || section.type === 'exercise') {
    return progress?.status === 'completed';
  }

  if (section.type === 'test') {
    const test = await db.Test.findOne({ where: { section_id: section.id } });
    if (!test) return false;

    const attemptsCount = await db.TestAttempt.count({
      where: {
        test_id: test.id,
        student_id: studentId
      }
    });

    return attemptsCount > 0;
  }

  return false;
}

async function buildStudentCourseProgress(courseId, studentId) {
  const themes = await db.Theme.findAll({
    where: { course_id: courseId },
    include: [{ model: db.Block, as: 'blocks' }],
    order: [['order_index', 'ASC']]
  });

  let totalBlockPercent = 0;
  let totalBlocks = 0;
  const themesWithProgress = [];

  for (const theme of themes) {
    const themeData = theme.get({ plain: true });
    const blocksWithProgress = [];

    for (const block of theme.blocks || []) {
      const blockData = block.get({ plain: true });
      const sections = await db.Section.findAll({
        where: { block_id: block.id },
        order: [['order_index', 'ASC']]
      });

      const totalSections = sections.length;
      let completedSections = 0;

      if (totalSections > 0) {
        const completionResults = await Promise.all(
          sections.map(section => isStudentSectionCompleted(section, studentId))
        );
        completedSections = completionResults.filter(Boolean).length;
      }

      const percent = totalSections > 0
        ? Math.round((completedSections / totalSections) * 100)
        : 0;

      totalBlockPercent += percent;
      totalBlocks++;

      blocksWithProgress.push({
        ...blockData,
        progressPercent: percent
      });
    }

    themesWithProgress.push({
      ...themeData,
      blocks: blocksWithProgress
    });
  }

  return {
    themes: themesWithProgress,
    progressPercent: totalBlocks > 0 ? Math.round(totalBlockPercent / totalBlocks) : 0
  };
}

function getExerciseMaxFromTestExercise(exercise) {
  return exercise?.scoring?.firstAttempt ?? 100;
}

function getTestMaxScoreFromExercises(test) {
  const exercises = test?.exercises || [];
  if (!exercises.length) return 100;
  return exercises.reduce((sum, e) => sum + getExerciseMaxFromTestExercise(e), 0);
}

function computeTeacherSectionMetrics(section, progress, test, attempts) {
  const versionOk = !progress || Number(progress.section_version) === Number(section.version || 1);
  const sectionPlain = section.get ? section.get({ plain: true }) : section;
  const type = sectionPlain.type;

  if (type === 'theory') {
    const maxPoints = 100;
    const completed = versionOk && progress?.status === 'completed';
    const points = completed ? maxPoints : 0;
    return {
      points,
      maxPoints,
      completed,
      displayPercent: completed ? 100 : 0
    };
  }

  if (type === 'exercise') {
    const maxPoints = 100;
    const completed = versionOk && progress?.status === 'completed';
    const raw = versionOk ? Math.min(maxPoints, Number(progress?.best_score) || 0) : 0;
    const points = raw;
    const displayPercent = completed
      ? 100
      : (maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0);
    return { points, maxPoints, completed, displayPercent };
  }

  if (type === 'test') {
    const maxFromTest = test ? getTestMaxScoreFromExercises(test) : 100;
    if (!versionOk || !test) {
      return {
        points: 0,
        maxPoints: maxFromTest,
        completed: false,
        displayPercent: 0
      };
    }
    const list = attempts || [];
    if (!list.length) {
      return {
        points: 0,
        maxPoints: maxFromTest,
        completed: false,
        displayPercent: 0
      };
    }
    const bestScore = Math.max(...list.map(a => Number(a.total_score) || 0));
    const attemptMax = Math.max(...list.map(a => Number(a.max_score) || 0), 0);
    const denom = attemptMax > 0 ? attemptMax : maxFromTest;
    const completed = list.length > 0;
    const displayPercent = denom > 0 ? Math.round((bestScore / denom) * 100) : 0;
    return {
      points: bestScore,
      maxPoints: denom,
      completed,
      displayPercent
    };
  }

  return { points: 0, maxPoints: 0, completed: false, displayPercent: 0 };
}

async function buildTeacherCoursePerformance(courseId) {
  const themes = await db.Theme.findAll({
    where: { course_id: courseId },
    include: [{ model: db.Block, as: 'blocks' }],
    order: [['order_index', 'ASC']]
  });

  const blockIds = [];
  themes.forEach((t) => {
    (t.blocks || []).forEach((b) => blockIds.push(b.id));
  });

  const sections = blockIds.length
    ? await db.Section.findAll({
        where: { block_id: { [Op.in]: blockIds } },
        order: [['order_index', 'ASC']]
      })
    : [];

  const sectionByBlock = new Map();
  sections.forEach((s) => {
    const bid = s.block_id;
    if (!sectionByBlock.has(bid)) sectionByBlock.set(bid, []);
    sectionByBlock.get(bid).push(s);
  });

  const sectionIds = sections.map((s) => s.id);
  const tests = sectionIds.length
    ? await db.Test.findAll({ where: { section_id: { [Op.in]: sectionIds } } })
    : [];
  const testBySectionId = new Map(tests.map((t) => [t.section_id, t]));

  const enrollments = await db.CourseStudent.findAll({
    where: { course_id: courseId },
    include: [
      {
        model: db.User,
        as: 'student',
        attributes: [
          'id',
          'firstName',
          'lastName',
          'patronymic',
          'avatarUrl',
          'educationalInstitution',
          'faculty',
          'studyCourse',
          'studyGroup'
        ]
      }
    ],
    order: [['joined_at', 'DESC']]
  });

  const studentIds = enrollments.map((e) => e.student_id);

  let allProgress = [];
  let allAttempts = [];
  if (studentIds.length && sectionIds.length) {
    allProgress = await db.StudentProgress.findAll({
      where: {
        student_id: { [Op.in]: studentIds },
        section_id: { [Op.in]: sectionIds }
      }
    });
    const testIds = tests.map((t) => t.id);
    if (testIds.length) {
      allAttempts = await db.TestAttempt.findAll({
        where: {
          student_id: { [Op.in]: studentIds },
          test_id: { [Op.in]: testIds }
        }
      });
    }
  }

  const progressMap = new Map();
  allProgress.forEach((p) => {
    progressMap.set(`${p.student_id}:${p.section_id}`, p);
  });

  const attemptsMap = new Map();
  allAttempts.forEach((a) => {
    const k = `${a.student_id}:${a.test_id}`;
    if (!attemptsMap.has(k)) attemptsMap.set(k, []);
    attemptsMap.get(k).push(a);
  });

  const sectionMaxPoints = new Map();
  let courseMaxPoints = 0;
  sections.forEach((sec) => {
    const test = testBySectionId.get(sec.id);
    let max = 100;
    if (sec.type === 'test' && test) {
      max = getTestMaxScoreFromExercises(test);
    }
    sectionMaxPoints.set(sec.id, max);
    courseMaxPoints += max;
  });

  const studentsPayload = enrollments.map((enrollment) => {
    const studentRow = enrollment.student;
    const sPlain = studentRow.get ? studentRow.get({ plain: true }) : studentRow;
    const sid = sPlain.id;

    const themesOut = themes.map((theme) => {
      const blocksRaw = [...(theme.blocks || [])].sort(
        (a, b) => (a.order_index || 0) - (b.order_index || 0)
      );

      const blocksOut = blocksRaw.map((block) => {
        const bPlain = block.get ? block.get({ plain: true }) : block;
        const secs = (sectionByBlock.get(bPlain.id) || []).sort(
          (a, b) => (a.order_index || 0) - (b.order_index || 0)
        );

        let completedCount = 0;
        const sectionsOut = secs.map((section) => {
          const secPlain = section.get ? section.get({ plain: true }) : section;
          const maxPts = sectionMaxPoints.get(secPlain.id) || 100;
          const progress = progressMap.get(`${sid}:${secPlain.id}`);
          const test = testBySectionId.get(secPlain.id);
          const attKey = test ? `${sid}:${test.id}` : null;
          const attempts = attKey ? attemptsMap.get(attKey) || [] : [];
          const metrics = computeTeacherSectionMetrics(section, progress, test, attempts);
          if (metrics.completed) completedCount++;

          return {
            id: secPlain.id,
            title: secPlain.title,
            type: secPlain.type,
            order_index: secPlain.order_index,
            points: metrics.points,
            maxPoints: maxPts,
            progressPercent: metrics.displayPercent,
            completed: metrics.completed
          };
        });

        const blockProgressPercent = secs.length
          ? Math.round((completedCount / secs.length) * 100)
          : 0;
        const blockPoints = sectionsOut.reduce((sum, x) => sum + x.points, 0);
        const blockMaxPoints = sectionsOut.reduce((sum, x) => sum + x.maxPoints, 0);

        return {
          id: bPlain.id,
          title: bPlain.title,
          description: bPlain.description || '',
          themeId: theme.id,
          order_index: bPlain.order_index,
          progressPercent: blockProgressPercent,
          blockPoints,
          blockMaxPoints,
          sections: sectionsOut
        };
      });

      const themePoints = blocksOut.reduce((sum, b) => sum + b.blockPoints, 0);
      const themeMaxPoints = blocksOut.reduce((sum, b) => sum + b.blockMaxPoints, 0);

      return {
        id: theme.id,
        title: theme.title,
        order_index: theme.order_index,
        themePoints,
        themeMaxPoints,
        blocks: blocksOut
      };
    });

    const totalPoints = themesOut.reduce((sum, t) => sum + t.themePoints, 0);

    return {
      id: sid,
      first_name: sPlain.firstName,
      last_name: sPlain.lastName,
      patronymic: sPlain.patronymic,
      avatar_url: sPlain.avatarUrl,
      educational_institution: sPlain.educationalInstitution,
      faculty: sPlain.faculty,
      study_course: sPlain.studyCourse,
      study_group: sPlain.studyGroup,
      joined_at: enrollment.joined_at,
      total_points: totalPoints,
      max_course_points: courseMaxPoints,
      themes: themesOut
    };
  });

  return { students: studentsPayload, course_max_points: courseMaxPoints };
}

/**
 * Полное удаление курса и связанных строк (в транзакции).
 * @param {import('sequelize').Model} course - экземпляр Course
 * @param {import('sequelize').Transaction} transaction
 */
async function destroyCourseAndDependencies(course, transaction) {
  if (!course) return;

  await db.Notification.destroy({ where: { course_id: course.id }, transaction });
  await db.CourseStudent.destroy({ where: { course_id: course.id }, transaction });

  const themeRows = await db.Theme.findAll({
    where: { course_id: course.id },
    attributes: ['id'],
    transaction
  });
  const themeIds = themeRows.map((t) => t.id);
  let sectionIds = [];
  if (themeIds.length > 0) {
    const blockRows = await db.Block.findAll({
      where: { theme_id: { [Op.in]: themeIds } },
      attributes: ['id'],
      transaction
    });
    const blockIds = blockRows.map((b) => b.id);
    if (blockIds.length > 0) {
      const sectionRows = await db.Section.findAll({
        where: { block_id: { [Op.in]: blockIds } },
        attributes: ['id'],
        transaction
      });
      sectionIds = sectionRows.map((s) => s.id);
    }
  }

  if (sectionIds.length > 0) {
    const tests = await db.Test.findAll({
      where: { section_id: { [Op.in]: sectionIds } },
      attributes: ['id'],
      transaction
    });
    const testIds = tests.map((t) => t.id);
    if (testIds.length > 0) {
      await db.TestAttempt.destroy({ where: { test_id: { [Op.in]: testIds } }, transaction });
    }
    await db.StudentProgress.destroy({ where: { section_id: { [Op.in]: sectionIds } }, transaction });
    await db.SectionComment.destroy({ where: { section_id: { [Op.in]: sectionIds } }, transaction });
  }

  await course.destroy({ transaction });
}

module.exports = {
    createCourse: async (req, res) => {
        const transaction = await db.sequelize.transaction();
        
        try {
            const { title, cover_image } = req.body;
            
            if (!title) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Название курса обязательно'
                });
            }

            // Генерируем уникальный join_code
            let joinCode = generateJoinCode();
            let isUnique = false;
            let attempts = 0;
            
            while (!isUnique && attempts < 10) {
                const existing = await db.Course.findOne({ 
                    where: { join_code: joinCode },
                    transaction
                });
                if (!existing) {
                    isUnique = true;
                } else {
                    joinCode = generateJoinCode();
                    attempts++;
                }
            }

            const course = await db.Course.create({
                title,
                cover_image,
                teacher_id: req.user.id,
                status: 'draft',
                join_code: joinCode
            }, { transaction });

            await transaction.commit();

            res.status(201).json({
                success: true,
                message: 'Курс успешно создан',
                course: {
                    id: course.id,
                    title: course.title,
                    cover_image: course.cover_image,
                    status: course.status,
                    join_code: course.join_code  // ← УБЕДИТЕСЬ, ЧТО ЭТА СТРОКА ЕСТЬ
                }
            });

        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Ошибка при создании курса');
        }
    },

    getTeacherCourses: async (req, res) => {
        try {
            const courses = await db.Course.findAll({
                where: { teacher_id: req.user.id },
                order: [['created_at', 'DESC']],
                include: [
                    {
                        model: db.Theme,
                        as: 'themes',
                        include: [{ model: db.Block, as: 'blocks' }]
                    }
                ]
            });

            res.json({ success: true, courses });
        } catch (error) {
            handleError(res, error, 'Ошибка при получении курсов');
        }
    },

    leaveCourse: async (req, res) => {
        const transaction = await db.sequelize.transaction();
        try {
            const courseId = req.params.id;
            const course = await db.Course.findByPk(courseId, { transaction });
            if (!course) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Курс не найден'
                });
            }

            const enrollment = await db.CourseStudent.findOne({
                where: { course_id: courseId, student_id: req.user.id },
                transaction
            });
            if (!enrollment) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Вы не подключены к этому курсу'
                });
            }

            const themeRows = await db.Theme.findAll({
                where: { course_id: courseId },
                attributes: ['id'],
                transaction
            });
            const themeIds = themeRows.map((t) => t.id);
            let sectionIds = [];
            if (themeIds.length > 0) {
                const blockRows = await db.Block.findAll({
                    where: { theme_id: { [Op.in]: themeIds } },
                    attributes: ['id'],
                    transaction
                });
                const blockIds = blockRows.map((b) => b.id);
                if (blockIds.length > 0) {
                    const sectionRows = await db.Section.findAll({
                        where: { block_id: { [Op.in]: blockIds } },
                        attributes: ['id'],
                        transaction
                    });
                    sectionIds = sectionRows.map((s) => s.id);
                }
            }

            if (sectionIds.length > 0) {
                const tests = await db.Test.findAll({
                    where: { section_id: { [Op.in]: sectionIds } },
                    attributes: ['id'],
                    transaction
                });
                const testIds = tests.map((t) => t.id);
                if (testIds.length > 0) {
                    await db.TestAttempt.destroy({
                        where: {
                            test_id: { [Op.in]: testIds },
                            student_id: req.user.id
                        },
                        transaction
                    });
                }
                await db.StudentProgress.destroy({
                    where: {
                        section_id: { [Op.in]: sectionIds },
                        student_id: req.user.id
                    },
                    transaction
                });
                await db.SectionComment.destroy({
                    where: {
                        section_id: { [Op.in]: sectionIds },
                        user_id: req.user.id
                    },
                    transaction
                });
            }

            await db.Notification.destroy({
                where: { course_id: courseId, user_id: req.user.id },
                transaction
            });

            await enrollment.destroy({ transaction });

            const newCount = await db.CourseStudent.count({
                where: { course_id: courseId },
                transaction
            });
            await course.update({ students_count: newCount }, { transaction });

            await transaction.commit();
            return res.json({ success: true, message: 'Вы вышли из курса' });
        } catch (error) {
            await transaction.rollback();
            console.error('leaveCourse:', error);
            handleError(res, error, 'Ошибка при выходе из курса');
        }
    },

    getCourseById: async (req, res) => {
        try {
            const course = await db.Course.findByPk(req.params.id, {
                include: [
                    {
                        model: db.Theme,
                        as: 'themes',
                        include: [{ model: db.Block, as: 'blocks' }]
                    },
                    {
                        model: db.User,
                        as: 'teacher',
                        attributes: ['id', 'first_name', 'last_name', 'patronymic']
                    }
                ]
            });

            if (!course) {
                return res.status(404).json({
                    success: false,
                    message: 'Курс не найден'
                });
            }

            // Для студентов: проверяем, подключен ли он к курсу
            if (req.user.role === 'student') {
                const isEnrolled = await db.CourseStudent.findOne({
                    where: {
                        course_id: course.id,
                        student_id: req.user.id
                    }
                });
                
                if (!isEnrolled) {
                    return res.status(403).json({
                        success: false,
                        message: 'Вы не подключены к этому курсу'
                    });
                }
            } else if (course.teacher_id !== req.user.id && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Нет доступа к этому курсу'
                });
            }

            const enrolledCount = await db.CourseStudent.count({
                where: { course_id: course.id }
            });

            // Возвращаем курс с join_code
            res.json({ 
                success: true, 
                course: {
                    id: course.id,
                    title: course.title,
                    cover_image: course.cover_image,
                    status: course.status,
                    join_code: course.join_code,  // ← ДОБАВЬТЕ ЭТУ СТРОКУ
                    teacher_id: course.teacher_id,
                    students_count: enrolledCount,
                    themes: course.themes,
                    teacher: course.teacher
                }
            });
        } catch (error) {
            handleError(res, error, 'Ошибка при получении курса');
        }
    },

    getTeacherCoursePerformance: async (req, res) => {
        try {
            const course = await db.Course.findByPk(req.params.id);
            if (!course) {
                return res.status(404).json({
                    success: false,
                    message: 'Курс не найден'
                });
            }
            if (course.teacher_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Нет доступа к этому курсу'
                });
            }
            const data = await buildTeacherCoursePerformance(course.id);
            res.json({ success: true, ...data });
        } catch (error) {
            handleError(res, error, 'Ошибка при загрузке успеваемости');
        }
    },

    deleteCourse: async (req, res) => {
        const transaction = await db.sequelize.transaction();
        try {
            const course = await db.Course.findByPk(req.params.id, { transaction });
            if (!course) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Курс не найден'
                });
            }
            if (course.teacher_id !== req.user.id) {
                await transaction.rollback();
                return res.status(403).json({
                    success: false,
                    message: 'Нет прав на удаление этого курса'
                });
            }

            await destroyCourseAndDependencies(course, transaction);
            await transaction.commit();
            return res.json({ success: true, message: 'Курс удалён' });
        } catch (error) {
            await transaction.rollback();
            console.error('deleteCourse:', error);
            handleError(res, error, 'Ошибка при удалении курса');
        }
    },

    // ИСПРАВЛЕННАЯ ВЕРСИЯ - НЕ УДАЛЯЕТ ТЕМЫ!
    updateCourse: async (req, res) => {
        const transaction = await db.sequelize.transaction();
        
        try {
            const pendingNewThemes = [];
            const pendingNewBlocks = [];

            const course = await db.Course.findByPk(req.params.id);
            
            if (!course) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Курс не найден'
                });
            }

            if (course.teacher_id !== req.user.id) {
                await transaction.rollback();
                return res.status(403).json({
                    success: false,
                    message: 'Нет прав на редактирование этого курса'
                });
            }

            const { title, cover_image, status, themes } = req.body;

            // Обновляем основную информацию курса
            await course.update({
                title: title || course.title,
                cover_image: cover_image !== undefined ? cover_image : course.cover_image,
                status: status || course.status
            }, { transaction });

            if (themes && Array.isArray(themes)) {
                // Получаем существующие темы (НЕ УДАЛЯЕМ!)
                const existingThemes = await db.Theme.findAll({
                    where: { course_id: course.id },
                    transaction
                });
                
                const existingThemesMap = new Map();
                existingThemes.forEach(theme => {
                    existingThemesMap.set(theme.id, theme);
                });

                const newThemeIds = [];

                // Обрабатываем каждую тему
                for (let themeIndex = 0; themeIndex < themes.length; themeIndex++) {
                    const themeData = themes[themeIndex];
                    let theme;

                    if (themeData.id && existingThemesMap.has(themeData.id)) {
                        // Обновляем существующую тему
                        theme = existingThemesMap.get(themeData.id);
                        await theme.update({
                            title: themeData.title,
                            order_index: themeIndex
                        }, { transaction });
                    } else {
                        // Создаем новую тему
                        theme = await db.Theme.create({
                            title: themeData.title,
                            course_id: course.id,
                            order_index: themeIndex
                        }, { transaction });
                        pendingNewThemes.push(theme);
                    }
                    
                    newThemeIds.push(theme.id);

                    // Получаем существующие блоки в этой теме
                    const existingBlocks = await db.Block.findAll({
                        where: { theme_id: theme.id },
                        transaction
                    });
                    
                    const existingBlocksMap = new Map();
                    existingBlocks.forEach(block => {
                        existingBlocksMap.set(block.id, block);
                    });

                    const newBlockIds = [];

                    // Обрабатываем блоки
                    if (themeData.blocks && Array.isArray(themeData.blocks)) {
                        for (let blockIndex = 0; blockIndex < themeData.blocks.length; blockIndex++) {
                            const blockData = themeData.blocks[blockIndex];
                            let block;

                            if (blockData.id && existingBlocksMap.has(blockData.id)) {
                                // Обновляем существующий блок
                                block = existingBlocksMap.get(blockData.id);
                                await block.update({
                                    title: blockData.title || 'Новый блок',
                                    description: blockData.description || '',
                                    order_index: blockIndex,
                                    type: 'text'
                                }, { transaction });
                            } else {
                                // Создаем новый блок
                                block = await db.Block.create({
                                    title: blockData.title || 'Новый блок',
                                    description: blockData.description || '',
                                    theme_id: theme.id,
                                    order_index: blockIndex,
                                    type: 'text'
                                }, { transaction });
                                pendingNewBlocks.push({ block, themeId: theme.id });
                            }
                            
                            newBlockIds.push(block.id);
                        }
                    }

                    // Удаляем только те блоки, которых больше нет
                    for (const oldBlock of existingBlocks) {
                        if (!newBlockIds.includes(oldBlock.id)) {
                            await db.Section.destroy({ 
                                where: { block_id: oldBlock.id }, 
                                transaction 
                            });
                            await oldBlock.destroy({ transaction });
                        }
                    }
                }

                // Удаляем только те темы, которых больше нет
                for (const oldTheme of existingThemes) {
                    if (!newThemeIds.includes(oldTheme.id)) {
                        const blocksToDelete = await db.Block.findAll({
                            where: { theme_id: oldTheme.id },
                            transaction
                        });
                        for (const block of blocksToDelete) {
                            await db.Section.destroy({ 
                                where: { block_id: block.id }, 
                                transaction 
                            });
                            await block.destroy({ transaction });
                        }
                        await oldTheme.destroy({ transaction });
                    }
                }
            }

            await transaction.commit();

            pendingNewThemes.forEach((t) => {
                notificationService.notifyStudentsNewTheme(course.id, t)
                    .catch((err) => console.error('notify new theme', err));
            });
            pendingNewBlocks.forEach((nb) => {
                notificationService.notifyStudentsNewBlock(course.id, nb.themeId, nb.block)
                    .catch((err) => console.error('notify new block', err));
            });

            // Получаем обновленный курс
            const updatedCourse = await db.Course.findByPk(course.id, {
                include: [
                    {
                        model: db.Theme,
                        as: 'themes',
                        include: [{ model: db.Block, as: 'blocks' }]
                    }
                ]
            });

            res.json({
                success: true,
                message: 'Курс успешно обновлен',
                course: {
                    id: updatedCourse.id,
                    title: updatedCourse.title,
                    cover_image: updatedCourse.cover_image,
                    status: updatedCourse.status,
                    join_code: updatedCourse.join_code,  // ← ДОБАВЬТЕ ЭТУ СТРОКУ
                    themes: updatedCourse.themes
                }
            });

        } catch (error) {
            await transaction.rollback();
            console.error('Ошибка при обновлении курса:', error);
            handleError(res, error, 'Ошибка при обновлении курса');
        }
    },

    uploadCourseImage: async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Файл не загружен'
                });
            }

            const imageUrl = `/public/uploads/courses/${req.file.filename}`;

            res.json({
                success: true,
                message: 'Изображение успешно загружено',
                imageUrl: imageUrl
            });
        } catch (error) {
            handleError(res, error, 'Ошибка при загрузке изображения');
        }
    },

    // Получение курса по join_code (публичный)
    getCourseByJoinCode: async (req, res) => {
        try {
            const { joinCode } = req.params;
            
            const course = await db.Course.findOne({
                where: { join_code: joinCode },
                attributes: ['id', 'title', 'cover_image', 'teacher_id', 'status']
            });
            
            if (!course) {
                return res.status(404).json({
                    success: false,
                    message: 'Курс не найден'
                });
            }
            
            if (course.status !== 'published') {
                return res.status(403).json({
                    success: false,
                    message: 'Курс еще не опубликован'
                });
            }
            
            res.json({ success: true, course });
        } catch (error) {
            handleError(res, error, 'Ошибка при поиске курса');
        }
    },

    // Подключение студента к курсу по коду
    joinCourseByCode: async (req, res) => {
        const transaction = await db.sequelize.transaction();
        
        try {
            const { joinCode } = req.body;
            const studentId = req.user.id;
            
            const course = await db.Course.findOne({
                where: { join_code: joinCode }
            });
            
            if (!course) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Курс не найден'
                });
            }
            
            if (course.teacher_id === studentId) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Вы являетесь преподавателем этого курса'
                });
            }
            
            const existing = await db.CourseStudent.findOne({
                where: {
                    course_id: course.id,
                    student_id: studentId
                }
            });
            
            if (existing) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Вы уже подключены к этому курсу'
                });
            }
            
            await db.CourseStudent.create({
                course_id: course.id,
                student_id: studentId,
                status: 'active'
            }, { transaction });
            
            await course.increment('students_count', { transaction });
            
            await transaction.commit();
            
            res.json({
                success: true,
                message: 'Вы успешно подключились к курсу',
                course: {
                    id: course.id,
                    title: course.title,
                    cover_image: course.cover_image
                }
            });
            
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Ошибка при подключении к курсу');
        }
    },

    // Получение всех курсов студента
    // Получение всех курсов студента
getStudentCourses: async (req, res) => {
    try {
        const studentId = req.user.id;
        
        // Выполняем запрос
        const results = await db.sequelize.query(`
            SELECT 
                c.id,
                c.title,
                c.cover_image,
                c.created_at,
                cs.joined_at,
                json_build_object(
                    'id', u.id,
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'patronymic', u.patronymic
                ) as teacher
            FROM courses c
            JOIN course_students cs ON cs.course_id = c.id
            JOIN users u ON u.id = c.teacher_id
            WHERE cs.student_id = :studentId
            ORDER BY cs.joined_at DESC
        `, {
            replacements: { studentId },
            type: db.sequelize.QueryTypes.SELECT
        });
        
        console.log('SQL результаты:', results);
        
        // Проверяем, что results - массив
        if (!results || !Array.isArray(results)) {
            console.error('Results не является массивом:', results);
            return res.json({ success: true, courses: [] });
        }
        
        // Загружаем темы, блоки и общий прогресс для каждого курса
        const coursesWithThemes = [];
        
        for (const course of results) {
            const progressData = await buildStudentCourseProgress(course.id, studentId);
            
            coursesWithThemes.push({
                id: course.id,
                title: course.title,
                cover_image: course.cover_image,
                created_at: course.created_at,
                joined_at: course.joined_at,
                teacher: course.teacher,
                themes: progressData.themes,
                progressPercent: progressData.progressPercent
            });
        }
        
        console.log('Итоговые курсы:', coursesWithThemes.map(c => ({ title: c.title, joined_at: c.joined_at })));
        
        res.json({ success: true, courses: coursesWithThemes });
    } catch (error) {
        console.error('Ошибка в getStudentCourses:', error);
        handleError(res, error, 'Ошибка при получении курсов студента');
    }
    },

destroyCourseAndDependencies
};