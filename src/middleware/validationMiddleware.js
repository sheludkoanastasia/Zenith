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
    .withMessage('Пароль может содержать только латинские буквы, цифры и специальные символы ' +
             '(!@#$%^&*()_+-=[]{};\':"\\|,.<>/?). Использование эмодзи и других символов запрещено'),

  body('role')
    .optional()
    .isIn(['student', 'teacher'])
    .withMessage('Роль должна быть student или teacher'),

  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Имя должно быть минимум 2 символа')
    .matches(/^[А-Яа-яЁёA-Za-z\s-]+$/)
    .withMessage('Имя может содержать только буквы, пробелы и дефисы'),

  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Фамилия должна быть минимум 2 символа')
    .matches(/^[А-Яа-яЁёA-Za-z\s-]+$/)
    .withMessage('Фамилия может содержать только буквы, пробелы и дефисы'),

  body('patronymic')
    .optional()
    .trim()
    .matches(/^[А-Яа-яЁёA-Za-z\s-]*$/)
    .withMessage('Отчество может содержать только буквы, пробелы и дефисы')

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