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
    let allCourses = []; // Хранилище всех курсов для фильтрации
    let currentFilter = 'all'; // Текущий фильтр: all, alphabet, new, old, progress
    
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
        
        if (data.user.role === 'teacher') {
            window.location.href = '/teacher';
            return;
        }
        
        currentUser = data.user;
        displayUserInfo(data.user);
        
        await loadMyCourses();
        
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        localStorage.removeItem('token');
        window.location.href = '/auth';
        return;
    }
    
    // ===============================
    // ОТОБРАЖЕНИЕ ИНФОРМАЦИИ О ПОЛЬЗОВАТЕЛЕ
    // ===============================
    function displayUserInfo(user) {
        document.getElementById('userLastName').textContent = user.lastName || '';
        document.getElementById('userFirstName').textContent = user.firstName || '';
        document.getElementById('userPatronymic').textContent = user.patronymic || '';
        
        const userRoleElement = document.querySelector('.user-role');
        if (userRoleElement) {
            userRoleElement.textContent = 'Студент';
        }
    }
    
    // ===============================
    // ЗАГРУЗКА КУРСОВ СТУДЕНТА
    // ===============================
    async function loadMyCourses() {
        try {
            const response = await fetch('/api/courses/my-courses', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const data = await response.json();
            console.log('Загружены курсы:', data);
            
            if (data.success) {
                allCourses = data.courses || [];
                // Выводим даты для проверки
                allCourses.forEach(course => {
                    console.log(`Курс: ${course.title}, joined_at: ${course.joined_at}, created_at: ${course.created_at}`);
                });
                applyFilterAndSearch();
            }
        } catch (error) {
            console.error('Ошибка загрузки курсов:', error);
            allCourses = [];
            applyFilterAndSearch();
        }
    }
    
    // ===============================
    // ФИЛЬТРАЦИЯ И ПОИСК
    // ===============================
    function applyFilterAndSearch() {
        const searchInput = document.getElementById('main-search');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        
        let filteredCourses = [...allCourses];
        
        // Поиск по названию курса
        if (searchTerm) {
            filteredCourses = filteredCourses.filter(course => 
                course.title.toLowerCase().includes(searchTerm)
            );
        }
        
        // Сортировка
        switch (currentFilter) {
            case 'alphabet':
                filteredCourses.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'new':
                // Сначала новые - по дате подключения (joined_at)
                filteredCourses.sort((a, b) => {
                    const dateA = new Date(a.joined_at || a.created_at);
                    const dateB = new Date(b.joined_at || b.created_at);
                    return dateB - dateA;
                });
                break;
            case 'old':
                // Сначала старые - по дате подключения (joined_at)
                filteredCourses.sort((a, b) => {
                    const dateA = new Date(a.joined_at || a.created_at);
                    const dateB = new Date(b.joined_at || b.created_at);
                    return dateA - dateB;
                });
                break;
            default:
                // По умолчанию - сначала новые по дате подключения
                filteredCourses.sort((a, b) => {
                    const dateA = new Date(a.joined_at || a.created_at);
                    const dateB = new Date(b.joined_at || b.created_at);
                    return dateB - dateA;
                });
                break;
        }
        
        renderCourses(filteredCourses);
    }
    
    function renderCourses(courses) {
        const coursesContainer = document.querySelector('.courses');
        if (!coursesContainer) return;
        
        coursesContainer.innerHTML = '';
        
        if (courses.length === 0) {
            coursesContainer.innerHTML = '<span class="firstMessage">Курсы не найдены</span>';
            return;
        }
        
        courses.forEach(course => {
            const courseCard = createCourseCard(course);
            coursesContainer.appendChild(courseCard);
        });
    }
    
    function createCourseCard(course) {
        const container = document.createElement('div');
        container.className = 'course-card-container';
        
        const coverImage = course.cover_image || '';
        
        container.innerHTML = `
            <div class="course-card">
                <div class="course-image-wrapper">
                    ${coverImage ? `<img src="${coverImage}" alt="${escapeHtml(course.title)}" class="course-cover-image">` : ''}
                </div>
            </div>
            <div class="course-card-title">${escapeHtml(course.title)}</div>
        `;
        
        container.addEventListener('click', () => {
            window.location.href = `/course-preview?id=${course.id}`;
        });
        
        return container;
    }
    
    function showEmptyMessage() {
        const coursesContainer = document.querySelector('.courses');
        if (coursesContainer) {
            coursesContainer.innerHTML = '<span class="firstMessage">Еще ничего не добавлено. Стоит пройти свой первый курс!</span>';
        }
    }
    
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    // ===============================
    // ПОДКЛЮЧЕНИЕ К КУРСУ ПО ССЫЛКЕ
    // ===============================
    async function connectToCourse(link) {
        const match = link.match(/\/join\/([A-Z0-9]+)$/i);
        if (!match) {
            showNotification('Неверная ссылка на курс', 'warning');
            return false;
        }
        
        const joinCode = match[1];
        
        try {
            const response = await fetch('/api/courses/join', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ joinCode })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification('Вы успешно подключились к курсу!', 'success');
                await loadMyCourses();
                
                const myCoursesLink = Array.from(updatedNavLinks).find(link => link.textContent === "Мои курсы");
                if (myCoursesLink) {
                    updateActiveLink(myCoursesLink);
                    showContent("Мои курсы");
                }
                return true;
            } else {
                showNotification(data.message || 'Ошибка подключения', 'warning');
                return false;
            }
        } catch (error) {
            console.error('Ошибка подключения:', error);
            showNotification('Ошибка при подключении к курсу', 'error');
            return false;
        }
    }
    
    function showNotification(message, type = 'info') {
        addNotificationStyles();
        
        const oldToasts = document.querySelectorAll('.user-toast');
        oldToasts.forEach(toast => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        });
        
        const toast = document.createElement('div');
        toast.className = `user-toast ${type}`;
        
        let title = '';
        switch (type) {
            case 'success': title = 'Успешно'; break;
            case 'error': title = 'Ошибка'; break;
            case 'warning': title = 'Внимание'; break;
            default: title = 'Информация';
        }
        
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
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
        }, 3000);
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
    
    // ========== РАБОТА С DROPDOWN ==========
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
    
   // ========== РАБОТА С ФИЛЬТРАМИ ==========
    function setupFilters() {
        const filterItems = document.querySelectorAll('.dropdown-content a');
        console.log('Найдено элементов фильтров:', filterItems.length);
        
        filterItems.forEach(item => {
            console.log('Элемент:', item.textContent, 'data-filter:', item.getAttribute('data-filter'));
            
            item.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const filterValue = this.getAttribute('data-filter');
                console.log('Выбран фильтр:', filterValue);
                
                // Обновляем currentFilter
                switch (filterValue) {
                    case 'alphabet':
                        currentFilter = 'alphabet';
                        break;
                    case 'new':
                        currentFilter = 'new';
                        break;
                    case 'old':
                        currentFilter = 'old';
                        break;
                    default:
                        currentFilter = 'new';
                }
                
                console.log('currentFilter установлен:', currentFilter);
                
                // Применяем фильтрацию и поиск
                applyFilterAndSearch();
                
                // Закрываем dropdown
                const dropdown = document.querySelector('.dropdown-menu');
                if (dropdown) {
                    dropdown.classList.remove('active');
                }
            });
        });
    }

    // ========== РАБОТА С ПОИСКОМ ==========
    function setupSearch() {
        const searchInput = document.getElementById('main-search');
        const searchBtn = document.querySelector('.search-img');
        
        if (searchBtn && searchInput) {
            // Поиск по кнопке
            searchBtn.addEventListener('click', function() {
                applyFilterAndSearch();
            });
            
            // Поиск по Enter
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    applyFilterAndSearch();
                }
            });
            
            // При изменении поля (включая очистку)
            searchInput.addEventListener('input', function() {
                applyFilterAndSearch();
            });
        }
    }
    
    // ========== РАБОТА С НАВИГАЦИЕЙ КУРСОВ ==========
    const navLinks = document.querySelectorAll(".courseNavigation a");
    
    // Удаляем ссылку "Все курсы" из DOM
    const allCoursesLink = Array.from(navLinks).find(link => link.textContent === "Все курсы");
    if (allCoursesLink) {
        allCoursesLink.remove();
    }
    
    // Обновляем список ссылок после удаления
    const updatedNavLinks = document.querySelectorAll(".courseNavigation a");
    
    function updateActiveLink(activeLink) {
        updatedNavLinks.forEach(link => {
            if (link === activeLink) {
                link.style.fontSize = "32px";
                link.style.fontWeight = "400";
            } else {
                link.style.fontSize = "22px";
                link.style.fontWeight = "400";
                link.style.color = "#1D1D1D";
            }
        });
    }
    
    function clearExtraContent() {
        const linkContainer = document.querySelector(".link-container");
        if (linkContainer) {
            linkContainer.remove();
        }
    }
    
    function createLinkInputWithButton() {
        const linkContainer = document.createElement("div");
        linkContainer.className = "link-container";
        
        const linkInput = document.createElement("input");
        linkInput.type = "text";
        linkInput.className = "form-input link-input";
        linkInput.placeholder = "Вставьте ссылку на курс";
        
        const linkButton = document.createElement("img");
        linkButton.className = "link-button-img";
        linkButton.src = "/images/userMainPanel/send.svg";
        linkButton.alt = "Подключиться";
        
        linkButton.addEventListener("click", async function() {
            const link = linkInput.value.trim();
            if (link) {
                await connectToCourse(link);
                linkInput.value = '';
            } else {
                showNotification("Введите ссылку на курс", "warning");
            }
        });
        
        linkContainer.appendChild(linkInput);
        linkContainer.appendChild(linkButton);
        
        return linkContainer;
    }
    
    function showContent(section) {
        const firstMessage = document.querySelector(".firstMessage");
        const courseSearching = document.getElementById('courseSearching');
        const coursesContainer = document.querySelector('.courses');
        
        // Очищаем контейнер курсов
        if (coursesContainer) {
            coursesContainer.innerHTML = '';
        }
        
        if (section === "Мои курсы") {
            if (firstMessage) {
                firstMessage.style.display = "none";
                courseSearching.style.display = "flex";
            }
            // Сбрасываем поиск и фильтр при переходе на вкладку
            const searchInput = document.getElementById('main-search');
            if (searchInput) {
                searchInput.value = '';
            }
            currentFilter = 'new';
            applyFilterAndSearch();
        } else if (section === "Подключиться по ссылке") {
            if (firstMessage) {
                firstMessage.style.display = "none";
                courseSearching.style.display = "none";
            }
            
            // Создаем отдельный контейнер для подключения
            const connectionContainer = document.createElement('div');
            connectionContainer.className = 'connection-container';
            connectionContainer.innerHTML = `
                <div class="firstMessage connection-message">Введите ссылку для подключения к курсу</div>
                <div class="link-container">
                    <input type="text" class="form-input link-input" placeholder="Вставьте ссылку на курс">
                    <img class="link-button-img" src="/images/userMainPanel/send.svg" alt="Подключиться">
                </div>
            `;
            
            if (coursesContainer) {
                coursesContainer.appendChild(connectionContainer);
            }
            
            // Добавляем обработчик
            const linkInput = document.querySelector('.link-input');
            const linkButton = document.querySelector('.link-button-img');
            
            if (linkButton && linkInput) {
                const newLinkButton = linkButton.cloneNode(true);
                linkButton.parentNode.replaceChild(newLinkButton, linkButton);
                
                newLinkButton.addEventListener('click', async function() {
                    const link = linkInput.value.trim();
                    if (link) {
                        await connectToCourse(link);
                        linkInput.value = '';
                    } else {
                        showNotification("Введите ссылку на курс", "warning");
                    }
                });
            }
        }
    }
    
    // Обновляем обработчики для оставшихся ссылок
    updatedNavLinks.forEach(link => {
        link.addEventListener("click", function(e) {
            e.preventDefault();
            updateActiveLink(this);
            showContent(this.textContent);
        });
    });
    
    const myCoursesLink = Array.from(updatedNavLinks).find(link => link.textContent === "Мои курсы");
    if (myCoursesLink) {
        updateActiveLink(myCoursesLink);
        showContent("Мои курсы");
    }
    
    // Инициализация фильтров и поиска
    setupFilters();
    setupSearch();

    // Анимации
    gsap.set('body', { opacity: 0 });
    gsap.to('body', { opacity: 1, duration: 0.8, ease: 'power3.out' });
    gsap.from('header', { y: -30, opacity: 0, duration: 0.8, delay: 0.2, ease: 'power3.out' });
    gsap.from('.profile-section', { y: 30, opacity: 0, duration: 0.8, delay: 0.3, ease: 'power3.out' });
    gsap.from('.coursePanel', { y: 30, opacity: 0, duration: 0.8, delay: 0.3, ease: 'power3.out', clearProps: 'all' });

    setTimeout(() => {
        document.documentElement.classList.add('ready');
    }, 100);
});