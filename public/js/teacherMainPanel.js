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
    
    // ===============================
    // ОТОБРАЖЕНИЕ КУРСОВ
    // ===============================
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
                coursesContainer.appendChild(courseCard);
            });
        }
        
        // Управляем отображением контейнера создания курса
        if (createCourseContainer) {
            createCourseContainer.style.display = 'none';
        }
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
        
        // Создаем overlay для иконки редактирования
        const editOverlay = document.createElement('div');
        editOverlay.className = 'edit-overlay';
        
        const editIcon = document.createElement('img');
        editIcon.src = '/images/teacherMainPanel/edit.svg';
        editIcon.className = 'edit-icon-overlay';
        editIcon.alt = 'Редактировать';
        
        editOverlay.appendChild(editIcon);
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
    }

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
                    editOverlay.style.pointerEvents = 'none';
                    editOverlay.style.opacity = '0'; // Принудительно скрываем overlay
                }
                
                // Добавляем обработчик клика на карточку для перехода
                card.style.cursor = 'pointer';
                card.onclick = function() {
                    showNotification('Редактирование курса будет доступно в разделе "Редактировать курс"', 'warning');
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
            // Показываем все карточки курсов в режиме редактирования
            courseCards.forEach(card => {
                card.style.display = 'flex';
                card.classList.remove('view-mode');
                card.classList.add('edit-mode');
                
                // Убираем стандартный клик на карточку
                card.style.cursor = 'default';
                card.onclick = null;
                
                // Настраиваем overlay для показа только при наведении
                const editOverlay = card.querySelector('.edit-overlay');
                if (editOverlay) {
                    // Убеждаемся, что overlay скрыт по умолчанию
                    editOverlay.style.opacity = '0';
                    editOverlay.style.pointerEvents = 'none';
                    
                    // Находим или создаем иконку
                    let editIcon = editOverlay.querySelector('.edit-icon-overlay');
                    if (!editIcon) {
                        editIcon = document.createElement('img');
                        editIcon.src = '/images/teacherMainPanel/edit.svg';
                        editIcon.className = 'edit-icon-overlay';
                        editIcon.alt = 'Редактировать';
                        editOverlay.appendChild(editIcon);
                    }
                    
                    // Удаляем старый обработчик, если есть
                    const newEditIcon = editIcon.cloneNode(true);
                    editIcon.parentNode.replaceChild(newEditIcon, editIcon);
                    
                    // Добавляем обработчик на иконку
                    newEditIcon.addEventListener('click', function(e) {
                        e.stopPropagation();
                        const courseId = card.dataset.courseId;
                        window.location.href = `/teacher/create-course?id=${courseId}`;
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
                    firstMessage.textContent = "У вас пока нет созданных курсов для редактирования";
                    firstMessage.style.display = "block";
                }
            } else {
                if (firstMessage) {
                    firstMessage.style.display = "none";
                }
            }
            
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