module.exports = {
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRE || '7d'
  },
  bcrypt: {
    saltRounds: 10
  }
};