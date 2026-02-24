document.addEventListener('DOMContentLoaded', () => {
    
    // ===============================
    // ПРОВЕРКА АВТОРИЗАЦИИ ПРИ ЗАГРУЗКЕ
    // ===============================
    checkAuthAndRedirect();
    
    // ===============================
    // ПРОВЕРКА ПРИ ВОЗВРАТЕ ИЗ ИСТОРИИ (кнопка "назад")
    // ===============================
    window.onpageshow = function(event) {
        if (event.persisted) {
            console.log('Страница загружена из кэша (нажатие "назад")');
            checkAuthAndRedirect();
        }
    };
    
    // ===============================
    // ФУНКЦИЯ ПРОВЕРКИ АВТОРИЗАЦИИ
    // ===============================
    async function checkAuthAndRedirect() {
        const token = localStorage.getItem('token');
        
        if (!token) {
            // Не авторизован - показываем формы
            initializeAuthPage();
            return;
        }
        
        // Проверяем токен на сервере
        try {
            const response = await fetch('/api/auth/check', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Токен валидный - перенаправляем на соответствующую панель
                if (data.user && data.user.role === 'teacher') {
                    window.location.replace('/teacher');
                } else {
                    window.location.replace('/user');
                }
            } else {
                // Токен недействителен
                localStorage.removeItem('token');
                initializeAuthPage();
            }
        } catch (error) {
            console.error('Ошибка проверки токена:', error);
            localStorage.removeItem('token');
            initializeAuthPage();
        }
    }
    
    // ===============================
    // ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ АВТОРИЗАЦИИ
    // ===============================
    function initializeAuthPage() {
        // Элементы форм
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const register2Form = document.getElementById('register2Form');
        
        // Кнопки и ссылки
        const showRegisterLink = document.getElementById('showRegister');
        const showLoginLink = document.getElementById('showLogin');
        const showBackLink = document.getElementById('showBack');
        
        // Кнопки отправки
        const loginButton = document.querySelector('#loginForm .auth-button');
        const registerButton = document.querySelector('#registerForm .auth-button');
        const register2Button = document.querySelector('#register2Form .auth-button');
        
        if (!loginForm || !registerForm || !register2Form) {
            console.error('Формы не найдены!');
            return;
        }

        // Добавляем стили
        addStyles();

        // Проверка email при потере фокуса
        const regEmailInput = document.getElementById('reg-email');
        if (regEmailInput) {
            regEmailInput.addEventListener('blur', async function() {
                const email = this.value.trim();
                
                if (email.includes('@') && email.includes('.')) {
                    try {
                        const response = await fetch('/api/auth/check-email', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ email })
                        });
                        
                        const data = await response.json();
                        
                        if (data.exists) {
                            highlightField('reg-email');
                            showNotification('Этот email уже зарегистрирован', 'warning');
                        }
                    } catch (error) {
                        console.error('Ошибка при проверке email:', error);
                    }
                }
            });
        }

        // Функция валидации пароля
        function validatePassword(password) {
            const errors = [];
            
            const allowedCharsRegex = /^[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/;
            if (!allowedCharsRegex.test(password)) {
                errors.push('только латинские буквы, цифры и спецсимволы');
                return errors;
            }
            
            if (password.length < 8) {
                errors.push('минимум 8 символов');
            }
            
            if (!/[A-Z]/.test(password)) {
                errors.push('заглавную латинскую букву');
            }
            
            if (!/[a-z]/.test(password)) {
                errors.push('строчную латинскую букву');
            }
            
            if (!/\d/.test(password)) {
                errors.push('цифру');
            }
            
            if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
                errors.push('специальный символ');
            }
            
            return errors;
        }

        // Функция валидации ФИО
        function validateNameFields(firstName, lastName, patronymic) {
            const errors = [];
            
            if (!firstName) {
                errors.push('Имя обязательно');
                highlightField('reg-name');
            } else if (firstName.length < 2 || firstName.length > 20) {
                errors.push('Имя должно быть от 2 до 20 символов');
                highlightField('reg-name');
            }
            
            if (!lastName) {
                errors.push('Фамилия обязательна');
                highlightField('reg-surname');
            } else if (lastName.length < 2 || lastName.length > 30) {
                errors.push('Фамилия должна быть от 2 до 30 символов');
                highlightField('reg-surname');
            }
            
            if (patronymic && (patronymic.length < 2 || patronymic.length > 30)) {
                errors.push('Отчество должно быть от 2 до 30 символов');
                highlightField('reg-surname2');
            }
            
            return errors;
        }

        // Обработчик регистрации (шаг 1)
        if (registerButton) {
            registerButton.addEventListener('click', async function(e) {
                e.preventDefault();
                

                const email = document.getElementById('reg-email').value.trim();
                const password = document.getElementById('reg-password').value;
                const role = document.getElementById('role-input').value;
                
                if (!email || !password) {
                    if (!email) highlightField('reg-email');
                    if (!password) highlightField('reg-password');
                    showNotification('Пожалуйста, заполните все поля', 'warning');
                    return;
                }
                
                const passwordErrors = validatePassword(password);
                if (passwordErrors.length > 0) {
                    highlightField('reg-password');
                    showNotification(`Пароль должен содержать: ${passwordErrors.join(', ')}`, 'warning');
                    return;
                }
                
                if (!email.includes('@') || !email.includes('.')) {
                    highlightField('reg-email');
                    showNotification('Пожалуйста, введите корректный email', 'warning');
                    return;
                }
                
                setLoading(registerButton, true);
                
                try {
                    const checkResponse = await fetch('/api/auth/check-email', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ email })
                    });
                    
                    const checkData = await checkResponse.json();
                    
                    if (checkData.exists) {
                        setLoading(registerButton, false);
                        highlightField('reg-email');
                        showNotification('Пользователь с таким email уже существует', 'error');
                        return;
                    }
                    
                    localStorage.setItem('tempEmail', email);
                    localStorage.setItem('tempPassword', password);
                    localStorage.setItem('tempRole', role);
                    
                    setLoading(registerButton, false);
                    showForm(register2Form, registerForm, loginForm);
                    
                } catch (error) {
                    setLoading(registerButton, false);
                    console.error('Ошибка при проверке email:', error);
                    showNotification('Не удалось проверить email. Попробуйте позже.', 'error');
                }
            });
        }

        // Обработчик регистрации (шаг 2)
        if (register2Button) {
            register2Button.addEventListener('click', async function(e) {
                e.preventDefault();
                
                const email = localStorage.getItem('tempEmail');
                const password = localStorage.getItem('tempPassword');
                const role = localStorage.getItem('tempRole');
                
                const firstName = document.getElementById('reg-name').value.trim();
                const lastName = document.getElementById('reg-surname').value.trim();
                const patronymic = document.getElementById('reg-surname2').value.trim();
                
                const nameErrors = validateNameFields(firstName, lastName, patronymic);
                if (nameErrors.length > 0) {
                    showNotification(nameErrors.join('. '), 'warning');
                    return;
                }
                
                setLoading(register2Button, true);
                
                try {
                    const response = await fetch('/api/auth/register', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            email,
                            password,
                            role,
                            firstName,
                            lastName,
                            patronymic
                        })
                    });
                    
                    const data = await response.json();
                    
                    const loadingStart = parseInt(register2Button.dataset.loadingStart);
                    const timeElapsed = Date.now() - loadingStart;
                    const minLoadTime = 1500;
                    
                    if (timeElapsed < minLoadTime) {
                        await new Promise(resolve => setTimeout(resolve, minLoadTime - timeElapsed));
                    }
                    
                    if (data.success) {
                        localStorage.setItem('token', data.token);
                        
                        localStorage.removeItem('tempEmail');
                        localStorage.removeItem('tempPassword');
                        localStorage.removeItem('tempRole');
                        
                        if (data.user && data.user.role === 'teacher') {
                            window.location.replace('/teacher');
                        } else {
                            window.location.replace('/user');
                        }
                    } else {
                        setLoading(register2Button, false);
                        const errorMessage = data.errors ? 
                            data.errors.map(e => e.msg).join(', ') : 
                            data.message || 'Ошибка при регистрации';
                        showNotification(errorMessage, 'error');
                    }
                } catch (error) {
                    setLoading(register2Button, false);
                    console.error('Ошибка:', error);
                    showNotification('Не удалось соединиться с сервером', 'error');
                }
            });
        }

        // Обработчик входа
        if (loginButton) {
            loginButton.addEventListener('click', async function(e) {
                e.preventDefault();
                
                const email = document.getElementById('login').value.trim();
                const password = document.getElementById('password').value;
                
                if (!email || !password) {
                    if (!email) highlightField('login');
                    if (!password) highlightField('password');
                    showNotification('Пожалуйста, введите email и пароль', 'warning');
                    return;
                }
                
                setLoading(loginButton, true);
                
                try {
                    const response = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ email, password })
                    });
                    
                    const data = await response.json();
                    
                    const loadingStart = parseInt(loginButton.dataset.loadingStart);
                    const timeElapsed = Date.now() - loadingStart;
                    const minLoadTime = 1500;
                    
                    if (timeElapsed < minLoadTime) {
                        await new Promise(resolve => setTimeout(resolve, minLoadTime - timeElapsed));
                    }
                    
                    if (data.success) {
                        localStorage.setItem('token', data.token);
                        
                        if (data.user && data.user.role === 'teacher') {
                            window.location.replace('/teacher');
                        } else {
                            window.location.replace('/user');
                        }
                    } else {
                        setLoading(loginButton, false);
                        showNotification(data.message || 'Неверный email или пароль', 'error');
                    }
                } catch (error) {
                    setLoading(loginButton, false);
                    console.error('Ошибка:', error);
                    showNotification('Не удалось соединиться с сервером', 'error');
                }
            });
        }

        // Обработчики переключения форм
        if (showBackLink) {
            showBackLink.addEventListener('click', function(e) {
                e.preventDefault();
                showForm(registerForm, register2Form, loginForm);
            });
        }

        if (showRegisterLink) {
            showRegisterLink.addEventListener('click', function(e) {
                e.preventDefault();
                showForm(registerForm, loginForm, register2Form);
            });
        }
        
        if (showLoginLink) {
            showLoginLink.addEventListener('click', function(e) {
                e.preventDefault();
                showForm(loginForm, registerForm, register2Form);
                localStorage.removeItem('tempEmail');
                localStorage.removeItem('tempPassword');
                localStorage.removeItem('tempRole');
            });
        }

        // Функции для анимации
        function getFormFromHash() {
            const hash = window.location.hash.substring(1);
            if (hash === 'register2') return 'register2';
            if (hash === 'register') return 'register';
            return 'login';
        }

        function animateForm(formElement) {
            if (!formElement) return;
            
            gsap.fromTo(formElement, 
                { opacity: 0, y: 30 },
                { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out' }
            );
        }

        function showForm(formToShow, formToHide1, formToHide2 = null) {
            formToHide1.classList.add('hidden');
            if (formToHide2) formToHide2.classList.add('hidden');
            
            formToShow.classList.remove('hidden');
            gsap.set(formToShow, { opacity: 0, y: 30 });
            
            setTimeout(() => {
                animateForm(formToShow);
            }, 50);
            
            if (formToShow === register2Form) {
                window.location.hash = 'register2';
            } else if (formToShow === registerForm) {
                window.location.hash = 'register';
            } else {
                window.location.hash = 'login';
            }
        }

        // Инициализация форм
        loginForm.classList.add('hidden');
        registerForm.classList.add('hidden');
        register2Form.classList.add('hidden');
        
        gsap.set([loginForm, registerForm, register2Form], { opacity: 0, y: 30 });
        
        const formType = getFormFromHash();
        let initialForm;
        if (formType === 'register2') {
            initialForm = register2Form;
        } else if (formType === 'register') {
            initialForm = registerForm;
        } else {
            initialForm = loginForm;
        }
        
        initialForm.classList.remove('hidden');
        
        gsap.from('header', {
            y: -30,
            opacity: 0,
            duration: 1.2,
            ease: 'power2.out'
        });
        
        animateForm(initialForm);
        
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
        
        setTimeout(() => {
            document.documentElement.classList.add('ready');
        }, 100);
    }
});

