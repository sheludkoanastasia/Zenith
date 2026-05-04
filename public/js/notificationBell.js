(function () {
  const KEY_STUDENT = 'zenith_notifications_last_seen_student';
  const KEY_TEACHER = 'zenith_notifications_last_seen_teacher';

  function lastSeenKeyForRole(role) {
    return role === 'teacher' ? KEY_TEACHER : KEY_STUDENT;
  }

  /**
   * Подсветка колокольчика в шапке панели: красный контур, если есть уведомления новее последнего захода на страницу уведомлений.
   */
  window.updateNavNotificationBell = async function (token, role) {
    const link = document.querySelector('a.nav-notification-bell');
    if (!link || !token) return;

    try {
      const res = await fetch('/api/notifications/bell', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;

      const lastSeenRaw = localStorage.getItem(lastSeenKeyForRole(role));
      const lastSeenMs = lastSeenRaw ? new Date(lastSeenRaw).getTime() : 0;
      const validLastSeen = Number.isNaN(lastSeenMs) ? 0 : lastSeenMs;

      let unread = false;
      if (data.hasAny && data.latestNotificationAt) {
        const latestMs = new Date(data.latestNotificationAt).getTime();
        if (!Number.isNaN(latestMs) && latestMs > validLastSeen) {
          unread = true;
        }
      }

      link.classList.toggle('nav-notification-bell--unread', unread);
      link.setAttribute('aria-label', unread ? 'Уведомления, есть непрочитанные' : 'Уведомления');
    } catch (e) {
      console.error('Ошибка статуса уведомлений (колокольчик):', e);
    }
  };
})();
