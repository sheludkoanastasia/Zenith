// public/js/teacherMainPanel.js
document.addEventListener("DOMContentLoaded", async function () {
    // ===============================
    // ПРОВЕРКА АВТОРИЗАЦИИ
    // ===============================
    const token = localStorage.getItem('token');
    
    if (!token) {
        window.location.href = '/auth';
        return;
    }
    
    let currentUser = null;
    let userCourses = [];
    
    try {
        const response = await fetch('/api/auth/check', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (!data.success) {
            localStorage.removeItem('token');
            window.location.href = '/auth';
            return;
        }
        
        // ВАЖНО: Если пользователь - студент, перенаправляем на страницу студента
        if (data.user.role !== 'teacher') {
            window.location.href = '/user';
            return;
        }
        
        currentUser = data.user;
        displayUserInfo(data.user);
        
        // Загружаем курсы преподавателя
        await loadTeacherCourses();

        if (typeof window.updateNavNotificationBell === 'function') {
            await window.updateNavNotificationBell(token, 'teacher');
        }
        
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        localStorage.removeItem('token');
        window.location.href = '/auth';
        return;
    }
    
    // ===============================
    // ЗАГРУЗКА КУРСОВ ПРЕПОДАВАТЕЛЯ
    // ===============================
    async function loadTeacherCourses() {
        try {
            const response = await fetch('/api/courses/teacher', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                userCourses = data.courses || [];
                displayCourses(userCourses);
            } else {
                showNotification('Не удалось загрузить курсы', 'error');
            }
        } catch (error) {
            console.error('Ошибка загрузки курсов:', error);
            showNotification('Ошибка при загрузке курсов', 'error');
        }
    }
    
    function displayCourses(courses) {
    const coursesContainer = document.querySelector('.courses');
    if (!coursesContainer) return;
    
    // Очищаем контейнер, но сохраняем firstMessage и createCourseContainer
    const firstMessage = document.getElementById('firstMessage');
    const createCourseContainer = document.getElementById('createCourseContainer');
    
    // Удаляем все существующие карточки курсов
    const existingCards = coursesContainer.querySelectorAll('.course-card-container:not(#createCourseContainer)');
    existingCards.forEach(card => card.remove());
    
    if (courses.length === 0) {
        if (firstMessage) {
            firstMessage.style.display = 'block';
            firstMessage.textContent = 'У вас пока нет созданных курсов. Создайте свой первый курс!';
        }
    } else {
        if (firstMessage) {
            firstMessage.style.display = 'none';
        }
        
        // Сортируем курсы по дате создания (новые сверху)
        const sortedCourses = [...courses].sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
        );
        
        // Создаем карточки для каждого курса
        sortedCourses.forEach(course => {
            const courseCard = createCourseCard(course);
            // Скрываем каждую карточку перед добавлением
            courseCard.style.opacity = '0';
            courseCard.style.transform = 'translateY(30px)';
            coursesContainer.appendChild(courseCard);
        });
        
        // Анимация карточек после создания
        gsap.to('.course-card-container', {
            y: 0,
            opacity: 1,
            duration: 0.6,
            delay: 0.1,
            ease: 'power2.out',
            clearProps: 'all'
        });
    }
    
    // Управляем отображением контейнера создания курса
    if (createCourseContainer) {
        createCourseContainer.style.display = 'none';
    }
}
    
    function addTeacherDeleteConfirmStyles() {
        if (document.getElementById('teacher-delete-confirm-styles')) return;
        const style = document.createElement('style');
        style.id = 'teacher-delete-confirm-styles';
        style.textContent = `
            .confirm-dialog-overlay.teacher-delete-dialog-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px);
                display: flex; align-items: center; justify-content: center;
                z-index: 10000; opacity: 0;
            }
            .teacher-delete-dialog-overlay .confirm-dialog {
                background: white; border-radius: 24px; padding: 32px;
                max-width: 440px; width: 90%; box-shadow: 0 30px 60px rgba(0, 0, 0, 0.3);
                transform-origin: center;
            }
            .teacher-delete-dialog-overlay .confirm-dialog-content { text-align: center; }
            .teacher-delete-dialog-overlay .confirm-dialog-title {
                font-size: 28px; font-weight: 500; color: #1D1D1D;
                margin-bottom: 16px; font-family: 'Ysabeau', 'Inter', sans-serif;
            }
            .teacher-delete-dialog-overlay .confirm-dialog-message {
                font-size: 18px; color: #4C4C4C; margin-bottom: 32px;
                line-height: 1.5; font-family: 'Ysabeau', 'Inter', sans-serif;
            }
            .teacher-delete-dialog-overlay .confirm-dialog-buttons { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
            .teacher-delete-dialog-overlay .confirm-dialog-btn {
                padding: 12px 32px; border-radius: 40px; font-size: 16px;
                font-weight: 500; font-family: 'Ysabeau', 'Inter', sans-serif;
                cursor: pointer; transition: all 0.3s ease; border: none; min-width: 120px;
            }
            .teacher-delete-dialog-overlay .confirm-dialog-btn-cancel { background-color: #f0f0f0; color: #4C4C4C; }
            .teacher-delete-dialog-overlay .confirm-dialog-btn-cancel:hover { background-color: #e0e0e0; transform: translateY(-2px); }
            .teacher-delete-dialog-overlay .confirm-dialog-btn-confirm-delete {
                background-color: #c62828; color: white;
            }
            .teacher-delete-dialog-overlay .confirm-dialog-btn-confirm-delete:hover {
                background-color: #b71c1c; transform: translateY(-2px);
            }
            @media (max-width: 576px) {
                .teacher-delete-dialog-overlay .confirm-dialog { padding: 24px; width: 95%; }
                .teacher-delete-dialog-overlay .confirm-dialog-title { font-size: 24px; }
                .teacher-delete-dialog-overlay .confirm-dialog-message { font-size: 16px; margin-bottom: 24px; }
                .teacher-delete-dialog-overlay .confirm-dialog-buttons { flex-direction: column; }
                .teacher-delete-dialog-overlay .confirm-dialog-btn { width: 100%; }
            }
        `;
        document.head.appendChild(style);
    }

    function closeTeacherDeleteConfirm(overlay) {
        if (!overlay || !overlay.parentNode) return;
        const dialog = overlay.querySelector('.confirm-dialog');
        if (typeof gsap !== 'undefined') {
            gsap.to(dialog, { scale: 0.9, opacity: 0, duration: 0.3, ease: 'power2.in' });
            gsap.to(overlay, { opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: () => overlay.remove() });
        } else {
            overlay.remove();
        }
    }

    function showDeleteCourseConfirm(courseId, courseTitle) {
        addTeacherDeleteConfirmStyles();
        const existing = document.querySelector('.teacher-delete-dialog-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'confirm-dialog-overlay teacher-delete-dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        dialog.innerHTML = `
            <div class="confirm-dialog-content">
                <div class="confirm-dialog-title">Удалить курс?</div>
                <div class="confirm-dialog-message"></div>
                <div class="confirm-dialog-buttons">
                    <button type="button" class="confirm-dialog-btn confirm-dialog-btn-cancel">Отмена</button>
                    <button type="button" class="confirm-dialog-btn confirm-dialog-btn-confirm-delete">Удалить курс</button>
                </div>
            </div>
        `;
        const msgEl = dialog.querySelector('.confirm-dialog-message');
        const titleText = courseTitle || 'Без названия';
        msgEl.textContent = `Вы действительно хотите удалить курс «${titleText}»? Будут удалены все темы, блоки и материалы. У студентов, подключённых к курсу, он исчезнет из списка вместе с прогрессом. Это действие нельзя отменить.`;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        if (typeof gsap !== 'undefined') {
            gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
            gsap.fromTo(dialog, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'backOut' });
        } else {
            overlay.style.opacity = '1';
        }

        const cancelBtn = dialog.querySelector('.confirm-dialog-btn-cancel');
        const confirmBtn = dialog.querySelector('.confirm-dialog-btn-confirm-delete');

        const removeEsc = () => document.removeEventListener('keydown', escHandler);
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                removeEsc();
                closeTeacherDeleteConfirm(overlay);
            }
        };
        document.addEventListener('keydown', escHandler);

        cancelBtn.addEventListener('click', () => {
            removeEsc();
            closeTeacherDeleteConfirm(overlay);
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                removeEsc();
                closeTeacherDeleteConfirm(overlay);
            }
        });
        confirmBtn.addEventListener('click', async () => {
            removeEsc();
            closeTeacherDeleteConfirm(overlay);
            try {
                const response = await fetch(`/api/courses/${encodeURIComponent(courseId)}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.success) {
                    showNotification(data.message || 'Не удалось удалить курс', 'error');
                    return;
                }
                showNotification('Курс и все связанные данные удалены', 'success');
                userCourses = userCourses.filter((c) => c.id !== courseId);
                displayCourses(userCourses);
                const activeLink = document.querySelector('.courseNavigation a.active');
                if (activeLink && activeLink.textContent.trim() === 'Редактировать курс') {
                    showContent('Редактировать курс');
                }
            } catch (err) {
                console.error(err);
                showNotification('Ошибка сети при удалении курса', 'error');
            }
        });
    }

    // ===============================
    // СОЗДАНИЕ КАРТОЧКИ КУРСА
    // ===============================
    function createCourseCard(course) {
        const cardContainer = document.createElement('div');
        cardContainer.className = 'course-card-container';
        cardContainer.dataset.courseId = course.id;
        
        // Создаем карточку
        const card = document.createElement('div');
        card.className = 'course-card';
        
        // Контейнер для изображения
        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'course-image-wrapper';
        
        // Изображение курса (загруженное пользователем)
        if (course.cover_image) {
            const courseImg = document.createElement('img');
            courseImg.src = course.cover_image;
            courseImg.className = 'course-cover-image';
            courseImg.alt = course.title;
            
            // Обработчик ошибки загрузки изображения
            courseImg.onerror = function() {
                this.style.display = 'none';
                // Показываем заглушку или фон
                imageWrapper.style.backgroundImage = 'url("/images/teacherMainPanel/myCourseCard.svg")';
                imageWrapper.style.backgroundSize = 'cover';
            };
            
            imageWrapper.appendChild(courseImg);
        } else {
            // Если нет изображения, показываем фоновое
            imageWrapper.style.backgroundImage = 'url("/images/teacherMainPanel/myCourseCard.svg")';
            imageWrapper.style.backgroundSize = 'cover';
        }
        
        const editOverlay = document.createElement('div');
        editOverlay.className = 'edit-overlay';

        const actionsRow = document.createElement('div');
        actionsRow.className = 'edit-overlay-actions';

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'course-card-icon-btn';
        editBtn.dataset.action = 'edit';
        editBtn.setAttribute('aria-label', 'Редактировать курс');
        const editIcon = document.createElement('img');
        editIcon.src = '/images/teacherMainPanel/edit.svg';
        editIcon.className = 'course-card-icon-img';
        editIcon.alt = '';
        editBtn.appendChild(editIcon);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'course-card-icon-btn course-card-delete-btn';
        deleteBtn.dataset.action = 'delete';
        deleteBtn.setAttribute('aria-label', 'Удалить курс');
        const deleteIcon = document.createElement('img');
        deleteIcon.src = '/images/teacherMainPanel/delete.svg';
        deleteIcon.className = 'course-card-icon-img';
        deleteIcon.alt = '';
        deleteBtn.appendChild(deleteIcon);

        actionsRow.appendChild(editBtn);
        actionsRow.appendChild(deleteBtn);
        editOverlay.appendChild(actionsRow);
        card.appendChild(imageWrapper);
        card.appendChild(editOverlay);
        cardContainer.appendChild(card);
        
        // Название курса
        const title = document.createElement('div');
        title.className = 'course-card-title';
        title.textContent = course.title || 'Без названия';
        cardContainer.appendChild(title);
        
        return cardContainer;
    }
    
    // ===============================
    // ОТОБРАЖЕНИЕ ИНФОРМАЦИИ О ПОЛЬЗОВАТЕЛЕ
    // ===============================
    function displayUserInfo(user) {
        document.getElementById('userLastName').textContent = user.lastName || '';
        document.getElementById('userFirstName').textContent = user.firstName || '';
        document.getElementById('userPatronymic').textContent = user.patronymic || '';
        document.getElementById('userRole').textContent = 'Преподаватель';

        const avatarEl = document.getElementById('userAvatarImg');
        if (avatarEl) {
            if (user.avatarUrl) {
                avatarEl.src = user.avatarUrl + (user.avatarUrl.includes('?') ? '&' : '?') + 'v=' + Date.now();
            } else {
                avatarEl.src = '/images/userMainPanel/user.svg';
            }
        }
    }

    async function refreshUserFromServer() {
        try {
            const response = await fetch('/api/auth/check', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success && data.user && data.user.role === 'teacher') {
                currentUser = data.user;
                displayUserInfo(data.user);
            }
        } catch (e) {
            console.error('Не удалось обновить профиль', e);
        }
    }

    window.addEventListener('pageshow', (event) => {
        const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
        const backNav = nav && nav.type === 'back_forward';
        if (event.persisted || backNav) {
            refreshUserFromServer();
        }
    });

    // ===============================
    // ОБРАБОТЧИК ВЫХОДА
    // ===============================
    const logoutLink = document.querySelector('.nav-right a[href="/"]');
    if (logoutLink) {
        logoutLink.addEventListener('click', function(e) {
            e.preventDefault();
            localStorage.removeItem('token');
            window.location.href = '/';
        });
    }
    
    // ===============================
    // РАБОТА С DROPDOWN
    // ===============================
    const dropdown = document.querySelector(".dropdown-menu");
    if (dropdown) {
        const toggle = dropdown.querySelector(".dropdown-toggle");
        
        if (toggle) {
            toggle.addEventListener("click", function (e) {
                e.stopPropagation();
                dropdown.classList.toggle("active");
            });
        }
        
        document.addEventListener("click", function (e) {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove("active");
            }
        });
    }
    
    // ===============================
    // ПОИСК КУРСОВ
    // ===============================
    const searchInput = document.getElementById('main-search');
    const searchButton = document.querySelector('.search-img');

    function performSearch() {
        const query = searchInput.value.toLowerCase().trim();
        filterCourses(query);
    }

    function resetSearch() {
        // Показываем все курсы
        const courseCards = document.querySelectorAll('.course-card-container');
        courseCards.forEach(card => {
            if (card.id !== 'createCourseContainer') {
                card.style.display = 'flex';
            }
        });
        
        // Скрываем сообщение о поиске
        const firstMessage = document.getElementById('firstMessage');
        if (firstMessage) {
            const coursesCount = document.querySelectorAll('.course-card-container:not(#createCourseContainer)').length;
            if (coursesCount === 0) {
                firstMessage.textContent = 'У вас пока нет созданных курсов. Создайте свой первый курс!';
                firstMessage.style.display = 'block';
            } else {
                firstMessage.style.display = 'none';
            }
        }
    }

    if (searchInput) {
        // Отслеживаем изменения в поле ввода
        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.trim();
            
            // Если поле пустое - показываем все курсы
            if (query === '') {
                resetSearch();
            }
        });
        
        // Поиск при нажатии Enter
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSearch();
            }
        });
    }

    if (searchButton) {
        // Поиск при клике на кнопку
        searchButton.addEventListener('click', function(e) {
            e.preventDefault();
            performSearch();
        });
        
        // Добавляем стиль курсора для кнопки
        searchButton.style.cursor = 'pointer';
    }

    function filterCourses(query) {
        const courseCards = document.querySelectorAll('.course-card-container');
        let visibleCount = 0;
        
        courseCards.forEach(card => {
            // Пропускаем контейнер создания курса
            if (card.id === 'createCourseContainer') return;
            
            const title = card.querySelector('.course-card-title')?.textContent.toLowerCase() || '';
            
            if (title.includes(query) || query === '') {
                card.style.display = 'flex';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });
        
        // Показываем сообщение, если ничего не найдено
        const firstMessage = document.getElementById('firstMessage');
        if (firstMessage) {
            if (query !== '' && visibleCount === 0) {
                firstMessage.textContent = 'По вашему запросу ничего не найдено';
                firstMessage.style.display = 'block';
            } else if (visibleCount === 0) {
                firstMessage.textContent = 'У вас пока нет созданных курсов. Создайте свой первый курс!';
                firstMessage.style.display = 'block';
            } else {
                firstMessage.style.display = 'none';
            }
        }
    }
    
    // ===============================
    // СОРТИРОВКА КУРСОВ
    // ===============================
    const sortLinks = document.querySelectorAll('.dropdown-content a');
    sortLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sortType = this.textContent;
            
            // Закрываем дропдаун
            dropdown.classList.remove('active');
            
            // Сортируем курсы
            sortCourses(sortType);
        });
    });
    
    function sortCourses(sortType) {
        const coursesContainer = document.querySelector('.courses');
        const createCourseContainer = document.getElementById('createCourseContainer');
        const courseCards = Array.from(document.querySelectorAll('.course-card-container'));
        
        // Удаляем все карточки из контейнера
        courseCards.forEach(card => card.remove());
        
        let sortedCards = [...courseCards];
        
        switch(sortType) {
            case 'По алфавиту':
                sortedCards.sort((a, b) => {
                    const titleA = a.querySelector('.course-card-title')?.textContent || '';
                    const titleB = b.querySelector('.course-card-title')?.textContent || '';
                    return titleA.localeCompare(titleB);
                });
                break;
            case 'Сначала новые':
                sortedCards.sort((a, b) => {
                    const dateA = a.dataset.courseId || '';
                    const dateB = b.dataset.courseId || '';
                    return dateB.localeCompare(dateA);
                });
                break;
            case 'Сначала старые':
                sortedCards.sort((a, b) => {
                    const dateA = a.dataset.courseId || '';
                    const dateB = b.dataset.courseId || '';
                    return dateA.localeCompare(dateB);
                });
                break;
        }
        
        // Вставляем отсортированные карточки
        sortedCards.forEach(card => {
            coursesContainer.insertBefore(card, createCourseContainer);
        });
    }
    

    // ===============================
    // НАВИГАЦИЯ ПО РАЗДЕЛАМ
    // ===============================
    const myCoursesLink = document.getElementById('myCoursesLink');
    const editCourseLink = document.getElementById('editCourseLink');
    const createCourseLink = document.getElementById('createCourseLink');
    const firstMessage = document.getElementById('firstMessage');
    const courseSearching = document.getElementById('courseSearching');
    const createCourseContainer = document.getElementById('createCourseContainer');

    function updateActiveLink(activeLink) {
        [myCoursesLink, editCourseLink, createCourseLink].forEach(link => {
            if (link === activeLink) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        const mobileSelectorText = document.querySelector('.mobile-course-selector-text');
        if (mobileSelectorText && activeLink) {
            mobileSelectorText.textContent = activeLink.textContent.trim();
        }
    }

    function showContent(section) {
        const courseCards = document.querySelectorAll('.course-card-container');
        
        if (section === "Мои курсы") {
            // Показываем все карточки курсов в режиме просмотра
            courseCards.forEach(card => {
                card.style.display = 'flex';
                card.classList.remove('edit-mode');
                card.classList.add('view-mode');
                
                // Убираем обработчик клика на иконку редактирования и скрываем overlay
                const editOverlay = card.querySelector('.edit-overlay');
                if (editOverlay) {
                    editOverlay.style.display = 'none'; // Полностью скрываем overlay
                }
                
                // Добавляем обработчик клика на карточку для перехода к предпросмотру
                card.style.cursor = 'pointer';
                card.onclick = function() {
                    const courseId = card.dataset.courseId;
                    if (courseId) {
                        window.location.href = `/teacher/course-preview?id=${courseId}`;
                    }
                };
            });
            
            // Показываем поиск
            if (courseSearching) {
                courseSearching.style.display = 'flex';
            }
            
            // Скрываем контейнер создания курса
            if (createCourseContainer) {
                createCourseContainer.style.display = 'none';
            }
            
            // Если нет курсов, показываем сообщение
            if (courseCards.length === 0) {
                if (firstMessage) {
                    firstMessage.textContent = "У вас пока нет созданных курсов. Создайте свой первый курс!";
                    firstMessage.style.display = "block";
                }
            } else {
                if (firstMessage) {
                    firstMessage.style.display = "none";
                }
            }
            
        } else if (section === "Редактировать курс") {
            if (createCourseContainer) {
                createCourseContainer.style.display = 'none';
            }

            if (courseSearching) {
                courseSearching.style.display = 'flex';
            }

            if (firstMessage) {
                if (courseCards.length === 0) {
                    firstMessage.textContent = "У вас пока нет курсов для редактирования";
                    firstMessage.style.display = "block";
                } else {
                    firstMessage.style.display = "none";
                }
            }

            courseCards.forEach(card => {
                card.style.display = 'flex';
                card.classList.remove('view-mode');
                card.classList.add('edit-mode');
                
                // Убираем стандартный клик на карточку
                card.style.cursor = 'default';
                card.onclick = null;
                
                // Показываем overlay для редактирования
                const editOverlay = card.querySelector('.edit-overlay');
                if (editOverlay) {
                    editOverlay.style.display = 'flex'; // Показываем overlay
                    editOverlay.style.opacity = '0';
                    editOverlay.style.pointerEvents = 'none';
                    
                    let editBtn = editOverlay.querySelector('[data-action="edit"]');
                    let deleteBtn = editOverlay.querySelector('[data-action="delete"]');
                    if (!editBtn || !deleteBtn) {
                        const actionsRow = document.createElement('div');
                        actionsRow.className = 'edit-overlay-actions';
                        editBtn = document.createElement('button');
                        editBtn.type = 'button';
                        editBtn.className = 'course-card-icon-btn';
                        editBtn.dataset.action = 'edit';
                        editBtn.setAttribute('aria-label', 'Редактировать курс');
                        const ei = document.createElement('img');
                        ei.src = '/images/teacherMainPanel/edit.svg';
                        ei.className = 'course-card-icon-img';
                        ei.alt = '';
                        editBtn.appendChild(ei);
                        deleteBtn = document.createElement('button');
                        deleteBtn.type = 'button';
                        deleteBtn.className = 'course-card-icon-btn course-card-delete-btn';
                        deleteBtn.dataset.action = 'delete';
                        deleteBtn.setAttribute('aria-label', 'Удалить курс');
                        const di = document.createElement('img');
                        di.src = '/images/teacherMainPanel/delete.svg';
                        di.className = 'course-card-icon-img';
                        di.alt = '';
                        deleteBtn.appendChild(di);
                        actionsRow.appendChild(editBtn);
                        actionsRow.appendChild(deleteBtn);
                        editOverlay.innerHTML = '';
                        editOverlay.appendChild(actionsRow);
                        editBtn = editOverlay.querySelector('[data-action="edit"]');
                        deleteBtn = editOverlay.querySelector('[data-action="delete"]');
                    }

                    const actionsParent = editBtn.parentNode;
                    const newEditBtn = editBtn.cloneNode(true);
                    const newDeleteBtn = deleteBtn.cloneNode(true);
                    actionsParent.replaceChild(newEditBtn, editBtn);
                    actionsParent.replaceChild(newDeleteBtn, deleteBtn);

                    newEditBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        const courseId = card.dataset.courseId;
                        window.location.href = `/teacher/create-course?id=${courseId}`;
                    });
                    newDeleteBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        const courseId = card.dataset.courseId;
                        const titleEl = card.querySelector('.course-card-title');
                        const courseTitle = titleEl ? titleEl.textContent.trim() : '';
                        showDeleteCourseConfirm(courseId, courseTitle);
                    });
                    
                    // Добавляем обработчик наведения на карточку
                    card.addEventListener('mouseenter', function() {
                        if (card.classList.contains('edit-mode')) {
                            editOverlay.style.opacity = '1';
                            editOverlay.style.pointerEvents = 'auto';
                        }
                    });
                    
                    card.addEventListener('mouseleave', function() {
                        if (card.classList.contains('edit-mode')) {
                            editOverlay.style.opacity = '0';
                            editOverlay.style.pointerEvents = 'none';
                        }
                    });
                }
            });
            
        } else if (section === "Создать курс") {
            // Скрываем все карточки курсов
            courseCards.forEach(card => {
                card.style.display = 'none';
            });
            
            // Скрываем поиск
            if (courseSearching) {
                courseSearching.style.display = 'none';
            }
            
            // Скрываем сообщение
            if (firstMessage) {
                firstMessage.style.display = 'none';
            }
            
            // Показываем контейнер создания курса
            if (createCourseContainer) {
                createCourseContainer.style.display = 'flex';
            }
        }
    }

    // Добавляем обработчики навигации
    if (myCoursesLink) {
        myCoursesLink.addEventListener("click", function(e) {
            e.preventDefault();
            updateActiveLink(this);
            showContent("Мои курсы");
        });
    }

    if (editCourseLink) {
        editCourseLink.addEventListener("click", function(e) {
            e.preventDefault();
            updateActiveLink(this);
            showContent("Редактировать курс");
        });
    }

    if (createCourseLink) {
        createCourseLink.addEventListener("click", function(e) {
            e.preventDefault();
            updateActiveLink(this);
            showContent("Создать курс");
        });
    }

    function setupMobileCourseSelector() {
        const coursePanel = document.querySelector('.coursePanel');
        const courseNavigation = document.querySelector('.courseNavigation');
        const links = [myCoursesLink, editCourseLink, createCourseLink].filter(Boolean);
        if (!coursePanel || !courseNavigation || links.length === 0 || document.querySelector('.mobile-course-selector')) return;

        const selector = document.createElement('div');
        selector.className = 'mobile-course-selector';
        selector.innerHTML = `
            <button type="button" class="mobile-course-selector-toggle" aria-expanded="false">
                <span class="mobile-course-selector-text">${links.find(link => link.classList.contains('active'))?.textContent.trim() || links[0].textContent.trim()}</span>
                <img src="/images/teacherMainPanel/chevronDown.svg" alt="" class="mobile-course-selector-chevron">
            </button>
            <div class="mobile-course-selector-menu"></div>
        `;

        const menu = selector.querySelector('.mobile-course-selector-menu');
        links.forEach(link => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'mobile-course-selector-item';
            item.textContent = link.textContent.trim();
            item.addEventListener('click', () => {
                link.click();
                selector.classList.remove('active');
                selector.querySelector('.mobile-course-selector-toggle').setAttribute('aria-expanded', 'false');
            });
            menu.appendChild(item);
        });

        selector.querySelector('.mobile-course-selector-toggle').addEventListener('click', () => {
            const isActive = selector.classList.toggle('active');
            selector.querySelector('.mobile-course-selector-toggle').setAttribute('aria-expanded', String(isActive));
        });

        document.addEventListener('click', (event) => {
            if (!selector.contains(event.target)) {
                selector.classList.remove('active');
                selector.querySelector('.mobile-course-selector-toggle').setAttribute('aria-expanded', 'false');
            }
        });

        coursePanel.insertBefore(selector, courseNavigation);
    }

    setupMobileCourseSelector();

    // Добавляем обработчик для карточки создания курса
    const createCourseButton = document.getElementById('createCourseButton');
    if (createCourseButton) {
        createCourseButton.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = '/teacher/create-course';
        });
    }
    
    // ===============================
    // УВЕДОМЛЕНИЯ
    // ===============================
    function showNotification(message, type = 'success') {
        // Добавляем стили, если их нет
        if (!document.getElementById('teacher-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'teacher-notification-styles';
            style.textContent = `
                .teacher-toast {
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
                .teacher-toast.success { border-left: 6px solid #4CAF50; }
                .teacher-toast.error { border-left: 6px solid #FF3B3B; }
                .teacher-toast.warning { border-left: 6px solid #FFB800; }
                .toast-content { flex: 1; }
                .toast-title {
                    font-weight: 600;
                    font-size: 16px;
                    color: #1D1D1D;
                    margin-bottom: 4px;
                }
                .toast-message {
                    font-size: 14px;
                    color: #4C4C4C;
                    line-height: 1.5;
                }
                .toast-close {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: rgba(0, 0, 0, 0.05);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 18px;
                    color: #666;
                    transition: all 0.2s ease;
                    flex-shrink: 0;
                }
                .toast-close:hover {
                    background: rgba(0, 0, 0, 0.1);
                    transform: scale(1.1);
                }
                @keyframes slideInRight {
                    from { opacity: 0; transform: translateX(100px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                @keyframes slideOutRight {
                    from { opacity: 1; transform: translateX(0); }
                    to { opacity: 0; transform: translateX(100px); }
                }
                .teacher-toast.hiding {
                    animation: slideOutRight 0.3s ease forwards;
                }
            `;
            document.head.appendChild(style);
        }
        
        const oldToasts = document.querySelectorAll('.teacher-toast');
        oldToasts.forEach(toast => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        });
        
        const toast = document.createElement('div');
        toast.className = `teacher-toast ${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-title">${type === 'success' ? 'Успешно' : type === 'warning' ? 'Внимание' : 'Ошибка'}</div>
                <div class="toast-message">${message}</div>
            </div>
            <div class="toast-close">✕</div>
        `;
        
        document.body.appendChild(toast);
        
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        });
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.add('hiding');
                setTimeout(() => toast.remove(), 300);
            }
        }, 3000);
    }

    // ===============================
    // ИНИЦИАЛИЗАЦИЯ АКТИВНОГО РАЗДЕЛА
    // ===============================
    // После загрузки курсов проверяем активный раздел и применяем стили
    const activeLink = document.querySelector('.courseNavigation a.active');
    if (activeLink) {
        showContent(activeLink.textContent);
    } else {
        // По умолчанию активируем "Мои курсы"
        if (myCoursesLink) {
            myCoursesLink.classList.add('active');
            showContent("Мои курсы");
        }
    }

    // ===============================
    // АНИМАЦИИ GSAP
    // ===============================
    gsap.set('body', { opacity: 0 });

    gsap.to('body', {
        opacity: 1,
        duration: 0.8,
        ease: 'power3.out'
    });

    gsap.from('header', {
        y: -30,
        opacity: 0,
        duration: 0.8,
        delay: 0.2,
        ease: 'power3.out'
    });

    gsap.from('.profile-section', {
        y: 30,
        opacity: 0,
        duration: 0.8,
        delay: 0.3,
        ease: 'power3.out'
    });

    gsap.from('.coursePanel', {
        y: 30,
        opacity: 0,
        duration: 0.8,
        delay: 0.3,
        ease: 'power3.out',
        clearProps: 'all'
    });

    // Показываем страницу
    setTimeout(() => {
        document.documentElement.classList.add('ready');
    }, 100);
});