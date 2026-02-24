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
        
        displayUserInfo(data.user);
        
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
    // НАВИГАЦИЯ ПО РАЗДЕЛАМ
    // ===============================
    const myCoursesLink = document.getElementById('myCoursesLink');
    const createCourseLink = document.getElementById('createCourseLink');
    const firstMessage = document.getElementById('firstMessage');
    
    function updateActiveLink(activeLink) {
        [myCoursesLink, createCourseLink].forEach(link => {
            if (link === activeLink) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }
    
    function showContent(section) {
        if (section === "Мои курсы") {
            firstMessage.textContent = "У вас пока нет созданных курсов. Создайте свой первый курс!";
            firstMessage.style.display = "block";
        } else if (section === "Создать курс") {
            firstMessage.textContent = "Создание нового курса";
            firstMessage.style.display = "block";
        }
    }
    
    if (myCoursesLink) {
        myCoursesLink.addEventListener("click", function(e) {
            e.preventDefault();
            updateActiveLink(this);
            showContent("Мои курсы");
        });
    }
    
    if (createCourseLink) {
        createCourseLink.addEventListener("click", function(e) {
            e.preventDefault();
            updateActiveLink(this);
            showContent("Создать курс");
        });
    }
    
    // Анимации
    gsap.from('header', {
        y: -50,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out'
    });
    
    gsap.from('.profile-section', {
        y: 30,
        opacity: 0,
        duration: 0.8,
        delay: 0.2,
        ease: 'power2.out'
    });
    
    // Показываем страницу
    setTimeout(() => {
        document.documentElement.classList.add('ready');
    }, 100);
});