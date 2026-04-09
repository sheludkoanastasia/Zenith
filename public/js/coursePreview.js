// public/js/coursePreview.js
document.addEventListener("DOMContentLoaded", async function () {
    const token = localStorage.getItem('token');
    
    if (!token) {
        window.location.href = '/auth';
        return;
    }
    
    let currentUser = null;
    let currentCourseId = null;
    let courseData = { themes: [] };
    
    // Хранилище прогресса студента
    let studentProgress = {
        themes: {},  // { themeId: { completedBlocks: 0, totalBlocks: 0, percent: 0 } }
        blocks: {}   // { blockId: { completedSections: 0, totalSections: 0, percent: 0 } }
    };
    
    // Проверка авторизации и получение роли
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
        
        currentUser = data.user;
        
        // Получаем ID курса из URL
        const urlParams = new URLSearchParams(window.location.search);
        currentCourseId = urlParams.get('id');
        
        if (!currentCourseId) {
            alert('Курс не найден');
            window.location.href = currentUser.role === 'teacher' ? '/teacher' : '/user';
            return;
        }
        
        await loadCourseData();
        
    } catch (error) {
        console.error('Ошибка:', error);
        window.location.href = '/auth';
        return;
    }
    
    async function loadCourseData() {
        try {
            const response = await fetch(`/api/courses/${currentCourseId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const data = await response.json();
            
            if (data.success) {
                const course = data.course;
                courseData = course;
                
                // Отображаем информацию о курсе
                const titleInput = document.getElementById('courseTitle');
                if (titleInput) titleInput.value = course.title;
                
                if (course.cover_image) {
                    displayCourseImage(course.cover_image);
                }
                
                // Отображаем имя преподавателя
                const teacherNameSpan = document.getElementById('teacherName');
                if (teacherNameSpan && course.teacher) {
                    const fullName = [course.teacher.last_name, course.teacher.first_name, course.teacher.patronymic]
                        .filter(part => part && part.trim() !== '')
                        .join(' ');
                    teacherNameSpan.textContent = fullName || 'Преподаватель';
                }
                
                // Если студент - скрываем количество студентов и успеваемость
                if (currentUser.role === 'student') {
                    const studentsCountDiv = document.getElementById('courseStudentsCount');
                    if (studentsCountDiv) studentsCountDiv.style.display = 'none';
                    
                    const performanceLink = document.getElementById('coursePerformanceLink');
                    if (performanceLink) performanceLink.style.display = 'none';
                    
                    // Показываем блок прогресса курса
                    const progressContainer = document.getElementById('courseProgressContainer');
                    if (progressContainer) {
                        progressContainer.style.display = 'block';
                    }
                    
                    // Загружаем прогресс студента
                    await loadStudentProgress();
                }
                
                // Загружаем разделы для всех блоков
                if (course.themes && course.themes.length > 0) {
                    await loadAllBlocksSections(course.themes);
                    renderBlocksSection();
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки курса:', error);
            showNotification('Не удалось загрузить курс', 'error');
        }
    }
    
    // Функция загрузки прогресса студента
        // Функция загрузки прогресса студента
    async function loadStudentProgress() {
        try {
            console.log('Загрузка прогресса для курса:', currentCourseId);
            
            // Временные демо-данные для тестирования
            if (courseData.themes) {
                for (let themeIndex = 0; themeIndex < courseData.themes.length; themeIndex++) {
                    const theme = courseData.themes[themeIndex];
                    const totalBlocks = theme.blocks?.length || 0;
                    
                    if (totalBlocks > 0) {
                        // Для демонстрации: первая тема - 100% прогресс
                        let completedBlocks = 0;
                        if (themeIndex === 0) {
                            completedBlocks = totalBlocks;
                        } else {
                            completedBlocks = Math.floor(Math.random() * (totalBlocks + 1));
                        }
                        const themePercent = Math.round((completedBlocks / totalBlocks) * 100);
                        studentProgress.themes[theme.id] = { completedBlocks, totalBlocks, percent: themePercent };
                        
                        // Прогресс для блоков (демо-проценты, без учета секций)
                        if (theme.blocks) {
                            for (let blockIndex = 0; blockIndex < theme.blocks.length; blockIndex++) {
                                const block = theme.blocks[blockIndex];
                                
                                let blockPercent = 0;
                                // Первый блок первой темы = 100%
                                if (themeIndex === 0 && blockIndex === 0) {
                                    blockPercent = 100;
                                } 
                                // Второй блок первой темы = 75%
                                else if (themeIndex === 0 && blockIndex === 1) {
                                    blockPercent = 75;
                                }
                                // Третий блок первой темы = 50%
                                else if (themeIndex === 0 && blockIndex === 2) {
                                    blockPercent = 50;
                                }
                                // Четвертый блок первой темы = 25%
                                else if (themeIndex === 0 && blockIndex === 3) {
                                    blockPercent = 25;
                                }
                                // Остальные случайные проценты
                                else {
                                    blockPercent = Math.floor(Math.random() * 101);
                                }
                                
                                studentProgress.blocks[block.id] = { 
                                    percent: blockPercent 
                                };
                                console.log(`Блок ${block.title}: ${blockPercent}%`);
                            }
                        }
                    } else {
                        studentProgress.themes[theme.id] = { completedBlocks: 0, totalBlocks: 0, percent: 0 };
                    }
                }
            }
            
            console.log('studentProgress после генерации:', studentProgress);
            
            // Обновляем общий прогресс курса
            updateCourseProgress();
            
            // Если блоки уже отрендерены, обновляем прогресс
            if (currentUser.role === 'student') {
                setTimeout(() => {
                    updateAllProgress();
                }, 100);
            }
            
        } catch (error) {
            console.error('Ошибка загрузки прогресса:', error);
        }
    }
    
    // Обновление общего прогресса курса
    function updateCourseProgress() {
        let totalPercent = 0;
        let themeCount = 0;
        
        for (const themeId in studentProgress.themes) {
            totalPercent += studentProgress.themes[themeId].percent;
            themeCount++;
        }
        
        const coursePercent = themeCount > 0 ? Math.round(totalPercent / themeCount) : 0;
        
        const fill = document.querySelector('.progress-bar-fill-overlay');
        const percentText = document.getElementById('progressPercent');
        
        if (fill) {
            fill.style.width = `${coursePercent}%`;
        }
        if (percentText) {
            percentText.textContent = `${coursePercent}%`;
        }
    }
    
    // Добавление прогресса для темы (только процент)
    function addThemeProgressBar(themeWrapper, percent) {
        const themeHeader = themeWrapper.querySelector('.theme-header');
        if (!themeHeader) return;
        
        // Проверяем, есть ли уже прогресс
        let existingProgress = themeHeader.querySelector('.theme-progress-container');
        if (existingProgress) existingProgress.remove();
        
        // Создаем контейнер только для процента
        const progressContainer = document.createElement('div');
        progressContainer.className = 'theme-progress-container';
        
        const percentSpan = document.createElement('span');
        percentSpan.className = 'theme-progress-percent';
        percentSpan.textContent = `${percent}%`;
        
        progressContainer.appendChild(percentSpan);
        themeHeader.appendChild(progressContainer);
    }
    
    // Добавление прогресс-бара для блока
    function addBlockProgressBar(blockElement, percent) {
        console.log('addBlockProgressBar вызван для блока:', blockElement.dataset.blockId, 'процент:', percent);
        
        // Ищем родительский wrapper
        const blockWrapper = blockElement.closest('.block-wrapper');
        if (!blockWrapper) {
            console.log('blockWrapper не найден');
            return;
        }
        
        // Проверяем, есть ли уже прогресс-бар для этого блока
        let existingBar = blockWrapper.querySelector('.block-progress-container');
        if (existingBar) {
            existingBar.remove();
        }
        
        // Создаем контейнер для прогресса под блоком
        const progressContainer = document.createElement('div');
        progressContainer.className = 'block-progress-container';
        
        const barWrapper = document.createElement('div');
        barWrapper.className = 'block-progress-bar-wrapper';
        
        const barFill = document.createElement('div');
        barFill.className = 'block-progress-bar-fill';
        // Принудительно устанавливаем ширину в пикселях для проверки
        barFill.style.width = `${percent}%`;
        
        const percentSpan = document.createElement('span');
        percentSpan.className = 'block-progress-percent';
        percentSpan.textContent = `${percent}%`;
        
        barWrapper.appendChild(barFill);
        progressContainer.appendChild(barWrapper);
        progressContainer.appendChild(percentSpan);
        
        blockWrapper.appendChild(progressContainer);
        console.log('Прогресс-бар добавлен, ширина fill:', percent, '%');
    }
    
    // Обновление прогресса всех тем и блоков после рендера
        // Обновление прогресса всех тем и блоков после рендера
    function updateAllProgress() {
        const themeWrappers = document.querySelectorAll('.theme-wrapper');
        
        themeWrappers.forEach(wrapper => {
            const themeId = wrapper.dataset.themeId;
            const themeProgress = studentProgress.themes[themeId];
            
            if (themeProgress) {
                addThemeProgressBar(wrapper, themeProgress.percent);
            }
            
            // Обновляем прогресс блоков внутри темы
            const blocks = wrapper.querySelectorAll('.course-block');
            blocks.forEach(block => {
                const blockId = block.dataset.blockId;
                const blockProgress = studentProgress.blocks[blockId];
                
                if (blockProgress) {
                    addBlockProgressBar(block, blockProgress.percent);
                }
            });
        });
    }
    
    function displayCourseImage(imageUrl) {
        const imageUpload = document.getElementById('courseImageUpload');
        if (!imageUpload) return;
        
        const oldPreview = imageUpload.querySelector('.image-preview');
        if (oldPreview) oldPreview.remove();
        
        const preview = document.createElement('img');
        preview.src = imageUrl;
        preview.className = 'image-preview';
        preview.style.width = '100%';
        preview.style.height = '100%';
        preview.style.objectFit = 'cover';
        preview.style.borderRadius = '25px';
        
        imageUpload.appendChild(preview);
        
        const placeholder = imageUpload.querySelector('.upload-placeholder');
        if (placeholder) placeholder.style.display = 'none';
    }
    
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
    
    function renderBlocksSection() {
        const sectionsContent = document.getElementById('sectionsContent');
        if (!sectionsContent) return;
        
        sectionsContent.innerHTML = `
            <div class="blocks-section" style="opacity: 0;">
                <div class="themes-container" id="themesContainer"></div>
            </div>
        `;
        
        loadThemesToDOM();
        
        setTimeout(() => {
            const blocksSection = sectionsContent.querySelector('.blocks-section');
            if (blocksSection) {
                gsap.to(blocksSection, { opacity: 1, duration: 0.3 });
            }
            // После рендера обновляем прогресс
            if (currentUser.role === 'student') {
                updateAllProgress();
            }
        }, 100);
    }
    
    function loadThemesToDOM() {
        const themesContainer = document.getElementById('themesContainer');
        if (!themesContainer) return;
        
        themesContainer.innerHTML = '';
        
        if (!courseData.themes || courseData.themes.length === 0) {
            themesContainer.innerHTML = '<div class="empty-state">Нет тем в этом курсе</div>';
            return;
        }
        
        const sortedThemes = [...courseData.themes].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
        
        sortedThemes.forEach((theme) => {
            const themeWrapper = createReadonlyTheme(theme.title, theme.id);
            const blocksContainer = themeWrapper.querySelector('.blocks-container');
            
            const sortedBlocks = (theme.blocks || []).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
            
            if (sortedBlocks.length > 0) {
                sortedBlocks.forEach((block) => {
                    const blockWrapper = createReadonlyBlock(block.title, block.description, block.id, theme.id);
                    blocksContainer.appendChild(blockWrapper);
                });
            } else {
                const emptyMsg = document.createElement('div');
                emptyMsg.className = 'empty-state-blocks';
                emptyMsg.textContent = 'Нет блоков в этой теме';
                blocksContainer.appendChild(emptyMsg);
            }
            
            themesContainer.appendChild(themeWrapper);
        });
    }
    
    function createReadonlyTheme(themeTitle = '', themeId = null) {
        const themeWrapper = document.createElement('div');
        themeWrapper.className = 'theme-wrapper';
        if (themeId) {
            themeWrapper.dataset.themeId = themeId;
        }
        
        themeWrapper.innerHTML = `
            <div class="theme-header">
                <div class="theme-title-container">
                    <button class="toggle-theme-btn" title="Свернуть/развернуть тему">
                        <img src="/images/teacherMainPanel/chevronDown.svg" alt="Toggle" class="chevron-icon">
                    </button>
                    <span class="course-theme-readonly">${escapeHtml(themeTitle)}</span>
                </div>
            </div>
            <div class="blocks-container"></div>
        `;
        
        const toggleBtn = themeWrapper.querySelector('.toggle-theme-btn');
        const chevronIcon = themeWrapper.querySelector('.chevron-icon');
        const blocksContainer = themeWrapper.querySelector('.blocks-container');
        
        let isThemeOpen = true;
        gsap.set(chevronIcon, { rotation: 180 });
        
        toggleBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (isThemeOpen) {
                gsap.to(blocksContainer, {
                    height: 0, opacity: 0, duration: 0.3,
                    onComplete: () => blocksContainer.style.display = 'none'
                });
                gsap.to(chevronIcon, { rotation: 0, duration: 0.2 });
            } else {
                blocksContainer.style.display = 'flex';
                blocksContainer.style.height = 'auto';
                const autoHeight = blocksContainer.offsetHeight;
                blocksContainer.style.height = '0';
                gsap.to(blocksContainer, {
                    height: autoHeight, opacity: 1, duration: 0.3,
                    onComplete: () => blocksContainer.style.height = 'auto'
                });
                gsap.to(chevronIcon, { rotation: 180, duration: 0.2 });
            }
            isThemeOpen = !isThemeOpen;
        });
        
        return themeWrapper;
    }
    
    function createReadonlyBlock(title = '', description = '', blockId = null, themeId = null) {
        const wrapper = document.createElement('div');
        wrapper.className = 'block-wrapper';
        
        const block = document.createElement('div');
        block.className = 'course-block form-block';
        if (blockId) {
            block.dataset.blockId = blockId;
        }
        
        block.innerHTML = `
            <img src="/images/teacherMainPanel/addCourseCard.png" alt="Block background" class="block-bg">
            <div class="block-content">
                <div class="block-title-readonly">${escapeHtml(title || 'Без названия')}</div>
                <div class="block-description-readonly">${escapeHtml(description || 'Нет описания')}</div>
            </div>
        `;
        
        block.addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = `/course-constructor-preview?courseId=${currentCourseId}&blockId=${blockId}&themeId=${themeId}`;
        });
        
        wrapper.appendChild(block);
        return wrapper;
    }
    
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#39;');
    }
    
    function showNotification(message, type = 'info') {
        alert(message);
    }
    
    // Навигация
    const blocksLink = document.getElementById('courseBlocksLink');
    const performanceLink = document.getElementById('coursePerformanceLink');
    
    if (blocksLink) {
        blocksLink.addEventListener('click', function(e) {
            e.preventDefault();
            blocksLink.classList.add('active');
            if (performanceLink) performanceLink.classList.remove('active');
            renderBlocksSection();
        });
    }
    
    if (performanceLink && currentUser.role !== 'student') {
        performanceLink.addEventListener('click', function(e) {
            e.preventDefault();
            performanceLink.classList.add('active');
            if (blocksLink) blocksLink.classList.remove('active');
            renderPerformanceSection();
        });
    }
    
    function renderPerformanceSection() {
        const sectionsContent = document.getElementById('sectionsContent');
        if (!sectionsContent) return;
        
        sectionsContent.innerHTML = `
            <div class="performance-section" style="opacity: 0;">
                <div class="performance-placeholder">
                    <h3>📊 Успеваемость студентов</h3>
                    <p>Раздел находится в разработке.</p>
                </div>
            </div>
        `;
        
        setTimeout(() => {
            const perfSection = sectionsContent.querySelector('.performance-section');
            if (perfSection) {
                gsap.to(perfSection, { opacity: 1, duration: 0.3 });
            }
        }, 50);
    }
    
    // Кнопка назад
    const backLink = document.querySelector('.back-to-profile');
    if (backLink) {
        backLink.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = currentUser.role === 'teacher' ? '/teacher' : '/user';
        });
    }
    
    // Анимации
    gsap.set('body', { opacity: 0 });
    gsap.to('body', { opacity: 1, duration: 0.8 });
    gsap.from('header', { y: -30, opacity: 0, duration: 0.8, delay: 0.2 });
    gsap.from('.course-info-grid', { y: 30, opacity: 0, duration: 0.8, delay: 0.3 });
    gsap.from('.course-sections-nav', { y: 30, opacity: 0, duration: 0.8, delay: 0.4 });
    
    setTimeout(() => {
        document.documentElement.classList.add('ready');
    }, 220);
});