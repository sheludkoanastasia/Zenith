document.addEventListener("DOMContentLoaded", async function () {
    // ===============================
    // ПРОВЕРКА АВТОРИЗАЦИИ
    // ===============================
    const token = localStorage.getItem('token');
    
    if (!token) {
        // Если нет токена - перенаправляем на страницу входа
        window.location.href = '/auth';
        return;
    }
    
    try {
        // Проверяем валидность токена на сервере
        const response = await fetch('/api/auth/check', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (!data.success) {
            // Токен невалидный - удаляем и перенаправляем
            localStorage.removeItem('token');
            window.location.href = '/auth';
            return;
        }
        
        // Токен валидный - показываем данные пользователя
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
        const userNameElement = document.querySelector('.user-name');
        const userRoleElement = document.querySelector('.user-role');
        
        if (userNameElement) {
            userNameElement.innerHTML = `
                ${user.lastName || ''} ${user.firstName || ''}<br>
                <span>${user.patronymic || ''}</span>
            `;
        }
        
        if (userRoleElement) {
            const roleText = user.role === 'teacher' ? 'Преподаватель' : 'Студент';
            userRoleElement.textContent = roleText;
        }
    }
    
    // ===============================
    // ОБРАБОТЧИК ВЫХОДА
    // ===============================
    const logoutLink = document.querySelector('.nav-right a[href="/"]');
    if (logoutLink) {
        logoutLink.addEventListener('click', function(e) {
            e.preventDefault(); // Предотвращаем переход по ссылке
            localStorage.removeItem('token'); // Удаляем токен
            window.location.href = '/'; // Перенаправляем на главную
        });
    }
    
    // ========== РАБОТА С DROPDOWN ==========
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
    
    // ========== РАБОТА С НАВИГАЦИЕЙ КУРСОВ ==========
    const navLinks = document.querySelectorAll(".courseNavigation a");
    
    function updateActiveLink(activeLink) {
        navLinks.forEach(link => {
            if (link === activeLink) {
                link.style.fontSize = "32px";
                link.style.fontWeight = "400";
            } else {
                link.style.fontSize = "22px";
                link.style.fontWeight = "400";
                link.style.color = "#1D1D1D";
            }
        });
    }
    
    function clearExtraContent() {
        const linkContainer = document.querySelector(".link-container");
        if (linkContainer) {
            linkContainer.remove();
        }
    }
    
    function createLinkInputWithButton() {
        const linkContainer = document.createElement("div");
        linkContainer.className = "link-container";
        
        const linkInput = document.createElement("input");
        linkInput.type = "text";
        linkInput.className = "form-input link-input";
        linkInput.placeholder = "Вставьте ссылку на курс";
        
        const linkButton = document.createElement("img");
        linkButton.className = "link-button-img";
        linkButton.src = "/images/userMainPanel/send.svg";
        linkButton.alt = "Подключиться";
        
        linkButton.addEventListener("click", function() {
            const link = linkInput.value;
            if (link) {
                console.log("Подключение по ссылке:", link);
                alert("Подключение к курсу: " + link);
            } else {
                alert("Введите ссылку на курс");
            }
        });
        
        linkContainer.appendChild(linkInput);
        linkContainer.appendChild(linkButton);
        
        return linkContainer;
    }
    
    function showContent(section) {
        const firstMessage = document.querySelector(".firstMessage");
        
        clearExtraContent();
        
        if (section === "Мои курсы") {
            if (firstMessage) {
                firstMessage.textContent = "Еще ничего не добавлено. Стоит пройти свой первый курс !";
                firstMessage.style.display = "block";
            }
        } else if (section === "Все курсы") {
            if (firstMessage) {
                firstMessage.textContent = "Здесь будут отображаться все доступные курсы";
                firstMessage.style.display = "block";
            }
        } else if (section === "Подключиться по ссылке") {
            if (firstMessage) {
                firstMessage.textContent = "Введите ссылку для подключения к курсу";
                firstMessage.style.display = "block";
            }
            
            const linkContainer = createLinkInputWithButton();
            
            if (firstMessage) {
                firstMessage.insertAdjacentElement('afterend', linkContainer);
            }
        }
    }
    
    navLinks.forEach(link => {
        link.addEventListener("click", function(e) {
            e.preventDefault();
            updateActiveLink(this);
            showContent(this.textContent);
        });
    });
    
    const myCoursesLink = Array.from(navLinks).find(link => link.textContent === "Мои курсы");
    if (myCoursesLink) {
        updateActiveLink(myCoursesLink);
        showContent("Мои курсы");
    }
});