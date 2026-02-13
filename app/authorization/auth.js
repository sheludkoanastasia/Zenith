document.addEventListener('DOMContentLoaded', () => {
    // ===============================
    // Получаем элементы форм
    // ===============================
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const register2Form = document.getElementById('register2Form');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');
    const showBackLink = document.getElementById('showBack');
    const registerButton = document.querySelector('#registerForm .auth-button'); // Кнопка "Создать" в первой форме регистрации
    
    // ===============================
    // Функция для определения формы по хэшу
    // ===============================
    function getFormFromHash() {
        const hash = window.location.hash.substring(1);
        if (hash === 'register2') return 'register2';
        if (hash === 'register') return 'register';
        return 'login';
    }

    // ===============================
    // Функция для анимации появления формы
    // ===============================
    function animateForm(formElement) {
        // Простая анимация появления
        gsap.fromTo(formElement, 
            { 
                opacity: 0, 
                y: 30 
            },
            { 
                opacity: 1, 
                y: 0, 
                duration: 1.2, 
                ease: 'power2.out',
                clearProps: 'all'
            }
        );
    }

    // ===============================
    // Функция для показа формы
    // ===============================
    function showForm(formToShow, formToHide1, formToHide2 = null) {
        // Скрываем другие формы
        formToHide1.classList.add('hidden');
        if (formToHide2) formToHide2.classList.add('hidden');
        
        // Показываем нужную форму
        formToShow.classList.remove('hidden');
        
        // Анимируем появление
        animateForm(formToShow);
        
        // Обновляем хэш
        if (formToShow === register2Form) {
            window.location.hash = 'register2';
        } else if (formToShow === registerForm) {
            window.location.hash = 'register';
        } else {
            window.location.hash = 'login';
        }
    }

    // ===============================
    // Инициализация при загрузке
    // ===============================
    
    // Сначала скрываем все формы
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    register2Form.classList.add('hidden');
    
    // Определяем какую форму показать
    const formType = getFormFromHash();
    let initialForm;
    if (formType === 'register2') {
        initialForm = register2Form;
    } else if (formType === 'register') {
        initialForm = registerForm;
    } else {
        initialForm = loginForm;
    }
    
    // Показываем нужную форму
    initialForm.classList.remove('hidden');
    
    // Анимация всех элементов при загрузке
    gsap.from('header', {
        y: -30,
        opacity: 0,
        duration: 1.2,
        ease: 'power2.out'
    });
    
    // Анимация формы
    animateForm(initialForm);
    
    // Анимация правой части
    if (window.innerWidth <= 1740) {
        gsap.from('.gradient-image', {
            scale: 1.05,
            opacity: 0,
            duration: 1.2,
            ease: 'power2.out',
            delay: 0.1
        });
        gsap.from('.glass-overlay', {
            opacity: 0,
            duration: 0.8,
            ease: 'power2.out',
            delay: 0.3
        });
    } else {
        gsap.from('.auth-visual', {
            x: 50,
            opacity: 0,
            duration: 1.2,
            ease: 'power2.out',
            delay: 0.1
        });
    }
    
    // Показываем страницу
    document.documentElement.classList.add('ready');
    
    // ===============================
    // Переключение на форму регистрации (первый шаг)
    // ===============================
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', function(e) {
            e.preventDefault();
            showForm(registerForm, loginForm, register2Form);
        });
    }
    
    // ===============================
    // Переключение на форму входа
    // ===============================
    if (showLoginLink) {
        showLoginLink.addEventListener('click', function(e) {
            e.preventDefault();
            showForm(loginForm, registerForm, register2Form);
        });
    }
    
    // ===============================
    // Переключение на вторую форму регистрации (после нажатия "Создать")
    // ===============================
    if (registerButton) {
        registerButton.addEventListener('click', function(e) {
            e.preventDefault();
            // Можно добавить валидацию полей здесь
            showForm(register2Form, registerForm, loginForm);
        });
    }
    
    // ===============================
    // Возврат к первой форме регистрации (кнопка "Вернуться")
    // ===============================
    if (showBackLink) {
        showBackLink.addEventListener('click', function(e) {
            e.preventDefault();
            showForm(registerForm, register2Form, loginForm);
        });
    }
    
    // ===============================
    // Обработка изменения хэша (кнопки назад/вперед)
    // ===============================
    window.addEventListener('hashchange', function() {
        const formType = getFormFromHash();
        
        if (formType === 'register2' && register2Form.classList.contains('hidden')) {
            showForm(register2Form, registerForm, loginForm);
        } else if (formType === 'register' && registerForm.classList.contains('hidden')) {
            showForm(registerForm, loginForm, register2Form);
        } else if (formType === 'login' && loginForm.classList.contains('hidden')) {
            showForm(loginForm, registerForm, register2Form);
        }
    });
    
    // ===============================
    // Логика для выбора роли
    // ===============================
    const roleOptions = document.querySelectorAll('.role-option');
    const roleInput = document.getElementById('role-input');
    
    if (roleOptions.length > 0 && roleInput) {
        roleOptions.forEach(option => {
            option.addEventListener('click', function() {
                roleOptions.forEach(opt => opt.classList.remove('active'));
                this.classList.add('active');
                roleInput.value = this.dataset.role;
            });
        });
    }
});