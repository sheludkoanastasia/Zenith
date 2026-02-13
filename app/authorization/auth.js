document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.classList.add('ready');

    // ===============================
    // 1. Хедер
    // ===============================
    gsap.from('header', {
        y: -30,
        opacity: 0,
        duration: 1.6,
        ease: 'power3.out'        // более плавное замедление
    });

    // ===============================
    // 2. Вся форма целиком
    // ===============================
    gsap.from('.auth-form', {
        y: 30,
        opacity: 0,
        duration: 1.8,
        ease: 'power4.out',       // еще более плавное замедление
        delay: 0.15
    });

    // ===================================================
    // 3. Правая часть — 2 режима
    // ===================================================

    if (window.innerWidth <= 1740) {

        // ДО 1740px — элементы отдельно
        gsap.timeline({ delay: 0.2 })
            .from('.gradient-image', {
                scale: 1.05,
                opacity: 0,
                duration: 1.8,
                ease: 'sine.out'      // очень мягкая, естественная анимация
            })
            .from('.glass-overlay', {
                opacity: 0,
                duration: 1.0,
                ease: 'sine.out',     // очень мягкая, естественная анимация
            }, '-=0.6');              // увеличен нахлест для плавности

    } else {

        // ПОСЛЕ 1740px — вся правая часть
        gsap.from('.auth-visual', {
            x: 80,
            opacity: 0,
            duration: 2.0,
            ease: 'power4.out',      // очень плавное замедление
            delay: 0.25
        });

    }

});