const path = require('path');
const fs = require('fs');
const db = require('../models');
const { handleError } = require('../utils/errorHandler');
const { toPublicUser } = require('../utils/userSerializer');

const OPTIONAL_TEXT_MAX = 200;
const NAME_RE = /^[А-Яа-яЁёA-Za-z\s-]+$/;
const OPTIONAL_PATR_RE = /^[А-Яа-яЁёA-Za-z\s-]*$/;

function validatePasswordRules(password) {
  if (password.length < 8) return 'Пароль должен быть минимум 8 символов';
  if (!/[A-Z]/.test(password)) return 'Пароль должен содержать заглавную латинскую букву';
  if (!/[a-z]/.test(password)) return 'Пароль должен содержать строчную латинскую букву';
  if (!/\d/.test(password)) return 'Пароль должен содержать цифру';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return 'Пароль должен содержать специальный символ';
  }
  if (!/^[A-Za-z\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+$/.test(password)) {
    return 'Пароль может содержать только латинские буквы, цифры и спецсимволы';
  }
  return null;
}

function trimOrNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function removeAvatarFile(avatarUrl) {
  if (!avatarUrl || typeof avatarUrl !== 'string') return;
  if (!avatarUrl.includes('/uploads/avatars/')) return;
  const rel = avatarUrl.replace(/^\/public\//, '');
  const filePath = path.join(__dirname, '../../public', rel);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.error('Не удалось удалить старый аватар:', e.message);
    }
  }
}

module.exports = {
  getMe: async (req, res) => {
    try {
      const user = await db.User.findByPk(req.userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Пользователь не найден' });
      }
      res.json({ success: true, user: toPublicUser(user) });
    } catch (error) {
      handleError(res, error, 'Ошибка загрузки профиля');
    }
  },

  updateProfile: async (req, res) => {
    try {
      const user = await db.User.findByPk(req.userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Пользователь не найден' });
      }

      const {
        firstName,
        lastName,
        patronymic,
        educationalInstitution,
        studyCourse,
        faculty,
        studyGroup
      } = req.body;

      const fn = trimOrNull(firstName);
      const ln = trimOrNull(lastName);
      const pat = patronymic !== undefined ? String(patronymic).trim() : '';

      if (!fn || fn.length < 2 || fn.length > 20 || !NAME_RE.test(fn)) {
        return res.status(400).json({
          success: false,
          message: 'Имя: от 2 до 20 символов, буквы, пробелы и дефис'
        });
      }
      if (!ln || ln.length < 2 || ln.length > 30 || !NAME_RE.test(ln)) {
        return res.status(400).json({
          success: false,
          message: 'Фамилия: от 2 до 30 символов, буквы, пробелы и дефис'
        });
      }
      if (pat.length > 0) {
        if (pat.length < 2 || pat.length > 30 || !OPTIONAL_PATR_RE.test(pat)) {
          return res.status(400).json({
            success: false,
            message: 'Отчество: от 2 до 30 символов или оставьте пустым'
          });
        }
      }

      const opt = (val) => {
        const t = trimOrNull(val);
        if (!t) return null;
        if (t.length > OPTIONAL_TEXT_MAX) {
          return { error: `Поле не длиннее ${OPTIONAL_TEXT_MAX} символов` };
        }
        return { value: t };
      };

      const inst = opt(educationalInstitution);
      if (inst && inst.error) {
        return res.status(400).json({ success: false, message: inst.error });
      }
      const course = opt(studyCourse);
      if (course && course.error) {
        return res.status(400).json({ success: false, message: course.error });
      }
      const fac = opt(faculty);
      if (fac && fac.error) {
        return res.status(400).json({ success: false, message: fac.error });
      }
      const grp = opt(studyGroup);
      if (grp && grp.error) {
        return res.status(400).json({ success: false, message: grp.error });
      }

      const updates = {
        firstName: fn,
        lastName: ln,
        patronymic: pat.length ? pat : null,
        educationalInstitution: inst && inst.value !== undefined ? inst.value : null,
        studyCourse: course && course.value !== undefined ? course.value : null,
        faculty: fac && fac.value !== undefined ? fac.value : null,
        studyGroup: grp && grp.value !== undefined ? grp.value : null
      };

      if (req.file) {
        removeAvatarFile(user.avatarUrl);
        updates.avatarUrl = `/public/uploads/avatars/${req.file.filename}`;
      }

      await user.update(updates);

      const fresh = await db.User.findByPk(req.userId);
      res.json({
        success: true,
        message: 'Профиль сохранён',
        user: toPublicUser(fresh)
      });
    } catch (error) {
      handleError(res, error, 'Ошибка сохранения профиля');
    }
  },

  updateEmail: async (req, res) => {
    try {
      const user = await db.User.findByPk(req.userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Пользователь не найден' });
      }

      const newEmailRaw = trimOrNull(req.body.newEmail);
      const currentPassword = req.body.currentPassword;

      if (!newEmailRaw) {
        return res.status(400).json({ success: false, message: 'Укажите новый email' });
      }
      const emailRe =
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!emailRe.test(newEmailRaw)) {
        return res.status(400).json({ success: false, message: 'Некорректный email' });
      }
      const newEmail = newEmailRaw.toLowerCase().trim();

      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Введите текущий пароль' });
      }
      const ok = await user.validatePassword(currentPassword);
      if (!ok) {
        return res.status(400).json({ success: false, message: 'Неверный текущий пароль' });
      }

      if (newEmail.toLowerCase() === String(user.email || '').toLowerCase()) {
        return res.status(400).json({ success: false, message: 'Новый email совпадает с текущим' });
      }

      const existing = await db.User.findOne({ where: { email: newEmail } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Этот email уже занят' });
      }

      await user.update({ email: newEmail });
      const fresh = await db.User.findByPk(req.userId);
      res.json({
        success: true,
        message: 'Почта обновлена. Входите с новым адресом.',
        user: toPublicUser(fresh)
      });
    } catch (error) {
      handleError(res, error, 'Ошибка смены почты');
    }
  },

  updatePassword: async (req, res) => {
    try {
      const user = await db.User.findByPk(req.userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Пользователь не найден' });
      }

      const { currentPassword, newPassword, confirmPassword } = req.body;

      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Введите текущий пароль' });
      }
      const ok = await user.validatePassword(currentPassword);
      if (!ok) {
        return res.status(400).json({ success: false, message: 'Неверный текущий пароль' });
      }

      const np = newPassword ? String(newPassword) : '';
      const cp = confirmPassword ? String(confirmPassword) : '';

      if (!np) {
        return res.status(400).json({ success: false, message: 'Введите новый пароль' });
      }
      const pwdErr = validatePasswordRules(np);
      if (pwdErr) {
        return res.status(400).json({ success: false, message: pwdErr });
      }
      if (np !== cp) {
        return res.status(400).json({ success: false, message: 'Пароли не совпадают' });
      }

      await user.update({ password: np });
      res.json({ success: true, message: 'Пароль обновлён' });
    } catch (error) {
      handleError(res, error, 'Ошибка смены пароля');
    }
  }
};
