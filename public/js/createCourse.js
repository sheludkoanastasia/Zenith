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
    
    let currentUser = null;
    let currentCourseId = null;
    let currentCoverImage = null;
    
    // Хранилище данных курса
    let courseData = {
        themes: [],
        join_code: null
    };
    
    // ===============================
    // СОХРАНЕНИЕ И ВОССТАНОВЛЕНИЕ ДАННЫХ (ЧЕРНОВИК)
    // ===============================
    const STORAGE_KEY = 'course_draft';
    
    function saveDraft() {
        if (currentCourseId) return;
        
        const title = document.getElementById('courseTitle')?.value.trim() || '';
        collectDataFromDOM();
        
        const draftData = {
            title: title,
            cover_image: currentCoverImage,
            themes: courseData.themes
        };
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draftData));
    }
    
    function clearDraft() {
        localStorage.removeItem(STORAGE_KEY);
    }
    
    let autoSaveTimeout;
    function scheduleAutoSave() {
        if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => saveDraft(), 1000);
    }
    
    // ===============================
    // ЗАГРУЗКА ИЗОБРАЖЕНИЯ КУРСА
    // ===============================
    const imageUpload = document.getElementById('courseImageUpload');
    const imageInput = document.getElementById('courseImageInput');
    const placeholderImg = imageUpload?.querySelector('.upload-placeholder');

    const blocksLink = document.getElementById('courseBlocksLink');
    const studentsLink = document.getElementById('courseStudentsLink');
    const connectionLink = document.getElementById('courseConnectionLink');
    const sectionsContent = document.getElementById('sectionsContent');
    
    function displayCourseImage(imageUrl) {
        if (!imageUpload) return;
        
        const oldPreview = imageUpload.querySelector('.image-preview');
        if (oldPreview) oldPreview.remove();
        
        const oldOverlay = imageUpload.querySelector('.image-overlay');
        if (oldOverlay) oldOverlay.remove();
        
        const preview = document.createElement('img');
        preview.src = imageUrl;
        preview.className = 'image-preview';
        preview.alt = 'Course preview';
        preview.style.objectFit = 'cover';
        preview.style.width = '100%';
        preview.style.height = '100%';
        preview.style.position = 'absolute';
        preview.style.top = '0';
        preview.style.left = '0';
        preview.style.zIndex = '1';
        
        const overlay = document.createElement('div');
        overlay.className = 'image-overlay';
        overlay.innerHTML = `<img src="/images/teacherMainPanel/edit.svg" alt="Edit" class="edit-icon">`;
        
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backdropFilter = 'blur(3px)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.3s ease';
        overlay.style.cursor = 'pointer';
        overlay.style.borderRadius = 'inherit';
        overlay.style.zIndex = '2';
        overlay.style.pointerEvents = 'none';
        
        const editIcon = overlay.querySelector('.edit-icon');
        if (editIcon) {
            editIcon.style.width = '40px';
            editIcon.style.height = '40px';
            editIcon.style.opacity = '0.9';
            editIcon.style.transition = 'transform 0.2s ease';
            editIcon.style.position = 'relative';
            editIcon.style.zIndex = '3';
            editIcon.style.pointerEvents = 'auto';
        }
        
        imageUpload.appendChild(preview);
        imageUpload.appendChild(overlay);
        imageUpload.style.position = 'relative';
        
        imageUpload.addEventListener('mouseenter', () => {
            overlay.style.opacity = '1';
            overlay.style.pointerEvents = 'auto';
        });
        
        imageUpload.addEventListener('mouseleave', () => {
            overlay.style.opacity = '0';
            overlay.style.pointerEvents = 'none';
        });
        
        overlay.addEventListener('click', (e) => {
            e.stopPropagation();
            imageInput.click();
        });
        
        if (placeholderImg) placeholderImg.style.display = 'none';
        
        currentCoverImage = imageUrl;
        scheduleAutoSave();
    }
    
    function loadDraft() {
        if (currentCourseId) return;
        
        const savedDraft = localStorage.getItem(STORAGE_KEY);
        if (!savedDraft) return;
        
        try {
            const draftData = JSON.parse(savedDraft);
            
            const titleInput = document.getElementById('courseTitle');
            if (titleInput && draftData.title) titleInput.value = draftData.title;
            
            if (draftData.cover_image) {
                currentCoverImage = draftData.cover_image;
                displayCourseImage(draftData.cover_image);
            }
            
            if (draftData.themes && draftData.themes.length > 0) {
                courseData.themes = draftData.themes;
            }
        } catch (error) {
            console.error('Ошибка загрузки черновика:', error);
            localStorage.removeItem(STORAGE_KEY);
        }
    }
    
    // ===============================
    // ЗАГРУЗКА РАЗДЕЛОВ ДЛЯ ВСЕХ БЛОКОВ
    // ===============================
    async function loadAllBlocksSections(themes) {
        if (!themes) return;
        
        for (const theme of themes) {
            if (theme.blocks && theme.blocks.length > 0) {
                for (const block of theme.blocks) {
                    if (block.id) {
                        try {
                            const response = await fetch(`/api/blocks/${block.id}/sections`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (response.ok) {
                                const data = await response.json();
                                if (data.success && data.sections) {
                                    block.sections = data.sections;
                                }
                            }
                        } catch (error) {
                            console.error(`Ошибка загрузки разделов для блока ${block.id}:`, error);
                        }
                    }
                }
            }
        }
    }
    
    // ===============================
    // ЗАГРУЗКА КУРСА ДЛЯ РЕДАКТИРОВАНИЯ
    // ===============================
    async function loadCourseForEditing(courseId) {
        try {
            const response = await fetch(`/api/courses/${courseId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const data = await response.json();
            
            if (data.success) {
                const course = data.course;
                
                const titleInput = document.getElementById('courseTitle');
                if (titleInput) titleInput.value = course.title;
                
                // Сохраняем join_code
                courseData.join_code = course.join_code;
                
                if (course.cover_image) {
                    currentCoverImage = course.cover_image;
                    displayCourseImage(course.cover_image);
                }
                
                if (course.themes && course.themes.length > 0) {
                    courseData.themes = JSON.parse(JSON.stringify(course.themes));
                    await loadAllBlocksSections(courseData.themes);
                }
            }
        } catch (error) {
            showNotification('Не удалось загрузить курс для редактирования', 'warning');
        }
    }
    
    try {
        const response = await fetch('/api/auth/check', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (!data.success) {
            localStorage.removeItem('token');
            window.location.href = '/auth';
            return;
        }
        
        if (data.user.role !== 'teacher') {
            window.location.href = '/user';
            return;
        }
        
        currentUser = data.user;
        displayTeacherInfo(data.user);
        
        const urlParams = new URLSearchParams(window.location.search);
        const courseId = urlParams.get('id');
        
        if (courseId) {
            currentCourseId = courseId;
            await loadCourseForEditing(courseId);
        } else {
            loadDraft();
        }
        
        setTimeout(() => {
            if (blocksLink && blocksLink.classList.contains('active')) {
                loadDataToDOM();
            }
        }, 200);
        
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        localStorage.removeItem('token');
        window.location.href = '/auth';
        return;
    }
    
    // ===============================
    // ФУНКЦИИ ДЛЯ РАБОТЫ С ХРАНИЛИЩЕМ ДАННЫХ
    // ===============================
    
    function collectDataFromDOM() {
        const themesContainer = document.getElementById('themesContainer');
        if (!themesContainer) return;
        
        const themes = [];
        const themeWrappers = document.querySelectorAll('#themesContainer .theme-wrapper');
        
        if (themeWrappers.length === 0) return;
        
        themeWrappers.forEach((themeWrapper, themeIndex) => {
            const themeInput = themeWrapper.querySelector('.course-theme-input');
            const themeTitle = themeInput?.value.trim() || `Тема ${themeIndex + 1}`;
            const themeId = themeWrapper.dataset.themeId || null;
            
            const blocks = [];
            const blockElements = themeWrapper.querySelectorAll('.blocks-container .form-block');
            
            blockElements.forEach((blockEl, blockIndex) => {
                const titleEl = blockEl.querySelector('.block-title');
                const descEl = blockEl.querySelector('.block-description');
                
                const blockTitle = titleEl?.innerText.trim() || '';
                const blockDescription = descEl?.innerText.trim() || '';
                const blockId = blockEl.dataset.blockId || null;
                
                blocks.push({
                    id: blockId,
                    title: blockTitle,
                    description: blockDescription,
                    order_index: blockIndex
                });
            });
            
            themes.push({
                id: themeId,
                title: themeTitle,
                order_index: themeIndex,
                blocks: blocks
            });
        });
        
        courseData.themes = JSON.parse(JSON.stringify(themes));
        console.log('Собраны данные из DOM:', courseData.themes.map(t => ({ title: t.title, order: t.order_index })));
    }
    
    function loadDataToDOM() {
        const themesContainer = document.getElementById('themesContainer');
        if (!themesContainer) return;
        
        themesContainer.innerHTML = '';
        
        if (!courseData.themes || courseData.themes.length === 0) {
            addNewTheme();
            return;
        }
        
        // Сортируем темы по order_index
        const sortedThemes = [...courseData.themes].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
        
        sortedThemes.forEach((theme) => {
            const themeWrapper = createTheme(theme.title, theme.id);
            const blocksContainer = themeWrapper.querySelector('.blocks-container');
            
            const plusBlock = blocksContainer.querySelector('.plus-block');
            if (plusBlock) plusBlock.remove();
            
            // Сортируем блоки по order_index
            const sortedBlocks = (theme.blocks || []).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
            
            if (sortedBlocks.length > 0) {
                sortedBlocks.forEach((block) => {
                    const formBlock = createFormBlock(block.title, block.description, block.id);
                    blocksContainer.appendChild(formBlock);
                });
            }
            
            blocksContainer.appendChild(createPlusBlock());
            themesContainer.appendChild(themeWrapper);
        });
        
        // Обновляем order_index после загрузки
        updateThemeOrderIndices();
    }
    
    function updateThemeOrderIndices() {
        const themeWrappers = document.querySelectorAll('#themesContainer .theme-wrapper');
        themeWrappers.forEach((wrapper, index) => {
            wrapper.dataset.orderIndex = index;
        });
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
    if (imageUpload && imageInput) {
        imageUpload.addEventListener('click', () => imageInput.click());
        
        imageInput.addEventListener('change', async function(e) {
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
                    displayCourseImage(event.target.result);
                };
                reader.readAsDataURL(file);
                
                await uploadImageToServer(file);
            }
        });
    }
    
    async function uploadImageToServer(file) {
        const formData = new FormData();
        formData.append('image', file);
        
        try {
            const response = await fetch('/api/courses/upload-image', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                currentCoverImage = data.imageUrl;
                showNotification('Изображение загружено', 'success');
            } else {
                showNotification('Ошибка при загрузке изображения', 'error');
            }
        } catch (error) {
            showNotification('Не удалось загрузить изображение', 'error');
        }
    }
    
    // ===============================
    // НАВИГАЦИЯ ПО РАЗДЕЛАМ
    // ===============================
    
    function updateActiveLink(activeLink) {
        [blocksLink, studentsLink, connectionLink].forEach(link => {
            link?.classList.toggle('active', link === activeLink);
        });
    }
    
    function switchSection(section) {
        if (blocksLink && blocksLink.classList.contains('active')) {
            collectDataFromDOM();
            scheduleAutoSave();
        }
        renderSection(section);
    }
    
    function renderSection(section) {
        if (!sectionsContent) return;
        
        if (section === 'blocks') {
            sectionsContent.innerHTML = `
                <div class="blocks-section" style="opacity: 0;">
                    <div class="themes-container" id="themesContainer"></div>
                    <button class="add-theme-btn" id="addThemeBtn">
                        <img src="/images/teacherMainPanel/plus.svg" alt="Plus" class="btn-plus-icon">
                        Добавить еще тему
                    </button>
                </div>
            `;
            
            const blocksSection = sectionsContent.querySelector('.blocks-section');
            loadDataToDOM();
            
            setTimeout(() => {
                gsap.to(blocksSection, { opacity: 1, duration: 0.3, ease: "power2.out" });
            }, 50);
            
            const addThemeBtn = document.getElementById('addThemeBtn');
            if (addThemeBtn) {
                addThemeBtn.addEventListener('click', () => addNewTheme());
            }
            
        } else if (section === 'students') {
            sectionsContent.innerHTML = `
                <div class="tasks-section" style="opacity: 0;">
                    <div class="themes-container-readonly" id="themesContainerReadonly"></div>
                </div>
            `;
            
            const tasksSection = sectionsContent.querySelector('.tasks-section');
            loadReadonlyStructure();
            
            setTimeout(() => {
                gsap.to(tasksSection, { opacity: 1, duration: 0.3, ease: "power2.out" });
            }, 50);
            
            } else if (section === 'connection') {
                sectionsContent.innerHTML = `
                    <div class="connection-section">
                        <p class="connection-description">По этой ссылке студенты смогут подключиться к курсу</p>
                        <div class="connection-link-container">
                            <input type="text" class="form-input connection-input" id="courseLinkInput"
                                value="Загрузка..." readonly>
                            <div class="connection-buttons">
                                <button class="connection-btn" id="copyLinkBtn" title="Копировать ссылку">
                                    <img src="/images/teacherMainPanel/copy.svg" alt="Copy">
                                </button>
                            </div>
                        </div>
                    </div>
                `;

                // Принудительно загружаем курс при переходе на вкладку
                const loadLink = async () => {
                    if (!currentCourseId) {
                        const linkInput = document.getElementById('courseLinkInput');
                        if (linkInput) linkInput.value = 'Сначала сохраните курс';
                        return;
                    }
                    
                    try {
                        const response = await fetch(`/api/courses/${currentCourseId}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        const data = await response.json();
                        
                        if (data.success && data.course.join_code) {
                            courseData.join_code = data.course.join_code;
                            const linkInput = document.getElementById('courseLinkInput');
                            if (linkInput) {
                                linkInput.value = `${window.location.origin}/join/${courseData.join_code}`;
                            }
                        }
                    } catch (error) {
                        console.error('Ошибка:', error);
                        const linkInput = document.getElementById('courseLinkInput');
                        if (linkInput) linkInput.value = 'Ошибка загрузки ссылки';
                    }
                };
                
                loadLink();
                
                const copyBtn = document.getElementById('copyLinkBtn');
                if (copyBtn) {
                    copyBtn.addEventListener('click', async () => {
                        const linkInput = document.getElementById('courseLinkInput');
                        if (linkInput.value && !linkInput.value.includes('Загрузка') && !linkInput.value.includes('Сначала')) {
                            await navigator.clipboard.writeText(linkInput.value);
                            showNotification('Ссылка скопирована', 'success');
                        } else {
                            showNotification('Сначала сохраните курс', 'warning');
                        }
                    });
                }
            }
    }
    
    function loadReadonlyStructure() {
        const container = document.getElementById('themesContainerReadonly');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!courseData.themes || courseData.themes.length === 0) {
            container.innerHTML = '<p class="empty-state">Нет тем. Сначала добавьте темы в разделе "Содержание курса"</p>';
            return;
        }
        
        // Сортируем темы по order_index
        const sortedThemes = [...courseData.themes].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
        
        sortedThemes.forEach((theme) => {
            const themeWrapper = createReadonlyTheme(theme.id, theme.title, theme.blocks || []);
            container.appendChild(themeWrapper);
        });
    }
    
    function createReadonlyTheme(themeId, themeTitle, blocks) {
        const themeWrapper = document.createElement('div');
        themeWrapper.className = 'theme-wrapper readonly-theme';
        
        themeWrapper.innerHTML = `
            <div class="theme-header">
                <div class="theme-title-container">
                    <button class="toggle-theme-btn" title="Свернуть/развернуть тему">
                        <img src="/images/teacherMainPanel/chevronDown.svg" alt="Toggle" class="chevron-icon">
                    </button>
                    <span class="course-theme-readonly">${escapeHtml(themeTitle)}</span>
                </div>
                <button class="goto-theme-btn" title="Перейти к теме">Перейти к теме</button>
            </div>
            <div class="blocks-container readonly-blocks-container"></div>
        `;
        
        const toggleBtn = themeWrapper.querySelector('.toggle-theme-btn');
        const chevronIcon = themeWrapper.querySelector('.chevron-icon');
        const blocksContainer = themeWrapper.querySelector('.blocks-container');
        const gotoBtn = themeWrapper.querySelector('.goto-theme-btn');
        
        let isThemeOpen = true;
        gsap.set(chevronIcon, { rotation: 180 });
        
        toggleBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (isThemeOpen) {
                gsap.to(blocksContainer, {
                    height: 0, opacity: 0, duration: 0.3, ease: "power2.inOut",
                    onComplete: () => blocksContainer.style.display = 'none'
                });
                gsap.to(chevronIcon, { rotation: 0, duration: 0.2, ease: "power2.inOut" });
            } else {
                blocksContainer.style.display = 'flex';
                blocksContainer.style.height = 'auto';
                const autoHeight = blocksContainer.offsetHeight;
                blocksContainer.style.height = '0';
                gsap.to(blocksContainer, {
                    height: autoHeight, opacity: 1, duration: 0.3, ease: "power2.inOut",
                    onComplete: () => blocksContainer.style.height = 'auto'
                });
                gsap.to(chevronIcon, { rotation: 180, duration: 0.2, ease: "power2.inOut" });
            }
            isThemeOpen = !isThemeOpen;
        });
        
        gotoBtn.addEventListener('click', () => navigateToThemeConstructor(themeId, currentCourseId));
        
        if (blocks && blocks.length > 0) {
            // Сортируем блоки по order_index
            const sortedBlocks = [...blocks].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
            sortedBlocks.forEach(block => {
                const blockElement = createReadonlyBlock(block.id, block.title, block.description, themeId);
                blocksContainer.appendChild(blockElement);
            });
        } else {
            blocksContainer.innerHTML = '<p class="empty-state-blocks">Нет блоков</p>';
        }
        
        return themeWrapper;
    }
    
    function createReadonlyBlock(blockId, title, description, themeId) {
        const block = document.createElement('div');
        block.className = 'course-block readonly-block';
        block.innerHTML = `
            <img src="/images/teacherMainPanel/addCourseCard.png" alt="Block background" class="block-bg">
            <div class="block-content">
                <div class="block-title-readonly">${escapeHtml(title || 'Без названия')}</div>
                <div class="block-description-readonly">${escapeHtml(description || 'Нет описания')}</div>
            </div>
            <div class="block-edit-overlay">
                <img src="/images/teacherMainPanel/edit.svg" alt="Edit" class="edit-icon-block">
            </div>
        `;
        block.addEventListener('click', () => navigateToBlockConstructor(blockId, currentCourseId, themeId));
        return block;
    }
    
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    
    // ===============================
    // ФУНКЦИИ ДЛЯ РАБОТЫ С ТЕМАМИ И БЛОКАМИ
    // ===============================
    
    function createTheme(themeTitle = '', themeId = null) {
        const themeWrapper = document.createElement('div');
        themeWrapper.className = 'theme-wrapper';
        if (themeId) themeWrapper.dataset.themeId = themeId;
        
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
            <div class="blocks-container"></div>
        `;
        
        const deleteBtn = themeWrapper.querySelector('.delete-theme-btn');
        const toggleBtn = themeWrapper.querySelector('.toggle-theme-btn');
        const chevronIcon = themeWrapper.querySelector('.chevron-icon');
        const blocksContainer = themeWrapper.querySelector('.blocks-container');
        const themeInput = themeWrapper.querySelector('.course-theme-input');
        
        let isThemeOpen = true;
        gsap.set(chevronIcon, { rotation: 180 });
        
        toggleBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (isThemeOpen) {
                gsap.to(blocksContainer, {
                    height: 0, opacity: 0, duration: 0.3, ease: "power2.inOut",
                    onComplete: () => blocksContainer.style.display = 'none'
                });
                gsap.to(chevronIcon, { rotation: 0, duration: 0.2, ease: "power2.inOut" });
            } else {
                blocksContainer.style.display = 'flex';
                blocksContainer.style.height = 'auto';
                const autoHeight = blocksContainer.offsetHeight;
                blocksContainer.style.height = '0';
                gsap.to(blocksContainer, {
                    height: autoHeight, opacity: 1, duration: 0.3, ease: "power2.inOut",
                    onComplete: () => blocksContainer.style.height = 'auto'
                });
                gsap.to(chevronIcon, { rotation: 180, duration: 0.2, ease: "power2.inOut" });
            }
            isThemeOpen = !isThemeOpen;
        });
        
        themeInput.addEventListener('input', () => {
            collectDataFromDOM();
            scheduleAutoSave();
        });
        
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const themesContainer = document.getElementById('themesContainer');
            const themes = Array.from(themesContainer.children);
            if (themes.length === 1) {
                showNotification('Нельзя удалить единственную тему. Добавьте новую или измените текущую.', 'warning');
                return;
            }
            showConfirmDialog('Удаление темы', 'Вы действительно хотите удалить эту тему?', function() {
                themeWrapper.remove();
                updateThemeOrderIndices();
                collectDataFromDOM();
                scheduleAutoSave();
                showNotification('Тема успешно удалена', 'success');
            });
        });
        
        blocksContainer.appendChild(createPlusBlock());
        return themeWrapper;
    }
    
    function addNewTheme(themeTitle = '') {
        const themesContainer = document.getElementById('themesContainer');
        if (!themesContainer) return;
        
        const newTheme = createTheme(themeTitle);
        themesContainer.appendChild(newTheme);
        updateThemeOrderIndices();
        collectDataFromDOM();
        scheduleAutoSave();
    }
    
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
            
            const blocks = Array.from(blocksContainer.children);
            const currentIndex = blocks.indexOf(this);
            
            const formBlock = createFormBlock();
            blocksContainer.replaceChild(formBlock, this);
            
            const newPlusBlock = createPlusBlock();
            if (blocks[currentIndex + 1]) {
                blocksContainer.insertBefore(newPlusBlock, blocks[currentIndex + 1]);
            } else {
                blocksContainer.appendChild(newPlusBlock);
            }
            
            collectDataFromDOM();
            scheduleAutoSave();
            
            setTimeout(() => formBlock.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
        });
        
        return block;
    }
    
    function createFormBlock(title = '', description = '', blockId = null) {
        const block = document.createElement('div');
        block.className = 'course-block form-block';
        
        if (blockId) {
            block.dataset.blockId = blockId;
        }
        
        block.innerHTML = `
            <img src="/images/teacherMainPanel/addCourseCard.png" alt="Block background" class="block-bg">
            <div class="block-content">
                <div class="block-title" data-placeholder="Название блока">${escapeHtml(title)}</div>
                <div class="block-description" data-placeholder="Описание блока">${escapeHtml(description)}</div>
            </div>
            <div class="delete-block" title="Удалить блок">×</div>
        `;
        
        const titleEl = block.querySelector('.block-title');
        const descriptionEl = block.querySelector('.block-description');
        const deleteBtn = block.querySelector('.delete-block');
        
        titleEl.contentEditable = true;
        descriptionEl.contentEditable = true;
        titleEl.style.pointerEvents = 'auto';
        descriptionEl.style.pointerEvents = 'auto';
        
        function setPlaceholderClass(element) {
            if (element.innerText.trim() === '') {
                element.classList.add('empty');
            } else {
                element.classList.remove('empty');
            }
        }
        
        setPlaceholderClass(titleEl);
        setPlaceholderClass(descriptionEl);
        
        const saveChanges = () => {
            collectDataFromDOM();
            scheduleAutoSave();
        };
        
        [titleEl, descriptionEl].forEach(el => {
            el.addEventListener('click', (e) => e.stopPropagation());
            el.addEventListener('input', () => {
                saveChanges();
                setPlaceholderClass(el);
            });
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (el === titleEl) descriptionEl.focus();
                }
            });
            el.addEventListener('paste', (e) => {
                e.preventDefault();
                const text = e.clipboardData.getData('text/plain');
                document.execCommand('insertText', false, text);
                saveChanges();
                setPlaceholderClass(el);
            });
            el.addEventListener('focus', function() {
                if (this.innerText === '') this.classList.add('editing');
            });
            el.addEventListener('blur', function() {
                this.classList.remove('editing');
                setPlaceholderClass(this);
                saveChanges();
            });
        });
        
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const blocksContainer = block.closest('.blocks-container');
            if (!blocksContainer) return;
            
            const blocks = Array.from(blocksContainer.children);
            if (blocks.length === 1) {
                showNotification('Нельзя удалить единственный блок. Добавьте новый или оставьте этот.', 'warning');
                return;
            }
            
            block.remove();
            
            const remainingBlocks = Array.from(blocksContainer.children);
            const hasPlusBlock = remainingBlocks.some(b => b.classList.contains('plus-block'));
            if (!hasPlusBlock) blocksContainer.appendChild(createPlusBlock());
            
            collectDataFromDOM();
            scheduleAutoSave();
        });
        
        return block;
    }
    
    // ===============================
    // СОХРАНЕНИЕ КУРСА
    // ===============================
    const saveBtn = document.getElementById('saveCourseBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => await saveCourse());
    }
    
    async function saveCourse() {
        const title = document.getElementById('courseTitle')?.value.trim();
        
        if (!title) {
            showNotification('Введите название курса', 'warning');
            return;
        }
        
        collectDataFromDOM();
        
        console.log('=== ПРОВЕРКА ПЕРЕД ОТПРАВКОЙ ===');
        for (const theme of courseData.themes) {
            console.log(`Тема: ${theme.title}, ID: ${theme.id}, order: ${theme.order_index}`);
            for (const block of theme.blocks) {
                console.log(`  Блок: "${block.title}", ID: ${block.id}, order: ${block.order_index}`);
            }
        }
        
        await loadAllBlocksSections(courseData.themes);
        
        const url = currentCourseId ? `/api/courses/${currentCourseId}` : '/api/courses';
        const method = currentCourseId ? 'PUT' : 'POST';
        
        console.log('=== URL И МЕТОД ===');
        console.log('currentCourseId:', currentCourseId);
        console.log('url:', url);
        console.log('method:', method);
        
        const requestBody = {
            title: title,
            cover_image: currentCoverImage,
            themes: courseData.themes
        };
        
        console.log('Отправляем на сервер:', JSON.stringify(requestBody, null, 2));
        
        setLoading(saveBtn, true);
        
        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            const data = await response.json();
            setLoading(saveBtn, false);
            
            console.log('Ответ сервера:', data);
            console.log('course объект:', data.course);
            console.log('join_code в ответе:', data.course?.join_code);
            console.log('Все поля course:', Object.keys(data.course || {}));
            
            if (data.success) {
                showNotification('Курс успешно сохранен', 'success');
                
                if (!currentCourseId && data.course) {
                    currentCourseId = data.course.id;
                    courseData.join_code = data.course.join_code;  // Сохраняем join_code
                    if (data.course.themes) {
                        courseData.themes = data.course.themes;
                        await loadAllBlocksSections(courseData.themes);
                    }
                    clearDraft();
                } else if (currentCourseId && data.course && data.course.themes) {
                    courseData.themes = data.course.themes;
                    if (data.course.join_code) {
                        courseData.join_code = data.course.join_code;  // Обновляем join_code
                    }
                    await loadAllBlocksSections(courseData.themes);
                }
                
                updateDOMWithIds(courseData.themes);
                
                // Если мы сейчас на вкладке connection - обновляем отображение ссылки
                if (connectionLink && connectionLink.classList.contains('active')) {
                    renderSection('connection');
                }
            } else {
                showNotification(data.message || 'Ошибка при сохранении курса', 'error');
            }
        } catch (error) {
            setLoading(saveBtn, false);
            console.error('Ошибка сохранения:', error);
            showNotification('Не удалось сохранить курс', 'error');
        }
    }
    
    function updateDOMWithIds(themes) {
        const themeWrappers = document.querySelectorAll('#themesContainer .theme-wrapper');
        
        // Сортируем темы из ответа сервера по order_index
        const sortedThemes = [...themes].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
        
        sortedThemes.forEach((theme, themeIndex) => {
            if (themeWrappers[themeIndex]) {
                themeWrappers[themeIndex].dataset.themeId = theme.id;
                themeWrappers[themeIndex].dataset.orderIndex = themeIndex;
                
                const blocks = themeWrappers[themeIndex].querySelectorAll('.form-block');
                // Сортируем блоки по order_index
                const sortedBlocks = [...theme.blocks].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
                
                sortedBlocks.forEach((block, blockIndex) => {
                    if (blocks[blockIndex] && block.id) {
                        blocks[blockIndex].dataset.blockId = block.id;
                        console.log(`Обновлен ID блока в DOM: ${block.id} для "${block.title}"`);
                    }
                });
            }
        });
    }
    
    // ===============================
    // ОБРАБОТЧИКИ НАВИГАЦИИ
    // ===============================
    if (blocksLink) {
        blocksLink.addEventListener('click', function(e) {
            e.preventDefault();
            updateActiveLink(this);
            switchSection('blocks');
        });
    }
    
    if (studentsLink) {
        studentsLink.addEventListener('click', function(e) {
            e.preventDefault();
            updateActiveLink(this);
            switchSection('students');
        });
    }
    
    if (connectionLink) {
        connectionLink.addEventListener('click', function(e) {
            e.preventDefault();
            updateActiveLink(this);
            switchSection('connection');
        });
    }
    
    if (blocksLink) {
        blocksLink.classList.add('active');
        setTimeout(() => renderSection('blocks'), 100);
    }
    
    // ===============================
    // ОТСЛЕЖИВАНИЕ ИЗМЕНЕНИЙ
    // ===============================
    const titleInputElem = document.getElementById('courseTitle');
    if (titleInputElem) {
        titleInputElem.addEventListener('input', () => scheduleAutoSave());
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
        
        let title = '';
        switch (type) {
            case 'success': title = 'Успешно'; break;
            case 'error': title = 'Ошибка'; break;
            case 'warning': title = 'Внимание'; break;
            default: title = 'Информация';
        }
        
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-title">${title}</div>
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
    
    function setLoading(button, isLoading) {
        if (isLoading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
        }
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
            .creation-toast.error { border-left: 6px solid #FF3B3B; }
            .creation-toast.warning { border-left: 6px solid #FFB800; }
            .creation-toast.info { border-left: 6px solid #7651BE; }
            .toast-content { flex: 1; }
            .toast-title { font-weight: 600; font-size: 16px; color: #1D1D1D; margin-bottom: 4px; }
            .toast-message { font-size: 14px; color: #4C4C4C; line-height: 1.5; }
            .toast-close {
                width: 24px; height: 24px; border-radius: 50%; background: rgba(0, 0, 0, 0.05);
                display: flex; align-items: center; justify-content: center; cursor: pointer;
                font-size: 18px; color: #666; transition: all 0.2s ease; flex-shrink: 0;
            }
            .toast-close:hover { background: rgba(0, 0, 0, 0.1); transform: scale(1.1); }
            @keyframes slideInRight {
                from { opacity: 0; transform: translateX(100px); }
                to { opacity: 1; transform: translateX(0); }
            }
            @keyframes slideOutRight {
                from { opacity: 1; transform: translateX(0); }
                to { opacity: 0; transform: translateX(100px); }
            }
            .creation-toast.hiding { animation: slideOutRight 0.3s ease forwards; }
            .save-changes-btn.loading {
                position: relative;
                color: transparent !important;
                pointer-events: none;
                background-color: #4CAF50 !important;
                opacity: 0.8;
            }
            .save-changes-btn.loading::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 24px;
                height: 24px;
                margin: -12px 0 0 -12px;
                border: 3px solid rgba(255, 255, 255, 0.5);
                border-top: 3px solid #FFFFFF;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // ===============================
    // ДИАЛОГ ПОДТВЕРЖДЕНИЯ
    // ===============================
    function showConfirmDialog(title, message, onConfirm) {
        addConfirmStyles();
        
        const oldDialog = document.querySelector('.confirm-dialog-overlay');
        if (oldDialog) oldDialog.remove();
        
        const overlay = document.createElement('div');
        overlay.className = 'confirm-dialog-overlay';
        
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
        
        gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" });
        gsap.fromTo(dialog, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "backOut" });
        
        const cancelBtn = dialog.querySelector('.confirm-dialog-btn-cancel');
        const confirmBtn = dialog.querySelector('.confirm-dialog-btn-confirm');
        
        cancelBtn.addEventListener('click', () => closeConfirmDialog(overlay));
        confirmBtn.addEventListener('click', () => {
            if (onConfirm) onConfirm();
            closeConfirmDialog(overlay);
        });
        
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeConfirmDialog(overlay); });
        
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
        gsap.to(dialog, { scale: 0.9, opacity: 0, duration: 0.3, ease: "power2.in" });
        gsap.to(overlay, { opacity: 0, duration: 0.3, ease: "power2.in", onComplete: () => overlay.remove() });
    }
    
    function addConfirmStyles() {
        if (document.getElementById('confirm-dialog-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'confirm-dialog-styles';
        style.textContent = `
            .confirm-dialog-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px);
                display: flex; align-items: center; justify-content: center;
                z-index: 10000; opacity: 0;
            }
            .confirm-dialog {
                background: white; border-radius: 24px; padding: 32px;
                max-width: 400px; width: 90%; box-shadow: 0 30px 60px rgba(0, 0, 0, 0.3);
                transform-origin: center;
            }
            .confirm-dialog-content { text-align: center; }
            .confirm-dialog-title {
                font-size: 28px; font-weight: 500; color: #1D1D1D;
                margin-bottom: 16px; font-family: 'Ysabeau', sans-serif;
            }
            .confirm-dialog-message {
                font-size: 18px; color: #4C4C4C; margin-bottom: 32px;
                line-height: 1.5; font-family: 'Ysabeau', sans-serif;
            }
            .confirm-dialog-buttons { display: flex; gap: 16px; justify-content: center; }
            .confirm-dialog-btn {
                padding: 12px 32px; border-radius: 40px; font-size: 16px;
                font-weight: 500; font-family: 'Ysabeau', sans-serif;
                cursor: pointer; transition: all 0.3s ease; border: none; min-width: 120px;
            }
            .confirm-dialog-btn-cancel { background-color: #f0f0f0; color: #4C4C4C; }
            .confirm-dialog-btn-cancel:hover { background-color: #e0e0e0; transform: translateY(-2px); }
            .confirm-dialog-btn-confirm { background-color: #7651BE; color: white; }
            .confirm-dialog-btn-confirm:hover { background-color: #6947ac; transform: translateY(-2px); }
            @media (max-width: 576px) {
                .confirm-dialog { padding: 24px; width: 95%; }
                .confirm-dialog-title { font-size: 24px; }
                .confirm-dialog-message { font-size: 16px; margin-bottom: 24px; }
                .confirm-dialog-buttons { flex-direction: column; gap: 12px; }
                .confirm-dialog-btn { width: 100%; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // ========== ФУНКЦИИ ПЕРЕХОДА К КОНСТРУКТОРУ ==========
    
    function navigateToThemeConstructor(themeId, courseId) {
        const theme = courseData.themes.find(t => t.id === themeId);
        if (theme && theme.blocks && theme.blocks.length > 0) {
            const firstBlock = theme.blocks[0];
            window.location.href = `/teacher/course-constructor?courseId=${courseId}&blockId=${firstBlock.id}&themeId=${themeId}`;
        } else {
            showNotification('В этой теме нет блоков. Сначала создайте блок.', 'warning');
        }
    }

    function navigateToBlockConstructor(blockId, courseId, themeId) {
        window.location.href = `/teacher/course-constructor?courseId=${courseId}&blockId=${blockId}&themeId=${themeId}`;
    }
    
    // ===============================
    // АНИМАЦИИ
    // ===============================
    gsap.set('body', { opacity: 0 });
    gsap.to('body', { opacity: 1, duration: 0.8, ease: 'power3.out' });
    gsap.from('header', { y: -30, opacity: 0, duration: 0.8, delay: 0.2, ease: 'power3.out' });
    gsap.from('.course-info-grid', { y: 30, opacity: 0, duration: 0.8, delay: 0.3, ease: 'power3.out' });
    gsap.from('.course-sections-nav', { y: 30, opacity: 0, duration: 0.8, delay: 0.4, ease: 'power3.out' });
    
    setTimeout(() => {
        document.documentElement.classList.add('ready');
    }, 220);
});