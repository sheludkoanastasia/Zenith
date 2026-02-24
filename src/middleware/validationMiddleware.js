const { body } = require('express-validator');

const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Введите корректный email'),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Пароль должен быть минимум 8 символов')
    .matches(/[A-Z]/)
    .withMessage('Пароль должен содержать хотя бы одну заглавную латинскую букву')
    .matches(/[a-z]/)
    .withMessage('Пароль должен содержать хотя бы одну строчную латинскую букву')
    .matches(/\d/)
    .withMessage('Пароль должен содержать хотя бы одну цифру')
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
    .withMessage('Пароль должен содержать хотя бы один специальный символ')
    .matches(/^[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/)
    .withMessage('Пароль может содержать только латинские буквы, цифры и специальные символы'),

  body('role')
    .optional()
    .isIn(['student', 'teacher'])
    .withMessage('Роль должна быть student или teacher'),

  body('firstName')
    .notEmpty().withMessage('Имя обязательно для заполнения')
    .trim()
    .isLength({ min: 2, max: 20 })
    .withMessage('Имя должно быть от 2 до 20 символов')
    .matches(/^[А-Яа-яЁёA-Za-z\s-]+$/)
    .withMessage('Имя может содержать только буквы, пробелы и дефисы'),

  body('lastName')
    .notEmpty().withMessage('Фамилия обязательна для заполнения')
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage('Фамилия должна быть от 2 до 30 символов')
    .matches(/^[А-Яа-яЁёA-Za-z\s-]+$/)
    .withMessage('Фамилия может содержать только буквы, пробелы и дефисы'),

  body('patronymic')
    .optional()
    .trim()
    .custom((value) => {
      if (value && value.length > 0) {
        if (value.length < 2 || value.length > 30) {
          throw new Error('Отчество должно быть от 2 до 30 символов');
        }
        if (!/^[А-Яа-яЁёA-Za-z\s-]*$/.test(value)) {
          throw new Error('Отчество может содержать только буквы, пробелы и дефисы');
        }
      }
      return true;
    })
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Введите корректный email'),
  body('password')
    .notEmpty()
    .withMessage('Введите пароль')
];

module.exports = {
  validateRegistration,
  validateLogin
};