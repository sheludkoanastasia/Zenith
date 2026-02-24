document.addEventListener('DOMContentLoaded', () => {
    addStylesForMainPage();
    document.documentElement.classList.add('ready');
});

// Элементы меню
const hamburgerMenu = document.getElementById('hamburgerMenu');
const dropdownMenu = document.getElementById('dropdownMenu');
const loginLink = document.querySelector('.login-link');
const registrationButton = document.querySelector('.registration-button');

function addStylesForMainPage() {
    if (!document.getElementById('main-page-styles')) {
        const style = document.createElement('style');
        style.id = 'main-page-styles';
        style.textContent = `
            .error-toast {
                position: fixed;
                top: 100px;
                right: 30px;
                min-width: 320px;
                max-width: 400px;
                background: rgba(255, 255, 255, 0.98);
                backdrop-filter: blur(10px);
                border-radius: 16px;
                padding: 16px 20px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), 0 6px 12px rgba(0, 0, 0, 0.1);
                display: flex;
                align-items: flex-start;
                gap: 12px;
                z-index: 9999;
                border: 1px solid rgba(255, 255, 255, 0.3);
                animation: slideInRight 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55);
            }
            
            .error-toast.error {
                border-left: 6px solid #FF3B3B;
                background: linear-gradient(135deg, rgba(255, 59, 59, 0.05) 0%, rgba(255, 255, 255, 0.98) 100%);
            }
            
            .error-toast.warning {
                border-left: 6px solid #FFB800;
                background: linear-gradient(135deg, rgba(255, 184, 0, 0.05) 0%, rgba(255, 255, 255, 0.98) 100%);
            }
            
            .error-content {
                flex: 1;
            }
            
            .error-title {
                font-weight: 600;
                font-size: 16px;
                color: #1D1D1D;
                margin-bottom: 4px;
            }
            
            .error-message {
                font-size: 14px;
                color: #4C4C4C;
                line-height: 1.5;
            }
            
            .error-close {
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
            
            .error-close:hover {
                background: rgba(0, 0, 0, 0.1);
                transform: scale(1.1);
            }
            
            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(100px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            @keyframes slideOutRight {
                from {
                    opacity: 1;
                    transform: translateX(0);
                }
                to {
                    opacity: 0;
                    transform: translateX(100px);
                }
            }
            
            .error-toast.hiding {
                animation: slideOutRight 0.3s ease forwards;
            }
        `;
        document.head.appendChild(style);
    }
}

// Функция для показа уведомлений (скопирована из auth.js)
function showNotification(message, type = 'error') {
    const oldToasts = document.querySelectorAll('.error-toast');
    oldToasts.forEach(toast => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    });
    
    const toast = document.createElement('div');
    toast.className = `error-toast ${type}`;
    
    toast.innerHTML = `
        <div class="error-content">
            <div class="error-title">${type === 'error' ? 'Ошибка' : 'Внимание'}</div>
            <div class="error-message">${message}</div>
        </div>
        <div class="error-close">✕</div>
    `;
    
    document.body.appendChild(toast);
    
    const closeBtn = toast.querySelector('.error-close');
    closeBtn.addEventListener('click', () => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    });
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

// Функция для плавной прокрутки
function smoothScrollToSection(sectionSelector) {
    const section = document.querySelector(sectionSelector);
    if (section) {
        const headerOffset = 100; // Отступ сверху в пикселях
        const elementPosition = section.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }
}

// Обработчики для ссылок "Студентам" и "Преподавателям"
document.addEventListener('DOMContentLoaded', function() {
    // Все ссылки "Студентам"
    const studentLinks = document.querySelectorAll('.nav-center a, .dropdown-menu a:not(.loginText)');
    studentLinks.forEach(link => {
        if (link.textContent.trim() === 'Студентам') {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                smoothScrollToSection('.students-section');
                closeMenuOnLinkClick();
            });
        }
    });

    // Все ссылки "Преподавателям" - прокрутка до teachers-header
    const teacherLinks = document.querySelectorAll('.nav-center a, .dropdown-menu a:not(.loginText)');
    teacherLinks.forEach(link => {
        if (link.textContent.trim() === 'Преподавателям') {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                smoothScrollToSection('.teachers-header');
                closeMenuOnLinkClick();
            });
        }
    });
});

// Открытие/закрытие выпадающего меню
function toggleDropdownMenu() {
    hamburgerMenu.classList.toggle('active');
    dropdownMenu.classList.toggle('active');
}

// Закрытие меню при клике вне его
function closeDropdownMenu(e) {
    if (!hamburgerMenu.contains(e.target) && !dropdownMenu.contains(e.target)) {
        hamburgerMenu.classList.remove('active');
        dropdownMenu.classList.remove('active');
    }
}

// Закрытие меню при клике на ссылку
function closeMenuOnLinkClick() {
    hamburgerMenu.classList.remove('active');
    dropdownMenu.classList.remove('active');
}

