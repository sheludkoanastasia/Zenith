document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.classList.add('ready');
});

// Элементы меню
const hamburgerMenu = document.getElementById('hamburgerMenu');
const dropdownMenu = document.getElementById('dropdownMenu');
const loginLink = document.querySelector('.login-link');
const registrationButton = document.querySelector('.registration-button');

// Флаг для отслеживания анимации меню
let isMenuAnimating = false;

// Функция для плавной прокрутки
function smoothScrollToSection(sectionSelector) {
    const section = document.querySelector(sectionSelector);
    if (section) {
        const headerOffset = 100;
        const elementPosition = section.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }
}

// Функция для безопасного перехода после анимации меню
function safeNavigateAfterMenu(url) {
    if (isMenuAnimating) return;
    isMenuAnimating = true;
    
    // Закрываем меню
    hamburgerMenu.classList.remove('active');
    dropdownMenu.classList.remove('active');
    
    // Даем время на анимацию закрытия меню (300ms)
    setTimeout(() => {
        // Останавливаем все анимации GSAP
        if (gsap && gsap.globalTimeline) {
            gsap.globalTimeline.clear();
        }
        
        // Очищаем таймеры
        const highestTimeoutId = setTimeout(() => {});
        for (let i = 0; i < highestTimeoutId; i++) {
            clearTimeout(i);
        }
        
        // Переходим на страницу
        window.location.href = url;
        
        // Сбрасываем флаг через небольшую задержку
        setTimeout(() => {
            isMenuAnimating = false;
        }, 500);
    }, 300); // Ждем завершения анимации меню
}

// Обработчики для ссылок "Студентам" и "Преподавателям"
document.addEventListener('DOMContentLoaded', function() {
    // Все ссылки "Студентам"
    const studentLinks = document.querySelectorAll('.nav-center a, .dropdown-menu a:not(.loginText)');
    studentLinks.forEach(link => {
        if (link.textContent.trim() === 'Студентам') {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                closeMenuOnLinkClick();
                setTimeout(() => {
                    smoothScrollToSection('.students-section');
                }, 300);
            });
        }
    });

    // Все ссылки "Преподавателям"
    const teacherLinks = document.querySelectorAll('.nav-center a, .dropdown-menu a:not(.loginText)');
    teacherLinks.forEach(link => {
        if (link.textContent.trim() === 'Преподавателям') {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                closeMenuOnLinkClick();
                setTimeout(() => {
                    smoothScrollToSection('.teachers-header');
                }, 300);
            });
        }
    });
    
    // Специально для ссылки "Войти" в выпадающем меню
    const loginTextLinks = document.querySelectorAll('.dropdown-menu a.loginText');
    loginTextLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            safeNavigateAfterMenu('/auth');
        });
    });
    
    // Ссылка "Войти" в навбаре
    const loginLink = document.querySelector('.nav-right a.login-link');
    if (loginLink) {
        loginLink.addEventListener('click', function(e) {
            e.preventDefault();
            // Для навбара меню не открыто, переходим сразу
            window.location.href = '/auth';
        });
    }
    
    // Кнопка регистрации
    const registrationButton = document.querySelector('.registration-button');
    if (registrationButton) {
        registrationButton.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = '/auth#register';
        });
    }
    
    // Ссылка "авторизацию" в тексте
    const authLink = document.querySelector('.auth-link');
    if (authLink) {
        authLink.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = '/auth';
        });
    }
});

// Открытие/закрытие выпадающего меню
function toggleDropdownMenu() {
    if (isMenuAnimating) return;
    hamburgerMenu.classList.toggle('active');
    dropdownMenu.classList.toggle('active');
}

// Закрытие меню при клике вне его
function closeDropdownMenu(e) {
    if (!hamburgerMenu.contains(e.target) && !dropdownMenu.contains(e.target)) {
        if (hamburgerMenu.classList.contains('active')) {
            hamburgerMenu.classList.remove('active');
            dropdownMenu.classList.remove('active');
        }
    }
}

// Закрытие меню при клике на ссылку
function closeMenuOnLinkClick() {
    if (hamburgerMenu.classList.contains('active')) {
        hamburgerMenu.classList.remove('active');
        dropdownMenu.classList.remove('active');
    }
}

