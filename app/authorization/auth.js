document.addEventListener('DOMContentLoaded', () => {
    // ===============================
    // Получаем элементы форм
    // ===============================
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');
    
    // ===============================
    // Функция для определения формы по хэшу
    // ===============================
    function getFormFromHash() {
        const hash = window.location.hash.substring(1);
        return hash === 'register' ? 'register' : 'login';
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
                clearProps: 'all' // Очищаем все свойства после анимации
            }
        );
    }

    // ===============================
    // Функция для показа формы
    // ===============================
    function showForm(formToShow, formToHide) {
        // Скрываем другую форму
        formToHide.classList.add('hidden');
        
        // Показываем нужную форму
        formToShow.classList.remove('hidden');
        
        
        // Анимируем появление
        animateForm(formToShow);
        
        // Обновляем хэш
        window.location.hash = formToShow === registerForm ? 'register' : 'login';
    }

    // ===============================
    // Инициализация при загрузке
    // ===============================
    
    // Сначала скрываем обе формы
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    
    // Определяем какую форму показать
    const initialForm = getFormFromHash() === 'register' ? registerForm : loginForm;
    
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
    // Переключение на форму регистрации
    // ===============================
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', function(e) {
            e.preventDefault();
            showForm(registerForm, loginForm);
        });
    }
    
    // ===============================
    // Переключение на форму входа
    // ===============================
    if (showLoginLink) {
        showLoginLink.addEventListener('click', function(e) {
            e.preventDefault();
            showForm(loginForm, registerForm);
        });
    }
    
    // ===============================
    // Обработка изменения хэша (кнопки назад/вперед)
    // ===============================
    window.addEventListener('hashchange', function() {
        const formType = getFormFromHash();
        if (formType === 'register' && loginForm.classList.contains('hidden') === false) {
            showForm(registerForm, loginForm);
        } else if (formType === 'login' && registerForm.classList.contains('hidden') === false) {
            showForm(loginForm, registerForm);
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