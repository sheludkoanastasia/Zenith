function toPublicUser(user) {
  const u = user && typeof user.get === 'function' ? user.get({ plain: true }) : user;
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    firstName: u.firstName,
    lastName: u.lastName,
    patronymic: u.patronymic,
    educationalInstitution: u.educationalInstitution || null,
    studyCourse: u.studyCourse || null,
    faculty: u.faculty || null,
    studyGroup: u.studyGroup || null,
    avatarUrl: u.avatarUrl || null
  };
}

module.exports = { toPublicUser };
