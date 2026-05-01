document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/auth';
    return;
  }

  const panelBase = window.location.pathname.startsWith('/teacher') ? '/teacher' : '/user';

  const filterRowCategory = document.getElementById('filterRowCategory');
  if (panelBase === '/teacher' && filterRowCategory) {
    filterRowCategory.hidden = true;
  }

  const back = document.getElementById('notificationsBack');
  if (back) back.href = panelBase;

  const header = document.getElementById('notificationsHeader');
  function onScroll() {
    if (!header) return;
    header.classList.toggle('settings-header--solid', window.scrollY > 10);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const listEl = document.getElementById('notificationsList');
  const feedEl = document.getElementById('notificationsFeed');
  const statusEl = document.getElementById('notificationsStatus');
  const courseOptionsRoot = document.querySelector('.notifications-course-options');

  let currentRole = 'student';

  function getDropdown(filterName) {
    return document.querySelector(`.notifications-dropdown[data-filter="${filterName}"]`);
  }

  function getFilterValue(filterName) {
    const el = getDropdown(filterName);
    return el?.dataset.value || (filterName === 'date' ? 'newest' : 'all');
  }

  function setFilterValue(filterName, value, labelText) {
    const menu = getDropdown(filterName);
    if (!menu) return;
    menu.dataset.value = value;
    const labelSpan = menu.querySelector('.notifications-dropdown-label');
    if (labelSpan && labelText != null) labelSpan.textContent = labelText;
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.notifications-dropdown.active').forEach((d) => {
      d.classList.remove('active');
      d.querySelector('.notifications-dropdown-toggle')?.setAttribute('aria-expanded', 'false');
    });
  }

  function initDropdownMenus() {
    document.querySelectorAll('.notifications-dropdown').forEach((menu) => {
      const toggle = menu.querySelector('.notifications-dropdown-toggle');
      const links = menu.querySelectorAll('.dropdown-content a[data-value]');

      toggle?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = menu.classList.contains('active');
        closeAllDropdowns();
        if (!isOpen) {
          menu.classList.add('active');
          toggle.setAttribute('aria-expanded', 'true');
        }
      });

      links.forEach((a) => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const value = a.dataset.value;
          const label = a.textContent.trim();
          setFilterValue(menu.dataset.filter, value, label);
          closeAllDropdowns();
          loadNotifications();
        });
      });
    });

    document.addEventListener('click', () => closeAllDropdowns());
  }

  function rebuildCourseDropdown(courses, preserveValue) {
    if (!courseOptionsRoot) return;
    courseOptionsRoot.innerHTML = '';
    const add = (value, label) => {
      const a = document.createElement('a');
      a.href = '#';
      a.setAttribute('role', 'option');
      a.dataset.value = value;
      a.textContent = label;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setFilterValue('course', value, label);
        closeAllDropdowns();
        loadNotifications();
      });
      courseOptionsRoot.appendChild(a);
    };

    add('all', 'Все курсы');
    (courses || []).forEach((c) => {
      add(c.id, c.title || 'Без названия');
    });

    const menu = getDropdown('course');
    if (!menu) return;
    const valid = preserveValue && [...courseOptionsRoot.querySelectorAll('a')].some((x) => x.dataset.value === preserveValue);
    const useVal = valid ? preserveValue : 'all';
    const labelEl = [...courseOptionsRoot.querySelectorAll('a')].find((x) => x.dataset.value === useVal);
    setFilterValue('course', useVal, labelEl ? labelEl.textContent.trim() : 'Все курсы');
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function loadNotifications() {
    if (!listEl) return;
    statusEl.hidden = true;
    listEl.innerHTML = '';
    if (feedEl) feedEl.hidden = true;

    const params = new URLSearchParams();
    params.set('date', getFilterValue('date') === 'oldest' ? 'oldest' : 'newest');
    const courseVal = getFilterValue('course');
    if (courseVal && courseVal !== 'all') {
      params.set('courseId', courseVal);
    }
    if (currentRole === 'student' && filterRowCategory && !filterRowCategory.hidden) {
      params.set('category', getFilterValue('category') || 'all');
    }

    try {
      const res = await fetch(`/api/notifications?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!data.success) {
        statusEl.textContent = data.message || 'Не удалось загрузить уведомления';
        statusEl.hidden = false;
        return;
      }

      currentRole = data.role || currentRole;
      if (filterRowCategory) {
        filterRowCategory.hidden = currentRole !== 'student';
      }

      const prevCourse = getFilterValue('course');
      if (data.courses) {
        rebuildCourseDropdown(data.courses, prevCourse);
      }

      const items = data.notifications || [];
      if (items.length === 0) {
        statusEl.textContent = 'Пока нет уведомлений';
        statusEl.hidden = false;
        return;
      }

      if (feedEl) feedEl.hidden = false;

      items.forEach((n) => {
        const li = document.createElement('li');
        li.className = 'notifications-feed-item';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'notifications-row';
        btn.setAttribute('data-href', n.href || '#');

        const iconWrap = document.createElement('div');
        iconWrap.className = 'notifications-card-icon';
        const img = document.createElement('img');
        img.src = n.icon || '/images/notificationPage/notification.svg';
        img.alt = '';
        iconWrap.appendChild(img);

        const textCol = document.createElement('div');
        textCol.className = 'notifications-card-text-col';
        const subHtml = n.subtitle
          ? `<p class="notifications-card-sub">${escapeHtml(n.subtitle)}</p>`
          : '';
        textCol.innerHTML = `
          <p class="notifications-card-title">${escapeHtml(n.title)}</p>
          ${subHtml}
        `;

        const dateEl = document.createElement('time');
        dateEl.className = 'notifications-card-date';
        dateEl.dateTime = n.createdAt || '';
        dateEl.textContent = formatDate(n.createdAt);

        const courseSpan = document.createElement('span');
        courseSpan.className = 'notifications-card-course';
        courseSpan.textContent = n.courseName || '';
        courseSpan.title = n.courseName || '';

        btn.appendChild(iconWrap);
        btn.appendChild(textCol);
        btn.appendChild(dateEl);
        if (n.courseName) btn.appendChild(courseSpan);

        btn.addEventListener('click', () => {
          const href = btn.getAttribute('data-href');
          if (href && href !== '#') window.location.href = href;
        });

        li.appendChild(btn);
        listEl.appendChild(li);
      });
    } catch (e) {
      console.error(e);
      statusEl.textContent = 'Ошибка сети. Попробуйте позже.';
      statusEl.hidden = false;
    }
  }

  initDropdownMenus();
  loadNotifications();
});
