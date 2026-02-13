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
    // Функция для переключения формы
    // ===============================
    function switchForm(formToShow, formToHide, hash) {
        if (formToHide && formToShow) {
            formToHide.classList.add('hidden');
            formToShow.classList.remove('hidden');
            animateForm(formToShow);
            
            // Обновляем хэш в URL без перезагрузки страницы
            if (hash) {
                window.location.hash = hash;
            }
        }
    }

    // ===============================
    // Функция для определения активной формы по хэшу
    // ===============================
    function getFormFromHash() {
        const hash = window.location.hash.substring(1); // убираем #
        
        if (hash === 'register') {
            return 'register';
        } else {
            return 'login'; // по умолчанию показываем форму входа
        }
    }

    // ===============================
    // Функция для применения формы по хэшу
    // ===============================
    function applyFormFromHash() {
        const formType = getFormFromHash();
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (formType === 'register') {
            registerForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
            animateForm(registerForm);
        } else {
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            animateForm(loginForm);
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
    // Анимация при первой загрузке
    // ===============================
    window.headerAnimated = false;
    window.rightPartAnimated = false;
    
    // Анимируем хедер
    gsap.from('header', {
        y: -30,
        opacity: 0,
        duration: 1.6,
        ease: 'power3.out'
    });
    window.headerAnimated = true;
    
    // Анимируем правую часть
    animateRightPart();
    window.rightPartAnimated = true;
    
    // Применяем форму на основе хэша
    applyFormFromHash();
    
    // ===============================
    // Переключение на форму регистрации
    // ===============================
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Переключаем на регистрацию');
            switchForm(registerForm, loginForm, 'register');
        });
    }
    
    // ===============================
    // Переключение на форму входа
    // ===============================
    if (showLoginLink) {
        showLoginLink.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Переключаем на вход');
            switchForm(loginForm, registerForm, 'login');
        });
    }
    
    // ===============================
    // Слушаем изменение хэша (если пользователь нажимает назад/вперед)
    // ===============================
    window.addEventListener('hashchange', function() {
        applyFormFromHash();
    });
    
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