// ===============================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (вне initializeAuthPage)
// ===============================

function addStyles() {
    if (!document.getElementById('auth-styles')) {
        const style = document.createElement('style');
        style.id = 'auth-styles';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .auth-button.loading {
                position: relative;
                color: transparent !important;
                pointer-events: none;
                background-color: #7651BE !important;
                opacity: 0.9;
                transition: all 0.3s ease;
            }
            
            .auth-button.loading::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 28px;
                height: 28px;
                margin: -14px 0 0 -14px;
                border: 3px solid rgba(255, 255, 255, 0.5);
                border-top: 3px solid #FFFFFF;
                border-right: 3px solid #FFFFFF;
                border-radius: 50%;
                animation: spin 1.2s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite;
                box-shadow: 0 0 10px rgba(255,255,255,0.3);
            }
            
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
            
            .form-input.error {
                border-color: #FF3B3B;
                background-color: rgba(255, 59, 59, 0.02);
            }
            
            .form-input.error:focus {
                box-shadow: 0 0 0 3px rgba(255, 59, 59, 0.1);
            }
        `;
        document.head.appendChild(style);
    }
}

function setLoading(button, isLoading) {
    if (isLoading) {
        button.classList.add('loading');
        button.disabled = true;
        button.dataset.loadingStart = Date.now();
    } else {
        button.classList.remove('loading');
        button.disabled = false;
        delete button.dataset.loadingStart;
    }
}

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

function highlightField(fieldId) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.classList.add('error');
        field.addEventListener('input', function onInput() {
            field.classList.remove('error');
            field.removeEventListener('input', onInput);
        }, { once: true });
    }
}