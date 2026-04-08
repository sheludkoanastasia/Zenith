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
    
    const imageUpload = document.getElementById('courseImageUpload');
    const blocksLink = document.getElementById('courseBlocksLink');
    const performanceLink = document.getElementById('coursePerformanceLink');
    const sectionsContent = document.getElementById('sectionsContent');
    
    function displayCourseImage(imageUrl) {
        if (!imageUpload) return;
        
        const oldPreview = imageUpload.querySelector('.image-preview');
        if (oldPreview) oldPreview.remove();
        
        const preview = document.createElement('img');
        preview.src = imageUrl;
        preview.className = 'image-preview';
        
        imageUpload.appendChild(preview);
        imageUpload.style.position = 'relative';
        
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
    
    async function loadCourseForPreview(courseId) {
        try {
            const response = await fetch(`/api/courses/${courseId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const data = await response.json();
            
            if (data.success) {
                const course = data.course;
                
                const titleInput = document.getElementById('courseTitle');
                if (titleInput) titleInput.value = course.title;
                
                if (course.cover_image) {
                    displayCourseImage(course.cover_image);
                }
                
                if (course.themes && course.themes.length > 0) {
                    courseData.themes = JSON.parse(JSON.stringify(course.themes));
                    await loadAllBlocksSections(courseData.themes);
                    console.log('Загружены темы:', courseData.themes);
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки курса:', error);
        }
    }
    
    // Проверка авторизации
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
        
        // Отображаем имя преподавателя
        const teacherNameSpan = document.getElementById('teacherName');
        if (teacherNameSpan) {
            const fullName = [data.user.lastName, data.user.firstName, data.user.patronymic]
                .filter(part => part && part.trim() !== '')
                .join(' ');
            teacherNameSpan.textContent = fullName || 'Преподаватель';
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        const courseId = urlParams.get('id');
        
        if (courseId) {
            currentCourseId = courseId;
            await loadCourseForPreview(courseId);
        } else {
            alert('Курс не найден');
            setTimeout(() => window.location.href = '/teacher', 2000);
            return;
        }
        
        setTimeout(() => {
            if (blocksLink && blocksLink.classList.contains('active')) {
                renderBlocksSection();
            }
        }, 200);
        
    } catch (error) {
        console.error('Ошибка:', error);
        window.location.href = '/auth';
        return;
    }
    
    function renderBlocksSection() {
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
        }, 50);
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
                    const blockEl = createReadonlyBlock(block.title, block.description, block.id, theme.id);
                    blocksContainer.appendChild(blockEl);
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
        if (themeId) themeWrapper.dataset.themeId = themeId;
        
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
        const block = document.createElement('div');
        block.className = 'course-block form-block';
        if (blockId) block.dataset.blockId = blockId;
        
        block.innerHTML = `
            <img src="/images/teacherMainPanel/addCourseCard.png" alt="Block background" class="block-bg">
            <div class="block-content">
                <div class="block-title-readonly">${escapeHtml(title || 'Без названия')}</div>
                <div class="block-description-readonly">${escapeHtml(description || 'Нет описания')}</div>
            </div>
        `;
        
        block.addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = `/teacher/course-constructor-preview?courseId=${currentCourseId}&blockId=${blockId}&themeId=${themeId}`;
        });
        
        return block;
    }
    
    function renderPerformanceSection() {
        if (!sectionsContent) return;
        
        sectionsContent.innerHTML = `
            <div class="performance-section" style="opacity: 0;">
                <div class="performance-placeholder">
                    <h3>📊 Успеваемость студентов</h3>
                    <p>Раздел находится в разработке.</p>
                    <p>Здесь будет отображаться прогресс студентов по курсу, статистика прохождения заданий и аналитика успеваемости.</p>
                    <p>Скоро здесь появится полная аналитика!</p>
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
    
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#39;');
    }
    
    // Навигация
    if (blocksLink) {
        blocksLink.addEventListener('click', function(e) {
            e.preventDefault();
            blocksLink.classList.add('active');
            if (performanceLink) performanceLink.classList.remove('active');
            renderBlocksSection();
        });
    }
    
    if (performanceLink) {
        performanceLink.addEventListener('click', function(e) {
            e.preventDefault();
            performanceLink.classList.add('active');
            if (blocksLink) blocksLink.classList.remove('active');
            renderPerformanceSection();
        });
    }
    
    // Кнопка назад
    const backLink = document.querySelector('.back-to-profile');
    if (backLink) {
        backLink.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = '/teacher';
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