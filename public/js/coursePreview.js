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

                const countStudentsEl = document.getElementById('countStudents');
                if (countStudentsEl) {
                    countStudentsEl.textContent = String(
                        course.students_count != null ? course.students_count : 0
                    );
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
                    
                }
                
                // Загружаем разделы для всех блоков
                if (course.themes && course.themes.length > 0) {
                    await loadAllBlocksSections(course.themes);

                    // Для студента считаем прогресс после загрузки sections
                    if (currentUser.role === 'student') {
                        await loadStudentProgress();
                    }

                    renderBlocksSection();
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки курса:', error);
            showNotification('Не удалось загрузить курс', 'error');
        }
    }
    
    async function getSectionCompletionStatus(section) {
        if (!section?.id) return false;
        if (section.needsReset === true) return false;

        try {
            if (section.type === 'theory') {
                const response = await fetch(`/api/student/progress/theory/${section.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) return false;
                const data = await response.json();
                return data.completed === true;
            }

            if (section.type === 'exercise') {
                const response = await fetch(`/api/student/progress/exercise/${section.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) return false;
                const data = await response.json();
                return data.completed === true;
            }

            if (section.type === 'test') {
                const response = await fetch(`/api/student/test/${section.id}/attempts`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) return false;
                const data = await response.json();
                const attemptsCount = data.attemptsCount || (Array.isArray(data.attempts) ? data.attempts.length : 0);
                return attemptsCount > 0;
            }
        } catch (error) {
            console.error('Ошибка проверки прогресса раздела:', section.id, error);
        }

        return false;
    }

    // Функция загрузки прогресса студента
    async function loadStudentProgress() {
        try {
            studentProgress = { themes: {}, blocks: {} };

            if (courseData.themes) {
                for (const theme of courseData.themes) {
                    const blocks = theme.blocks || [];
                    const totalBlocks = blocks.length;
                    let completedBlocks = 0;

                    for (const block of blocks) {
                        const sections = block.sections || [];
                        const totalSections = sections.length;

                        let completedSections = 0;
                        if (totalSections > 0) {
                            const sectionResults = await Promise.all(
                                sections.map(section => getSectionCompletionStatus(section))
                            );
                            completedSections = sectionResults.filter(Boolean).length;
                        }

                        const blockPercent = totalSections > 0
                            ? Math.round((completedSections / totalSections) * 100)
                            : 0;
                        const blockCompleted = totalSections > 0 && completedSections === totalSections;

                        if (blockCompleted) {
                            completedBlocks++;
                        }

                        studentProgress.blocks[block.id] = {
                            completedSections,
                            totalSections,
                            percent: blockPercent,
                            isCompleted: blockCompleted
                        };
                    }

                    const themePercent = totalBlocks > 0
                        ? Math.round(blocks.reduce((sum, b) => sum + (studentProgress.blocks[b.id]?.percent || 0), 0) / totalBlocks)
                        : 0;

                    studentProgress.themes[theme.id] = {
                        completedBlocks,
                        totalBlocks,
                        percent: themePercent
                    };
                }
            }

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
        let totalBlockPercent = 0;
        let totalBlocks = 0;
        
        for (const themeId in studentProgress.themes) {
            const theme = courseData.themes?.find(t => t.id == themeId);
            if (theme?.blocks) {
                for (const block of theme.blocks) {
                    totalBlockPercent += studentProgress.blocks[block.id]?.percent || 0;
                    totalBlocks++;
                }
            }
        }
        
        const coursePercent = totalBlocks > 0 ? Math.round(totalBlockPercent / totalBlocks) : 0;
        
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
        // Ищем родительский wrapper
        const blockWrapper = blockElement.closest('.block-wrapper');
        if (!blockWrapper) return;
        
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

    function sectionTypeLabel(type) {
        if (type === 'theory') return 'Теория';
        if (type === 'exercise') return 'Упражнение';
        if (type === 'test') return 'Тест';
        return 'Задание';
    }

    function studentDisplayName(s) {
        const parts = [s.last_name, s.first_name, s.patronymic].filter(Boolean);
        return parts.length ? parts.join(' ') : 'Студент';
    }

    async function renderPerformanceSection() {
        const sectionsContent = document.getElementById('sectionsContent');
        if (!sectionsContent) return;

        sectionsContent.innerHTML = `
            <div class="performance-section perf-loading" style="opacity: 0;">
                <p class="perf-loading-text">Загрузка успеваемости…</p>
            </div>
        `;
        gsap.to(sectionsContent.querySelector('.performance-section'), { opacity: 1, duration: 0.25 });

        try {
            const response = await fetch(`/api/courses/${currentCourseId}/performance`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Не удалось загрузить данные');
            }
            mountPerformanceUI(sectionsContent, data);
        } catch (err) {
            console.error(err);
            sectionsContent.innerHTML = `
                <div class="performance-section">
                    <div class="performance-placeholder">
                        <h3>Успеваемость</h3>
                        <p>${escapeHtml(err.message || 'Ошибка загрузки')}</p>
                    </div>
                </div>
            `;
        }
    }

    function mountPerformanceUI(container, apiData) {
        let sortMode = 'joined_new';
        let searchQuery = '';
        const students = apiData.students || [];

        const root = document.createElement('div');
        root.className = 'performance-section perf-teacher';
        root.innerHTML = `
            <div class="perf-toolbar">
                <h2 class="perf-title">Список студентов, проходящих этот курс</h2>
                <div class="perf-toolbar-right">
                    <div class="perf-dropdown perf-sort-wrap">
                        <button type="button" class="perf-sort-toggle" aria-expanded="false">
                            <span class="perf-sort-label">Сначала новые</span>
                            <img src="/images/teacherMainPanel/chevronDown.svg" alt="" class="perf-chevron">
                        </button>
                        <div class="perf-dropdown-menu" hidden>
                            <button type="button" data-sort="joined_new">Сначала новые</button>
                            <button type="button" data-sort="joined_old">Сначала старые</button>
                            <button type="button" data-sort="name_az">По алфавиту</button>
                        </div>
                    </div>
                    <div class="perf-search-wrap">
                        <input type="search" class="perf-search-input" placeholder="Поиск" autocomplete="off">
                        <img src="/images/userMainPanel/search.svg" alt="" class="perf-search-icon">
                    </div>
                </div>
            </div>
            <div class="perf-table-wrap">
                <div class="perf-student-list"></div>
            </div>
        `;

        const listEl = root.querySelector('.perf-student-list');
        const searchInput = root.querySelector('.perf-search-input');
        const sortToggle = root.querySelector('.perf-sort-toggle');
        const sortMenu = root.querySelector('.perf-dropdown-menu');
        const sortLabel = root.querySelector('.perf-sort-label');

        function filteredSorted() {
            const q = searchQuery.trim().toLowerCase();
            let rows = students.filter((s) => {
                if (!q) return true;
                const hay = [
                    studentDisplayName(s),
                    s.educational_institution,
                    s.faculty,
                    s.study_group,
                    s.study_course
                ].filter(Boolean).join(' ').toLowerCase();
                return hay.includes(q);
            });

            rows = [...rows];
            if (sortMode === 'joined_new') {
                rows.sort((a, b) => new Date(b.joined_at || 0) - new Date(a.joined_at || 0));
            } else if (sortMode === 'joined_old') {
                rows.sort((a, b) => new Date(a.joined_at || 0) - new Date(b.joined_at || 0));
            } else if (sortMode === 'name_az') {
                rows.sort((a, b) => {
                    const la = (a.last_name || '').localeCompare(b.last_name || '', 'ru');
                    if (la !== 0) return la;
                    return (a.first_name || '').localeCompare(b.first_name || '', 'ru');
                });
            }
            return rows;
        }

        function safeAttr(str) {
            return String(str || '').replace(/"/g, '&quot;');
        }

        function renderStudentCard(s) {
            const name = studentDisplayName(s);
            const avatarSrc = s.avatar_url
                ? (s.avatar_url + (s.avatar_url.includes('?') ? '&' : '?') + 'v=1')
                : '/images/userMainPanel/user.svg';
            const inst = s.educational_institution || '—';
            const fac = s.faculty || '—';
            const courseYear = s.study_course != null && s.study_course !== '' ? String(s.study_course) : '—';
            const grp = s.study_group || '—';
            const totalPts = s.total_points != null ? s.total_points : 0;

            const wrap = document.createElement('div');
            wrap.className = 'perf-student-card';
            wrap.innerHTML = `
                <div class="perf-student-row" data-action="toggle-student">
                    <div class="perf-cell perf-cell-avatar">
                        <img src="${safeAttr(avatarSrc)}" alt="" class="perf-avatar">
                    </div>
                    <div class="perf-cell perf-cell-name">${escapeHtml(name)}</div>
                    <div class="perf-cell perf-cell-inst">${escapeHtml(inst)}</div>
                    <div class="perf-cell perf-cell-fac">${escapeHtml(fac)}</div>
                    <div class="perf-cell perf-cell-year">${escapeHtml(courseYear)}</div>
                    <div class="perf-cell perf-cell-group">${escapeHtml(grp)}</div>
                    <div class="perf-cell perf-cell-total"><span class="perf-total-points">${totalPts}</span></div>
                    <div class="perf-cell perf-cell-expand">
                        <button type="button" class="perf-icon-btn perf-student-chevron" aria-label="Развернуть">
                            <img src="/images/teacherMainPanel/chevronDown.svg" alt="" class="perf-chevron">
                        </button>
                    </div>
                </div>
                <div class="perf-student-detail" hidden>
                    <div class="perf-detail-inner"></div>
                </div>
            `;

            const detailInner = wrap.querySelector('.perf-detail-inner');
            const themes = s.themes || [];
            themes.forEach((theme) => {
                const themeEl = document.createElement('div');
                themeEl.className = 'perf-theme-block';
                const blocks = theme.blocks || [];
                const blocksHtml = blocks.map((block) => {
                    const sections = block.sections || [];
                    const secRows = sections.map((sec) => `
                        <tr>
                            <td>${escapeHtml(sectionTypeLabel(sec.type))}: ${escapeHtml(sec.title || 'Без названия')}</td>
                            <td class="perf-num">${sec.points != null ? sec.points : 0}</td>
                            <td>
                                <a class="perf-go-btn" href="/course-constructor-preview?courseId=${encodeURIComponent(currentCourseId)}&blockId=${encodeURIComponent(block.id)}&themeId=${encodeURIComponent(theme.id)}&sectionId=${encodeURIComponent(sec.id)}">Перейти</a>
                            </td>
                        </tr>
                    `).join('');

                    return `
                        <div class="perf-block-card" data-block-id="${escapeHtml(block.id)}">
                            <div class="perf-block-head" data-action="toggle-block">
                                <div class="perf-block-meta">
                                    <div class="perf-block-title">${escapeHtml(block.title || 'Блок')}</div>
                                    <div class="perf-block-desc">${escapeHtml(block.description || '')}</div>
                                </div>
                                <div class="perf-block-progress">
                                    <div class="perf-bar-track"><div class="perf-bar-fill" style="width:${block.progressPercent || 0}%"></div></div>
                                    <span class="perf-pct">${block.progressPercent || 0}%</span>
                                </div>
                                <div class="perf-block-points">${block.blockPoints != null ? block.blockPoints : 0}</div>
                                <button type="button" class="perf-icon-btn perf-block-chevron" aria-label="Развернуть блок">
                                    <img src="/images/teacherMainPanel/chevronDown.svg" alt="" class="perf-chevron">
                                </button>
                            </div>
                            <div class="perf-block-assignments" hidden>
                                <table class="perf-assign-table">
                                    <thead>
                                        <tr>
                                            <th>Задания</th>
                                            <th>Баллы за задание</th>
                                            <th>Перейти к заданию</th>
                                        </tr>
                                    </thead>
                                    <tbody>${secRows}</tbody>
                                </table>
                            </div>
                        </div>
                    `;
                }).join('');

                themeEl.innerHTML = `
                    <div class="perf-theme-layout">
                        <div class="perf-theme-title-col">
                            <span class="perf-theme-name">${escapeHtml(theme.title || 'Тема')}</span>
                        </div>
                        <div class="perf-theme-body-col">
                            <div class="perf-nested-header">
                                <span>Блоки</span>
                                <span>Прогресс по каждому блоку</span>
                                <span>Баллы за блок</span>
                                <span></span>
                            </div>
                            ${blocksHtml}
                            <div class="perf-theme-total-row">
                                <span class="perf-theme-total-label">Всего баллов за тему</span>
                                <span class="perf-theme-total-val">${theme.themePoints != null ? theme.themePoints : 0}</span>
                            </div>
                        </div>
                    </div>
                `;
                detailInner.appendChild(themeEl);

                themeEl.querySelectorAll('[data-action="toggle-block"]').forEach((head) => {
                    head.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        const card = head.closest('.perf-block-card');
                        const panel = card.querySelector('.perf-block-assignments');
                        const btn = card.querySelector('.perf-block-chevron');
                        const open = panel.hidden;
                        panel.hidden = !open;
                        if (btn) btn.classList.toggle('is-open', open);
                    });
                });
            });

            const row = wrap.querySelector('.perf-student-row');
            const chev = wrap.querySelector('.perf-student-chevron');
            const detail = wrap.querySelector('.perf-student-detail');
            row.addEventListener('click', () => {
                const open = detail.hidden;
                detail.hidden = !open;
                if (chev) chev.classList.toggle('is-open', open);
            });

            return wrap;
        }

        function redraw() {
            listEl.innerHTML = '';
            const rows = filteredSorted();
            if (!rows.length) {
                listEl.innerHTML = '<div class="perf-empty">Студенты ещё не подключились к курсу или ничего не найдено.</div>';
                return;
            }
            rows.forEach((s) => listEl.appendChild(renderStudentCard(s)));
        }

        sortToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = sortMenu.hidden;
            sortMenu.hidden = !willOpen;
            sortToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
            if (willOpen) {
                setTimeout(() => {
                    const close = () => {
                        sortMenu.hidden = true;
                        sortToggle.setAttribute('aria-expanded', 'false');
                        document.removeEventListener('click', close);
                    };
                    document.addEventListener('click', close, { once: true });
                }, 0);
            }
        });
        sortMenu.querySelectorAll('button[data-sort]').forEach((btn) => {
            btn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                sortMode = btn.getAttribute('data-sort');
                sortLabel.textContent = btn.textContent.trim();
                sortMenu.hidden = true;
                sortToggle.setAttribute('aria-expanded', 'false');
                redraw();
            });
        });
        sortMenu.addEventListener('click', (ev) => ev.stopPropagation());

        searchInput.addEventListener('input', () => {
            searchQuery = searchInput.value;
            redraw();
        });

        container.innerHTML = '';
        container.appendChild(root);
        redraw();
        gsap.from(root, { opacity: 0, y: 12, duration: 0.35 });
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

    window.addEventListener('pageshow', (event) => {
        const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
        const backNav = nav && nav.type === 'back_forward';
        if ((event.persisted || backNav) && currentCourseId && currentUser?.role !== 'admin') {
            loadCourseData();
        }
    });
});