// Обработчики событий
hamburgerMenu.addEventListener('click', function(e) {
    e.stopPropagation();
    toggleDropdownMenu();
});

// Закрытие меню при клике вне его
document.addEventListener('click', closeDropdownMenu);

// Закрытие меню при нажатии Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeMenuOnLinkClick();
    }
});

// Закрытие меню при изменении размера окна на десктоп
window.addEventListener('resize', function() {
    if (window.innerWidth > 576) {
        closeMenuOnLinkClick();
    }
});

// Функция для обновления высоты .next-container
function updateNextContainerHeight() {
    const mainContainer = document.querySelector('.main-container');
    const nextContainer = document.querySelector('.next-container');
    
    if (mainContainer && nextContainer) {
        const mainHeight = mainContainer.offsetHeight;
        nextContainer.style.height = mainHeight + 'px';
        nextContainer.style.minHeight = mainHeight + 'px';
    }
}

// Функция для перемещения правой секции на мобильных устройствах
function moveRightSectionForMobile() {
    const rightSection = document.querySelector('.right-section');
    const nextContainer = document.querySelector('.next-container');
    const contentOverlay = document.querySelector('.content-overlay');
    
    if (window.innerWidth <= 992) {
        if (nextContainer.children.length === 0 && contentOverlay.contains(rightSection)) {
            nextContainer.appendChild(rightSection);
        }
    } else {
        if (nextContainer.contains(rightSection)) {
            contentOverlay.appendChild(rightSection);
        }
    }
    
    updateNextContainerHeight();
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    moveRightSectionForMobile();
    
    window.addEventListener('load', function() {
        setTimeout(updateNextContainerHeight, 100);
    });
});

// Обновляем при изменении размера окна
window.addEventListener('resize', function() {
    moveRightSectionForMobile();
    updateNextContainerHeight();
});

// Наблюдатель за изменениями размеров
const observer = new ResizeObserver(function() {
    updateNextContainerHeight();
});

const mainContainer = document.querySelector('.main-container');
if (mainContainer) {
    observer.observe(mainContainer);
}

// Анимации с GSAP
document.addEventListener('DOMContentLoaded', () => {
    
    // Регистрируем плагин ScrollTrigger
    gsap.registerPlugin(ScrollTrigger);
    
    // 1. Анимация появления хедера
    gsap.from('header', {
        y: -50,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out'
    });
    
    // 2. Анимация главного экрана
    const mainTl = gsap.timeline({});
    
    mainTl
        .from('.main-background', {
            scale: 1.1,
            opacity: 0,
            duration: 1,
            ease: 'power2.out'
        })
        .from('.main-glass', {
            opacity: 0,
            duration: 1.2,
            ease: 'power2.inOut'
        }, '-=0.8')
        .from('.left-section .title', {
            x: -50,
            opacity: 0,
            duration: 0.8,
            ease: 'power2.out'
        }, '-=0.6')
        .from('.left-section .subtitle', {
            x: -30,
            opacity: 0,
            duration: 0.8,
            ease: 'power2.out'
        }, '-=0.5')
        .from('.registration-section', {
            y: 30,
            opacity: 0,
            duration: 0.6,
            ease: 'power2.out'
        }, '-=0.4')
        .from('.right-image', {
            scale: 0.8,
            opacity: 0,
            duration: 1,
            ease: 'back.out(1.2)'
        }, '-=0.8');
    
    // 3. Анимация выпадающего меню
    gsap.from('.dropdown-menu', {
        opacity: 0,
        y: -10,
        duration: 0.3,
        ease: 'power2.out',
        paused: true
    });
    
    // Отслеживаем изменение класса для анимации
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.attributeName === 'class') {
                if (dropdownMenu.classList.contains('active')) {
                    gsap.to('.dropdown-menu', {
                        opacity: 1,
                        y: 0,
                        duration: 0.3,
                        ease: 'power2.out'
                    });
                }
            }
        });
    });
    
    observer.observe(dropdownMenu, { attributes: true });
    
    // Остальные анимации (студенты, преподаватели, и т.д.) остаются без изменений
    // ... (весь остальной код анимаций)
    
});