// public/js/createCourse.js
document.addEventListener("DOMContentLoaded", async function () {
    // ===============================
    // ПРОВЕРКА АВТОРИЗАЦИИ
    // ===============================
    const token = localStorage.getItem('token');
    
    if (!token) {
        window.location.href = '/auth';
        return;
    }
    
    try {
        const response = await fetch('/api/auth/check', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (!data.success) {
            localStorage.removeItem('token');
            window.location.href = '/auth';
            return;
        }
        
        // Проверяем, что пользователь - преподаватель
        if (data.user.role !== 'teacher') {
            window.location.href = '/user';
            return;
        }
        
        // Отображаем информацию о преподавателе
        displayTeacherInfo(data.user);
        
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        localStorage.removeItem('token');
        window.location.href = '/auth';
        return;
    }
    
    // ===============================
    // ОТОБРАЖЕНИЕ ИНФОРМАЦИИ О ПРЕПОДАВАТЕЛЕ
    // ===============================
    function displayTeacherInfo(user) {
        const teacherNameSpan = document.getElementById('teacherName');
        if (teacherNameSpan) {
            const fullName = [user.lastName, user.firstName, user.patronymic]
                .filter(part => part && part.trim() !== '')
                .join(' ');
            teacherNameSpan.textContent = fullName || 'Преподаватель';
        }
    }
    
    // ===============================
    // ОБРАБОТЧИК ВОЗВРАТА К ПРОФИЛЮ
    // ===============================
    const backLink = document.querySelector('.back-to-profile');
    if (backLink) {
        backLink.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = '/teacher';
        });
    }
    
    // ===============================
    // ЗАГРУЗКА ИЗОБРАЖЕНИЯ КУРСА
    // ===============================
    const imageUpload = document.getElementById('courseImageUpload');
    const imageInput = document.getElementById('courseImageInput');
    const placeholderImg = imageUpload?.querySelector('.upload-placeholder');
    
    if (imageUpload && imageInput) {
        imageUpload.addEventListener('click', () => imageInput.click());
        
        imageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                if (!file.type.startsWith('image/')) {
                    showNotification('Пожалуйста, выберите изображение', 'warning');
                    return;
                }
                
                if (file.size > 5 * 1024 * 1024) {
                    showNotification('Размер файла не должен превышать 5MB', 'warning');
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = function(event) {
                    const oldPreview = imageUpload.querySelector('.image-preview');
                    if (oldPreview) oldPreview.remove();
                    
                    const preview = document.createElement('img');
                    preview.src = event.target.result;
                    preview.className = 'image-preview';
                    preview.alt = 'Course preview';
                    
                    if (placeholderImg) {
                        placeholderImg.style.display = 'none';
                    }
                    
                    imageUpload.appendChild(preview);
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // ===============================
    // НАВИГАЦИЯ ПО РАЗДЕЛАМ
    // ===============================
    const blocksLink = document.getElementById('courseBlocksLink');
    const studentsLink = document.getElementById('courseStudentsLink');
    const connectionLink = document.getElementById('courseConnectionLink');
    const sectionsContent = document.getElementById('sectionsContent');
    
    function updateActiveLink(activeLink) {
        [blocksLink, studentsLink, connectionLink].forEach(link => {
            link?.classList.toggle('active', link === activeLink);
        });
    }
    
    function loadSectionContent(section) {
        if (!sectionsContent) return;
        
        if (section === 'blocks') {
            // Создаем контейнер для всех тем
            sectionsContent.innerHTML = `
                <div class="blocks-section">
                    <!-- Контейнер для всех тем курса -->
                    <div class="themes-container" id="themesContainer">
                        <!-- Первая тема будет добавлена сюда через JS -->
                    </div>
                    
                    <!-- КНОПКА ДОБАВЛЕНИЯ НОВОЙ ТЕМЫ -->
                    <button class="add-theme-btn" id="addThemeBtn">
                        <img src="/images/teacherMainPanel/plus.svg" alt="Plus" class="btn-plus-icon">
                        Добавить еще тему
                    </button>
                </div>
            `;
            
            // Добавляем первую тему по умолчанию
            addNewTheme();
            
            // Обработчик для кнопки "Добавить еще тему"
            const addThemeBtn = document.getElementById('addThemeBtn');
            if (addThemeBtn) {
                addThemeBtn.addEventListener('click', function() {
                    addNewTheme();
                });
            }
            
        } else if (section === 'students') {
            sectionsContent.innerHTML = `
                <div class="students-section">
                    <h2 class="students-title">Студенты курса</h2>
                    <p class="students-description">Список студентов, подключенных к курсу</p>
                    <div class="students-list">
                        <p class="empty-state">Пока нет студентов</p>
                    </div>
                </div>
            `;
        } else if (section === 'connection') {
            sectionsContent.innerHTML = `
                <div class="connection-section">
                    <p class="connection-description">По этой ссылке студенты смогут подключиться к курсу</p>
                    
                    <div class="connection-link-container">
                        <input type="text" 
                               class="form-input connection-input" 
                               id="courseLinkInput"
                               value="https://zenith.edu/course/123456"
                               readonly>
                        
                        <div class="connection-buttons">
                            <button class="connection-btn" id="refreshLinkBtn" title="Обновить ссылку">
                                <img src="/images/teacherMainPanel/refresh.svg" alt="Refresh">
                            </button>
                            <button class="connection-btn" id="copyLinkBtn" title="Копировать ссылку">
                                <img src="/images/teacherMainPanel/copy.svg" alt="Copy">
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // Добавляем обработчики для кнопок
            const refreshBtn = document.getElementById('refreshLinkBtn');
            const copyBtn = document.getElementById('copyLinkBtn');
            const linkInput = document.getElementById('courseLinkInput');

            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    showNotification('Ссылка обновлена', 'success');
                    
                    linkInput.classList.add('focus-effect');
                    setTimeout(() => {
                        linkInput.classList.remove('focus-effect');
                    }, 2000);
                });
            }

            if (copyBtn) {
                copyBtn.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(linkInput.value);
                        showNotification('Ссылка скопирована', 'success');
                        
                        linkInput.classList.add('focus-effect');
                        setTimeout(() => {
                            linkInput.classList.remove('focus-effect');
                        }, 2000);
                    } catch (err) {
                        showNotification('Ошибка при копировании', 'warning');
                    }
                });
            }
        }
    }
    
    // ===============================
    // ФУНКЦИИ ДЛЯ РАБОТЫ С ТЕМАМИ И БЛОКАМИ
    // ===============================
    
    /**
     * Создает DOM элемент для темы
     * @param {string} themeTitle - Заголовок темы (по умолчанию пустой)
     * @returns {HTMLElement} - обертка темы (theme-wrapper)
     */
    function createTheme(themeTitle = '') {
        const themeWrapper = document.createElement('div');
        themeWrapper.className = 'theme-wrapper';
        
        themeWrapper.innerHTML = `
            <div class="theme-header">
                <div class="theme-title-container">
                    <button class="toggle-theme-btn" title="Свернуть/развернуть тему">
                        <img src="/images/teacherMainPanel/chevronDown.svg" alt="Toggle" class="chevron-icon">
                    </button>
                    <input type="text" class="course-theme-input" placeholder="Тема курса" value="${themeTitle}">
                </div>
                <button class="delete-theme-btn" title="Удалить тему">
                    <img src="/images/teacherMainPanel/delete.svg" alt="Удалить" class="delete-icon">
                </button>
            </div>
            <div class="blocks-container">
                <!-- Сюда будут добавляться блоки -->
            </div>
        `;
        
        const deleteBtn = themeWrapper.querySelector('.delete-theme-btn');
        const toggleBtn = themeWrapper.querySelector('.toggle-theme-btn');
        const chevronIcon = themeWrapper.querySelector('.chevron-icon');
        const blocksContainer = themeWrapper.querySelector('.blocks-container');
        
        // Тема изначально открыта
        let isThemeOpen = true;
        
        // Устанавливаем начальное положение иконки (вниз)
        gsap.set(chevronIcon, { rotation: 180 });
        
        // Обработчик для сворачивания/разворачивания темы
        toggleBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            
            if (isThemeOpen) {
                // Сворачиваем тему
                gsap.to(blocksContainer, {
                    height: 0,
                    opacity: 0,
                    duration: 0.3,
                    ease: "power2.inOut",
                    onComplete: () => {
                        blocksContainer.style.display = 'none';
                    }
                });
                
                // Поворачиваем иконку на 180 градусов (вверх)
                gsap.to(chevronIcon, {
                    rotation: 0,
                    duration: 0.2,
                    ease: "power2.inOut"
                });
                
            } else {
                // Разворачиваем тему
                blocksContainer.style.display = 'flex';
                
                // Получаем полную высоту контейнера
                blocksContainer.style.height = 'auto';
                const autoHeight = blocksContainer.offsetHeight;
                blocksContainer.style.height = '0';
                
                gsap.to(blocksContainer, {
                    height: autoHeight,
                    opacity: 1,
                    duration: 0.3,
                    ease: "power2.inOut",
                    onComplete: () => {
                        blocksContainer.style.height = 'auto';
                    }
                });
                
                // Поворачиваем иконку обратно на 0 градусов (вниз)
                gsap.to(chevronIcon, {
                    rotation: 180,
                    duration: 0.2,
                    ease: "power2.inOut"
                });
            }
            
            isThemeOpen = !isThemeOpen;
        });
        
        // Обработчик для кнопки удаления темы
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            
            const themesContainer = document.getElementById('themesContainer');
            const themes = Array.from(themesContainer.children);
            
            if (themes.length === 1) {
                showNotification('Нельзя удалить единственную тему. Добавьте новую или измените текущую.', 'warning');
                return;
            }
            
            // Показываем диалог подтверждения
            showConfirmDialog(
                'Удаление темы',
                'Вы действительно хотите удалить эту тему?',
                function() {
                    themeWrapper.remove();
                    showNotification('Тема успешно удалена', 'success');
                }
            );
        });
        
        // Добавляем первый блок
        blocksContainer.appendChild(createPlusBlock());
        
        return themeWrapper;
    }
    
    /**
     * Добавляет новую тему в контейнер themesContainer
     * @param {string} themeTitle - Заголовок темы
     */
    function addNewTheme(themeTitle = '') {
        const themesContainer = document.getElementById('themesContainer');
        if (!themesContainer) return;
        
        const newTheme = createTheme(themeTitle);
        themesContainer.appendChild(newTheme);
    }
    
    // Создание блока с плюсом
    function createPlusBlock() {
        const block = document.createElement('div');
        block.className = 'course-block plus-block';
        block.innerHTML = `
            <img src="/images/teacherMainPanel/addCourseCard.png" alt="Add block" class="block-bg">
            <img src="/images/teacherMainPanel/plus.svg" alt="Add" class="block-plus">
        `;
        
        block.addEventListener('click', function onClick() {
            const blocksContainer = this.closest('.blocks-container');
            if (!blocksContainer) return;
            
            // Получаем индекс текущего блока
            const blocks = Array.from(blocksContainer.children);
            const currentIndex = blocks.indexOf(this);
            
            // Заменяем текущий плюс-блок на блок с формой
            const formBlock = createFormBlock();
            blocksContainer.replaceChild(formBlock, this);
            
            // Создаем новый плюс-блок и вставляем после блока с формой
            const newPlusBlock = createPlusBlock();
            if (blocks[currentIndex + 1]) {
                blocksContainer.insertBefore(newPlusBlock, blocks[currentIndex + 1]);
            } else {
                blocksContainer.appendChild(newPlusBlock);
            }
            
            // Прокручиваем к новому блоку с формой
            setTimeout(() => {
                formBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        });
        
        return block;
    }
    
    // Создание блока с формой (название и описание)
    function createFormBlock() {
        const block = document.createElement('div');
        block.className = 'course-block form-block';
        block.innerHTML = `
            <img src="/images/teacherMainPanel/addCourseCard.png" alt="Block background" class="block-bg">
            <div class="block-content">
                <div class="block-title" contenteditable="true" data-placeholder="Название блока"></div>
                <div class="block-description" contenteditable="true" data-placeholder="Описание блока"></div>
            </div>
            <div class="delete-block" title="Удалить блок">×</div>
        `;
        
        // Предотвращаем всплытие клика при редактировании
        const title = block.querySelector('.block-title');
        const description = block.querySelector('.block-description');
        const deleteBtn = block.querySelector('.delete-block');
        
        [title, description].forEach(el => {
            el.addEventListener('click', (e) => e.stopPropagation());
        });
        
        // Обработчик удаления блока
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            
            const blocksContainer = block.closest('.blocks-container');
            if (!blocksContainer) return;
            
            const blocks = Array.from(blocksContainer.children);
            const currentIndex = blocks.indexOf(block);
            
            // Проверяем, есть ли другие блоки
            if (blocks.length === 1) {
                showNotification('Нельзя удалить единственный блок. Добавьте новый или оставьте этот.', 'warning');
                return;
            }
            
            // Удаляем блок
            block.remove();
            
            // Проверяем, остался ли в контейнере плюс-блок
            const remainingBlocks = Array.from(blocksContainer.children);
            const hasPlusBlock = remainingBlocks.some(b => b.classList.contains('plus-block'));
            
            // Если нет плюс-блока, добавляем его в конец
            if (!hasPlusBlock) {
                const newPlusBlock = createPlusBlock();
                blocksContainer.appendChild(newPlusBlock);
            }
            
        });
        
        // Добавляем обработчики для плейсхолдеров
        setupContentEditablePlaceholders(block);
        
        return block;
    }

    // Функция для обработки плейсхолдеров в contenteditable
    function setupContentEditablePlaceholders(block) {
        const title = block.querySelector('.block-title');
        const description = block.querySelector('.block-description');
        
        if (title) {
            title.addEventListener('focus', function() {
                if (this.innerText === '' || this.innerText === 'Название блока') {
                    this.innerText = '';
                }
            });
            
            title.addEventListener('blur', function() {
                if (this.innerText.trim() === '') {
                    this.innerText = '';
                }
            });
        }
        
        if (description) {
            description.addEventListener('focus', function() {
                if (this.innerText === '' || this.innerText === 'Описание блока') {
                    this.innerText = '';
                }
            });
            
            description.addEventListener('blur', function() {
                if (this.innerText.trim() === '') {
                    this.innerText = '';
                }
            });
        }
    }
    
    // ===============================
    // ОБРАБОТЧИКИ НАВИГАЦИИ
    // ===============================
    if (blocksLink) {
        blocksLink.addEventListener('click', function(e) {
            e.preventDefault();
            updateActiveLink(this);
            loadSectionContent('blocks');
        });
    }
    
    if (studentsLink) {
        studentsLink.addEventListener('click', function(e) {
            e.preventDefault();
            updateActiveLink(this);
            loadSectionContent('students');
        });
    }
    
    if (connectionLink) {
        connectionLink.addEventListener('click', function(e) {
            e.preventDefault();
            updateActiveLink(this);
            loadSectionContent('connection');
        });
    }
    
    // Загружаем раздел "Блоки курса" по умолчанию
    if (blocksLink) {
        blocksLink.classList.add('active');
        loadSectionContent('blocks');
    }
    
    // ===============================
    // СОХРАНЕНИЕ ИЗМЕНЕНИЙ КУРСА
    // ===============================
    const saveBtn = document.getElementById('saveCourseBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            showNotification('Изменения сохранены', 'success');
        });
    }
    
    // ===============================
    // УВЕДОМЛЕНИЯ
    // ===============================
    function showNotification(message, type = 'success') {
        addNotificationStyles();
        
        const oldToasts = document.querySelectorAll('.creation-toast');
        oldToasts.forEach(toast => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        });
        
        const toast = document.createElement('div');
        toast.className = `creation-toast ${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-title">${type === 'success' ? 'Успешно' : 'Внимание'}</div>
                <div class="toast-message">${message}</div>
            </div>
            <div class="toast-close">✕</div>
        `;
        
        document.body.appendChild(toast);
        
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        });
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.add('hiding');
                setTimeout(() => toast.remove(), 300);
            }
        }, 3000);
    }
    
    function addNotificationStyles() {
        if (document.getElementById('creation-toast-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'creation-toast-styles';
        style.textContent = `
            .creation-toast {
                position: fixed;
                top: 100px;
                right: 30px;
                min-width: 320px;
                max-width: 400px;
                background: white;
                backdrop-filter: blur(10px);
                border-radius: 16px;
                padding: 16px 20px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
                display: flex;
                align-items: flex-start;
                gap: 12px;
                z-index: 9999;
                border: 1px solid rgba(255, 255, 255, 0.3);
                animation: slideInRight 0.4s ease;
            }
            .creation-toast.success { border-left: 6px solid #4CAF50; }
            .creation-toast.warning { border-left: 6px solid #FFB800; }
            .toast-content { flex: 1; }
            .toast-title {
                font-weight: 600;
                font-size: 16px;
                color: #1D1D1D;
                margin-bottom: 4px;
            }
            .toast-message {
                font-size: 14px;
                color: #4C4C4C;
                line-height: 1.5;
            }
            .toast-close {
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
            .toast-close:hover {
                background: rgba(0, 0, 0, 0.1);
                transform: scale(1.1);
            }
            @keyframes slideInRight {
                from { opacity: 0; transform: translateX(100px); }
                to { opacity: 1; transform: translateX(0); }
            }
            @keyframes slideOutRight {
                from { opacity: 1; transform: translateX(0); }
                to { opacity: 0; transform: translateX(100px); }
            }
            .creation-toast.hiding {
                animation: slideOutRight 0.3s ease forwards;
            }
        `;
        document.head.appendChild(style);
    }

    // ===============================
    // ДИАЛОГ ПОДТВЕРЖДЕНИЯ
    // ===============================
    function showConfirmDialog(title, message, onConfirm) {
        addConfirmStyles();
        
        // Удаляем предыдущий диалог, если есть
        const oldDialog = document.querySelector('.confirm-dialog-overlay');
        if (oldDialog) {
            oldDialog.remove();
        }
        
        // Создаем оверлей
        const overlay = document.createElement('div');
        overlay.className = 'confirm-dialog-overlay';
        
        // Создаем диалог
        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        
        dialog.innerHTML = `
            <div class="confirm-dialog-content">
                <div class="confirm-dialog-title">${title}</div>
                <div class="confirm-dialog-message">${message}</div>
                <div class="confirm-dialog-buttons">
                    <button class="confirm-dialog-btn confirm-dialog-btn-cancel">Отмена</button>
                    <button class="confirm-dialog-btn confirm-dialog-btn-confirm">Удалить</button>
                </div>
            </div>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // Анимация появления
        gsap.fromTo(overlay, 
            { opacity: 0 },
            { opacity: 1, duration: 0.3, ease: "power2.out" }
        );
        
        gsap.fromTo(dialog,
            { scale: 0.9, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.4, ease: "backOut" }
        );
        
        // Обработчики кнопок
        const cancelBtn = dialog.querySelector('.confirm-dialog-btn-cancel');
        const confirmBtn = dialog.querySelector('.confirm-dialog-btn-confirm');
        
        cancelBtn.addEventListener('click', () => {
            closeConfirmDialog(overlay);
        });
        
        confirmBtn.addEventListener('click', () => {
            if (onConfirm) {
                onConfirm();
            }
            closeConfirmDialog(overlay);
        });
        
        // Закрытие по клику на оверлей
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeConfirmDialog(overlay);
            }
        });
        
        // Закрытие по Escape
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeConfirmDialog(overlay);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    function closeConfirmDialog(overlay) {
        const dialog = overlay.querySelector('.confirm-dialog');
        
        gsap.to(dialog, {
            scale: 0.9,
            opacity: 0,
            duration: 0.3,
            ease: "power2.in"
        });
        
        gsap.to(overlay, {
            opacity: 0,
            duration: 0.3,
            ease: "power2.in",
            onComplete: () => {
                overlay.remove();
            }
        });
    }

    function addConfirmStyles() {
        if (document.getElementById('confirm-dialog-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'confirm-dialog-styles';
        style.textContent = `
            .confirm-dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                opacity: 0;
            }
            
            .confirm-dialog {
                background: white;
                border-radius: 24px;
                padding: 32px;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 30px 60px rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.3);
                transform-origin: center;
            }
            
            .confirm-dialog-content {
                text-align: center;
            }
            
            .confirm-dialog-title {
                font-size: 28px;
                font-weight: 500;
                color: #1D1D1D;
                margin-bottom: 16px;
                font-family: 'Ysabeau', sans-serif;
            }
            
            .confirm-dialog-message {
                font-size: 18px;
                color: #4C4C4C;
                margin-bottom: 32px;
                line-height: 1.5;
                font-family: 'Ysabeau', sans-serif;
            }
            
            .confirm-dialog-buttons {
                display: flex;
                gap: 16px;
                justify-content: center;
            }
            
            .confirm-dialog-btn {
                padding: 12px 32px;
                border-radius: 40px;
                font-size: 16px;
                font-weight: 500;
                font-family: 'Ysabeau', sans-serif;
                cursor: pointer;
                transition: all 0.3s ease;
                border: none;
                min-width: 120px;
            }
            
            .confirm-dialog-btn-cancel {
                background-color: #f0f0f0;
                color: #4C4C4C;
            }
            
            .confirm-dialog-btn-cancel:hover {
                background-color: #e0e0e0;
                transform: translateY(-2px);
            }
            
            .confirm-dialog-btn-confirm {
                background-color: #7651BE;
                color: white;
            }
            
            .confirm-dialog-btn-confirm:hover {
                background-color: #6947ac;
                transform: translateY(-2px);
            }
            
            .confirm-dialog-btn:active {
                transform: translateY(0);
            }
            
            @media (max-width: 576px) {
                .confirm-dialog {
                    padding: 24px;
                    width: 95%;
                }
                
                .confirm-dialog-title {
                    font-size: 24px;
                }
                
                .confirm-dialog-message {
                    font-size: 16px;
                    margin-bottom: 24px;
                }
                
                .confirm-dialog-buttons {
                    flex-direction: column;
                    gap: 12px;
                }
                
                .confirm-dialog-btn {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // ===============================
    // АНИМАЦИИ
    // ===============================
    gsap.set('body', { opacity: 0 });
    gsap.to('body', { opacity: 1, duration: 0.8, ease: 'power3.out' });
    gsap.from('header', { y: -30, opacity: 0, duration: 0.8, delay: 0.2, ease: 'power3.out' });
    gsap.from('.course-info-grid', { y: 30, opacity: 0, duration: 0.8, delay: 0.3, ease: 'power3.out' });
    gsap.from('.course-sections-nav', { y: 30, opacity: 0, duration: 0.8, delay: 0.4, ease: 'power3.out' });

    // Анимируем все элементы, которые уже есть в DOM
    setTimeout(() => {
        gsap.from('.theme-header', { y: 30, opacity: 0, duration: 0.8, delay: 0.4, ease: 'power3.out' });
        gsap.from('.blocks-container', { y: 30, opacity: 0, duration: 0.8, delay: 0.4, ease: 'power3.out' });
        
        // Анимируем кнопку
        const addThemeBtn = document.getElementById('addThemeBtn');
        if (addThemeBtn) {
            gsap.fromTo(addThemeBtn, 
                { y: 30, opacity: 0 }, 
                { y: 0, opacity: 1, duration: 0.1, delay: 0.4, ease: 'power3.out' }
            );
        }
    }, 200);

    setTimeout(() => {
        document.documentElement.classList.add('ready');
    }, 220);
});