// Обработчики событий
hamburgerMenu.addEventListener('click', function(e) {
    e.stopPropagation();
    toggleDropdownMenu();
});

// Закрытие меню при клике вне его
document.addEventListener('click', closeDropdownMenu);

// Закрытие меню при клике на ссылки в меню
const dropdownLinks = document.querySelectorAll('.dropdown-menu a');
dropdownLinks.forEach(link => {
    link.addEventListener('click', closeMenuOnLinkClick);
});

// Обработчик для кнопки "Зарегистрироваться" с принудительным переходом
if (registrationButton) {
    registrationButton.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Проверяем, авторизован ли пользователь
        const token = localStorage.getItem('token');
        
        if (token) {
            // Если авторизован - показываем уведомление
            showNotification('Чтобы создать новый аккаунт, сначала выйдите из текущего', 'warning');
            return; // Не переходим на страницу регистрации
        }
        
        // Если не авторизован - переходим на страницу регистрации
        window.location.href = '/auth#register';
    });
}


// Закрытие меню при изменении размера окна на десктоп
window.addEventListener('resize', function() {
    if (window.innerWidth > 576) {
        hamburgerMenu.classList.remove('active');
        dropdownMenu.classList.remove('active');
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

// Закрытие меню при нажатии Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        hamburgerMenu.classList.remove('active');
        dropdownMenu.classList.remove('active');
    }
});


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
    
    // 2. Анимация главного экрана - НАЧИНАЕТСЯ РАНЬШЕ
    const mainTl = gsap.timeline({
        
    });
    
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
    
    // 3. Анимации для секций при скролле
    // Студенты - заголовок
    gsap.from('.students-header', {
        scrollTrigger: {
            trigger: '.students-section',
            start: 'top 80%',
            toggleActions: 'play none none reverse'
        },
        y: 40,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out'
    });
    
    // Студенты - текст
    gsap.from('.students-text-content', {
        scrollTrigger: {
            trigger: '.students-text-content',
            start: 'top 80%',
            toggleActions: 'play none none reverse'
        },
        y: 50,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out'
    });
    
    // Карточки студентов - поочередное появление
    gsap.from('.image-frame', {
        scrollTrigger: {
            trigger: '.students-images',
            start: 'top 75%',
            toggleActions: 'play none none reverse'
        },
        y: 60,
        opacity: 0,
        duration: 0.6,
        stagger: 0.15,
        ease: 'back.out(1.2)'
    });
    
    // Секция обсуждения
    gsap.from('.students-section-disscution', {
        scrollTrigger: {
            trigger: '.students-section-disscution',
            start: 'top 80%',
            toggleActions: 'play none none reverse'
        },
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out'
    });
    
    // Появление текста слева/справа в зависимости от разрешения
    ScrollTrigger.matchMedia({
        // Для десктопа (> 650px)
        '(min-width: 651px)': function() {
            gsap.from('.students-text-content-disscution', {
                scrollTrigger: {
                    trigger: '.students-section-disscution',
                    start: 'top 75%',
                    toggleActions: 'play none none reverse'
                },
                x: 50,
                opacity: 0,
                duration: 0.8,
                ease: 'power2.out'
            });
            
            gsap.from('.discussion-image', {
                scrollTrigger: {
                    trigger: '.students-section-disscution',
                    start: 'top 75%',
                    toggleActions: 'play none none reverse'
                },
                x: -50,
                opacity: 0,
                duration: 0.8,
                ease: 'power2.out'
            });
        },
        // Для мобильных (≤ 650px)
        '(max-width: 650px)': function() {
            gsap.from('.students-section-disscution > *', {
                scrollTrigger: {
                    trigger: '.students-section-disscution',
                    start: 'top 80%',
                    toggleActions: 'play none none reverse'
                },
                y: 40,
                opacity: 0,
                duration: 0.6,
                stagger: 0.2,
                ease: 'power2.out'
            });
        }
    });
    
    // Секция прогресса
    ScrollTrigger.matchMedia({
        '(min-width: 651px)': function() {
            gsap.from('.students-text-content-progress', {
                scrollTrigger: {
                    trigger: '.students-section-progress',
                    start: 'top 75%',
                    toggleActions: 'play none none reverse'
                },
                x: -50,
                opacity: 0,
                duration: 0.8,
                ease: 'power2.out'
            });
            
            gsap.from('.progress-image', {
                scrollTrigger: {
                    trigger: '.students-section-progress',
                    start: 'top 75%',
                    toggleActions: 'play none none reverse'
                },
                x: 50,
                opacity: 0,
                duration: 0.8,
                ease: 'power2.out'
            });
        },
        '(max-width: 650px)': function() {
            gsap.from('.students-section-progress > *', {
                scrollTrigger: {
                    trigger: '.students-section-progress',
                    start: 'top 80%',
                    toggleActions: 'play none none reverse'
                },
                y: 40,
                opacity: 0,
                duration: 0.6,
                stagger: 0.2,
                ease: 'power2.out'
            });
        }
    });
    
    // Преподаватели - заголовок
    gsap.from('.teachers-header', {
        scrollTrigger: {
            trigger: '.teachers-section',
            start: 'top 80%',
            toggleActions: 'play none none reverse'
        },
        y: 40,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out'
    });
    
    // Сетки преподавателей - адаптивные анимации
    ScrollTrigger.matchMedia({
        // Для десктопа (> 774px)
        '(min-width: 775px)': function() {
            // Первая сетка
            gsap.from('.teachers-grid-1-text-content', {
                scrollTrigger: {
                    trigger: '.teachers-grid-1',
                    start: 'top 75%',
                    toggleActions: 'play none none reverse'
                },
                x: -50,
                opacity: 0,
                duration: 0.8,
                ease: 'power2.out'
            });
            
            gsap.from('.teachers-grid-demo', {
                scrollTrigger: {
                    trigger: '.teachers-grid-1',
                    start: 'top 75%',
                    toggleActions: 'play none none reverse'
                },
                x: 50,
                opacity: 0,
                duration: 0.8,
                ease: 'power2.out'
            });
            
            // Вторая сетка
            gsap.from('.teachers-grid-2-text-content', {
                scrollTrigger: {
                    trigger: '.teachers-grid-2',
                    start: 'top 75%',
                    toggleActions: 'play none none reverse'
                },
                x: 50,
                opacity: 0,
                duration: 0.8,
                ease: 'power2.out'
            });
            
            gsap.from('.teachers-grid-demo-2', {
                scrollTrigger: {
                    trigger: '.teachers-grid-2',
                    start: 'top 75%',
                    toggleActions: 'play none none reverse'
                },
                x: -50,
                opacity: 0,
                duration: 0.8,
                ease: 'power2.out'
            });
            
            // Третья сетка
            gsap.from('.teachers-grid-3-text-content', {
                scrollTrigger: {
                    trigger: '.teachers-grid-3',
                    start: 'top 75%',
                    toggleActions: 'play none none reverse'
                },
                x: -50,
                opacity: 0,
                duration: 0.8,
                ease: 'power2.out'
            });
            
            gsap.from('.teachers-grid-demo-3', {
                scrollTrigger: {
                    trigger: '.teachers-grid-3',
                    start: 'top 75%',
                    toggleActions: 'play none none reverse'
                },
                x: 50,
                opacity: 0,
                duration: 0.8,
                ease: 'power2.out'
            });
        },
        // Для мобильных (≤ 774px)
        '(max-width: 774px)': function() {
            gsap.from('.teachers-grid-1 > div, .teachers-grid-2 > div, .teachers-grid-3 > div', {
                scrollTrigger: {
                    trigger: '.teachers-section',
                    start: 'top 80%',
                    toggleActions: 'play none none reverse'
                },
                y: 50,
                opacity: 0,
                duration: 0.6,
                stagger: 0.2,
                ease: 'power2.out'
            });
        }
    });
    
    // Горизонтальные линии с эффектом расширения
    gsap.from('.horizontal-line, .horizontal-line-bottom', {
        scrollTrigger: {
            trigger: '.teachers-section',
            start: 'top 70%',
            toggleActions: 'play none none reverse'
        },
        scaleX: 0,
        opacity: 0,
        duration: 0.8,
        stagger: 0.2,
        transformOrigin: 'center',
        ease: 'power2.inOut'
    });
    
    // Футер
    gsap.from('footer', {
        scrollTrigger: {
            trigger: 'footer',
            start: 'top 90%',
            toggleActions: 'play none none reverse'
        },
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out'
    });
    
    // Параллакс эффект для главного фона (только на десктопе)
    if (window.innerWidth > 992) {
        gsap.to('.main-background', {
            scrollTrigger: {
                trigger: 'body',
                start: 'top top',
                end: 'bottom top',
                scrub: 0.5
            },
            y: 100,
            ease: 'none'
        });
        
        gsap.to('.main-glass', {
            scrollTrigger: {
                trigger: 'body',
                start: 'top top',
                end: 'bottom top',
                scrub: 0.5
            },
            y: 50,
            ease: 'none'
        });
    }
    
    // Анимация для .next-container (появляется на мобильных)
    if (window.innerWidth <= 992) {
        gsap.from('.next-container .right-image', {
            scale: 0.9,
            opacity: 0,
            duration: 1,
            ease: 'power2.out',
            delay: 0.5
        });
    }
    
    
    
    // Карточки студентов
    document.querySelectorAll('.image-frame').forEach(card => {
        card.addEventListener('mouseenter', () => {
            gsap.to(card, {
                y: -10,
                duration: 0.3,
                ease: 'power2.out'
            });
        });
        
        card.addEventListener('mouseleave', () => {
            gsap.to(card, {
                y: 0,
                duration: 0.3,
                ease: 'power2.out'
            });
        });
    });

});