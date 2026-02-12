// mainPage.js - Добавьте этот код в конец файла

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
        scrollTrigger: {
            trigger: '.main-container',
            start: 'top 90%', // Было 'top 80%' - теперь начинается раньше
            end: 'bottom 20%',
            toggleActions: 'play none none reverse'
        }
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
    
    // Hover анимации
    // Кнопка регистрации
    const regBtn = document.querySelector('.registration-button');
    if (regBtn) {
        regBtn.addEventListener('mouseenter', () => {
            gsap.to(regBtn, {
                scale: 1.05,
                duration: 0.3,
                ease: 'power2.out'
            });
        });
        
        regBtn.addEventListener('mouseleave', () => {
            gsap.to(regBtn, {
                scale: 1,
                duration: 0.3,
                ease: 'power2.out'
            });
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
