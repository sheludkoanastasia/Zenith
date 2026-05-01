document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/auth';
    return;
  }

  const panelBase = window.location.pathname.startsWith('/teacher') ? '/teacher' : '/user';

  const settingsBack = document.getElementById('settingsBack');
  if (settingsBack) {
    settingsBack.href = panelBase;
  }

  const settingsHeader = document.getElementById('settingsHeader');
  function updateHeaderOnScroll() {
    if (!settingsHeader) return;
    settingsHeader.classList.toggle('settings-header--solid', window.scrollY > 10);
  }
  window.addEventListener('scroll', updateHeaderOnScroll, { passive: true });
  updateHeaderOnScroll();

  const avatarTrigger = document.getElementById('avatarTrigger');
  const avatarInput = document.getElementById('avatarInput');
  const avatarPreview = document.getElementById('avatarPreview');

  let pendingAvatarFile = null;
  let defaultAvatarSrc = '/images/userMainPanel/user.svg';

  function showNotification(message, type = 'info') {
    addNotificationStyles();
    document.querySelectorAll('.user-toast').forEach((toast) => {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 300);
    });

    const toast = document.createElement('div');
    toast.className = `user-toast ${type}`;

    let title = '';
    switch (type) {
      case 'success':
        title = 'Успешно';
        break;
      case 'error':
        title = 'Ошибка';
        break;
      case 'warning':
        title = 'Внимание';
        break;
      default:
        title = 'Информация';
    }

    toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${escapeHtml(message)}</div>
            </div>
            <div class="toast-close">✕</div>
        `;

    document.body.appendChild(toast);

    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 300);
    });

    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
      }
    }, 4000);
  }

  function addNotificationStyles() {
    if (document.getElementById('user-toast-styles')) return;
    const style = document.createElement('style');
    style.id = 'user-toast-styles';
    style.textContent = `
            .user-toast {
                position: fixed;
                top: 100px;
                right: 30px;
                min-width: 320px;
                max-width: 400px;
                background: white;
                backdrop-filter: blur(10px);
                border-radius: 16px;
                padding: 16px 20px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
                display: flex;
                align-items: flex-start;
                gap: 12px;
                z-index: 9999;
                border: 1px solid rgba(255, 255, 255, 0.3);
                animation: slideInRight 0.4s ease;
            }
            .user-toast.success { border-left: 6px solid #4CAF50; }
            .user-toast.error { border-left: 6px solid #FF3B3B; }
            .user-toast.warning { border-left: 6px solid #FFB800; }
            .user-toast.info { border-left: 6px solid #7651BE; }
            .toast-content { flex: 1; }
            .toast-title { font-weight: 600; font-size: 16px; color: #1D1D1D; margin-bottom: 4px; }
            .toast-message { font-size: 14px; color: #4C4C4C; line-height: 1.5; }
            .toast-close {
                width: 24px; height: 24px; border-radius: 50%; background: rgba(0, 0, 0, 0.05);
                display: flex; align-items: center; justify-content: center; cursor: pointer;
                font-size: 18px; color: #666; transition: all 0.2s ease; flex-shrink: 0;
            }
            .toast-close:hover { background: rgba(0, 0, 0, 0.1); transform: scale(1.1); }
            @keyframes slideInRight {
                from { opacity: 0; transform: translateX(100px); }
                to { opacity: 1; transform: translateX(0); }
            }
            @keyframes slideOutRight {
                from { opacity: 1; transform: translateX(0); }
                to { opacity: 0; transform: translateX(100px); }
            }
            .user-toast.hiding { animation: slideOutRight 0.3s ease forwards; }
        `;
    document.head.appendChild(style);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function setAvatarPreviewFromUser(user) {
    pendingAvatarFile = null;
    if (user.avatarUrl) {
      avatarPreview.src = user.avatarUrl + (user.avatarUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
    } else {
      avatarPreview.src = defaultAvatarSrc;
    }
  }

  avatarTrigger.addEventListener('click', () => avatarInput.click());

  avatarInput.addEventListener('change', () => {
    const file = avatarInput.files && avatarInput.files[0];
    if (!file) return;
    const okType = file.type === 'image/jpeg' || file.type === 'image/png';
    if (!okType) {
      showNotification('Выберите файл JPEG или PNG', 'warning');
      avatarInput.value = '';
      return;
    }
    pendingAvatarFile = file;
    const url = URL.createObjectURL(file);
    avatarPreview.src = url;
  });

  function fillForm(user) {
    document.getElementById('fieldFirstName').value = user.firstName || '';
    document.getElementById('fieldLastName').value = user.lastName || '';
    document.getElementById('fieldPatronymic').value = user.patronymic || '';
    document.getElementById('fieldInstitution').value = user.educationalInstitution || '';
    document.getElementById('fieldCourse').value = user.studyCourse || '';
    document.getElementById('fieldFaculty').value = user.faculty || '';
    document.getElementById('fieldGroup').value = user.studyGroup || '';
    document.getElementById('fieldCurrentEmail').value = user.email || '';
    setAvatarPreviewFromUser(user);
  }

  async function loadUser() {
    try {
      const res = await fetch('/api/auth/check', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) {
        localStorage.removeItem('token');
        window.location.href = '/auth';
        return null;
      }
      if (data.user.role === 'teacher' && panelBase === '/user') {
        window.location.href = '/teacher';
        return null;
      }
      if (data.user.role !== 'teacher' && panelBase === '/teacher') {
        window.location.href = '/user';
        return null;
      }
      fillForm(data.user);
      return data.user;
    } catch (e) {
      console.error(e);
      showNotification('Не удалось загрузить профиль', 'error');
      return null;
    }
  }

  document.getElementById('saveProfileBtn').addEventListener('click', async () => {
    const fd = new FormData();
    fd.append('firstName', document.getElementById('fieldFirstName').value.trim());
    fd.append('lastName', document.getElementById('fieldLastName').value.trim());
    fd.append('patronymic', document.getElementById('fieldPatronymic').value.trim());
    fd.append('educationalInstitution', document.getElementById('fieldInstitution').value.trim());
    fd.append('studyCourse', document.getElementById('fieldCourse').value.trim());
    fd.append('faculty', document.getElementById('fieldFaculty').value.trim());
    fd.append('studyGroup', document.getElementById('fieldGroup').value.trim());
    if (pendingAvatarFile) {
      fd.append('avatar', pendingAvatarFile);
    }

    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });
      const data = await res.json();
      if (data.success) {
        pendingAvatarFile = null;
        avatarInput.value = '';
        fillForm(data.user);
        showNotification(data.message || 'Профиль сохранён', 'success');
      } else {
        showNotification(data.message || 'Не удалось сохранить', 'warning');
      }
    } catch (e) {
      console.error(e);
      showNotification('Ошибка сети при сохранении профиля', 'error');
    }
  });

  document.getElementById('saveEmailBtn').addEventListener('click', async () => {
    const newEmail = document.getElementById('fieldNewEmail').value.trim();
    const currentPassword = document.getElementById('fieldEmailPassword').value;

    try {
      const res = await fetch('/api/users/me/email', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newEmail, currentPassword })
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('fieldNewEmail').value = '';
        document.getElementById('fieldEmailPassword').value = '';
        fillForm(data.user);
        showNotification(data.message || 'Почта обновлена', 'success');
      } else {
        showNotification(data.message || 'Не удалось сменить почту', 'warning');
      }
    } catch (e) {
      console.error(e);
      showNotification('Ошибка сети', 'error');
    }
  });

  document.getElementById('savePasswordBtn').addEventListener('click', async () => {
    const currentPassword = document.getElementById('fieldOldPassword').value;
    const newPassword = document.getElementById('fieldNewPassword').value;
    const confirmPassword = document.getElementById('fieldNewPassword2').value;

    try {
      const res = await fetch('/api/users/me/password', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('fieldOldPassword').value = '';
        document.getElementById('fieldNewPassword').value = '';
        document.getElementById('fieldNewPassword2').value = '';
        showNotification(data.message || 'Пароль обновлён', 'success');
      } else {
        showNotification(data.message || 'Не удалось сменить пароль', 'warning');
      }
    } catch (e) {
      console.error(e);
      showNotification('Ошибка сети', 'error');
    }
  });

  loadUser();
});
