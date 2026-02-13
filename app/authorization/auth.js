document.addEventListener('DOMContentLoaded', () => {
    // Показываем страницу после загрузки
    document.documentElement.classList.add('ready');

    // ===============================
    // Функция для анимации формы
    // ===============================
    function animateForm(formElement) {
        if (!formElement) return;
        
        // Сброс стилей перед анимацией
        gsap.set(formElement, { clearProps: 'all' });
        
        // Анимация формы
        gsap.from(formElement, {
            y: 30,
            opacity: 0,
            duration: 1.8,
            ease: 'power4.out',
            delay: 0.15
        });
    }

    // ===============================
    // Функция для анимации правой части
    // ===============================
    function animateRightPart() {
        if (window.innerWidth <= 1740) {
            // ДО 1740px — элементы отдельно
            gsap.timeline({ delay: 0.2 })
                .from('.gradient-image', {
                    scale: 1.05,
                    opacity: 0,
                    duration: 1.8,
                    ease: 'sine.out'
                })
                .from('.glass-overlay', {
                    opacity: 0,
                    duration: 1.0,
                    ease: 'sine.out',
                }, '-=0.6');
        } else {
            // ПОСЛЕ 1740px — вся правая часть
            gsap.from('.auth-visual', {
                x: 80,
                opacity: 0,
                duration: 2.0,
                ease: 'power4.out',
                delay: 0.25
            });
        }
    }

    // ===============================
    // Функция для полной анимации страницы
    // ===============================
    function animatePage(activeForm) {
        // Анимация хедера (только при первой загрузке)
        if (!window.headerAnimated) {
            gsap.from('header', {
                y: -30,
                opacity: 0,
                duration: 1.6,
                ease: 'power3.out'
            });
            window.headerAnimated = true;
        }
        
        // Анимация активной формы
        animateForm(activeForm);
        
        // Анимация правой части (только если она еще не анимирована)
        if (!window.rightPartAnimated) {
            animateRightPart();
            window.rightPartAnimated = true;
        }
    }

    // ===============================
    // Получаем элементы форм
    // ===============================
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');
    
    // ===============================
    // Анимация при первой загрузке (форма входа)
    // ===============================
    window.headerAnimated = false;
    window.rightPartAnimated = false;
    animatePage(loginForm);
    
    // ===============================
    // Переключение на форму регистрации
    // ===============================
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Переключаем на регистрацию');
            
            if (loginForm && registerForm) {
                // Скрываем форму входа
                loginForm.classList.add('hidden');
                
                // Показываем форму регистрации
                registerForm.classList.remove('hidden');
                
                // Анимируем форму регистрации
                animateForm(registerForm);
            }
        });
    }
    
    // ===============================
    // Переключение на форму входа
    // ===============================
    if (showLoginLink) {
        showLoginLink.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Переключаем на вход');
            
            if (loginForm && registerForm) {
                // Скрываем форму регистрации
                registerForm.classList.add('hidden');
                
                // Показываем форму входа
                loginForm.classList.remove('hidden');
                
                // Анимируем форму входа
                animateForm(loginForm);
            }
        });
    }
    
    // ===============================
    // Логика для текстовых кнопок выбора роли
    // ===============================
    const roleOptions = document.querySelectorAll('.role-option');
    const roleInput = document.getElementById('role-input');
    
    if (roleOptions.length > 0 && roleInput) {
        roleOptions.forEach(option => {
            option.addEventListener('click', function() {
                // Убираем активный класс у всех опций
                roleOptions.forEach(opt => opt.classList.remove('active'));
                // Добавляем активный класс текущей опции
                this.classList.add('active');
                // Обновляем значение скрытого поля
                roleInput.value = this.dataset.role;
                console.log('Выбрана роль:', this.dataset.role);
            });
        });
    }

    // ===============================
    // Обработка ресайза окна для правой части
    // ===============================
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Сбрасываем анимацию правой части при ресайзе
            if (window.innerWidth <= 1740) {
                gsap.set('.gradient-image, .glass-overlay, .auth-visual', { clearProps: 'all' });
            } else {
                gsap.set('.auth-visual', { clearProps: 'all' });
            }
            
            // Заново анимируем правую часть
            animateRightPart();
        }, 250);
    });
});