// public/js/courseConstructorPreview.js
// Preview версия конструктора курса - только для просмотра

// Глобальные переменные
let currentCourse = null;
let currentBlock = null;
let currentSections = [];
let apiBaseUrl = '/api';

const urlParams = new URLSearchParams(window.location.search);
const courseId = urlParams.get('courseId');
const blockId = urlParams.get('blockId');
const themeId = urlParams.get('themeId');

const courseTitleEl = document.getElementById('courseTitle');
const themesListEl = document.getElementById('themesList');
const welcomeScreen = document.getElementById('welcomeScreen');
const sectionsArea = document.getElementById('sectionsArea');
const currentBlockTitle = document.getElementById('currentBlockTitle');
const currentBlockDescription = document.getElementById('currentBlockDescription');
const sectionsList = document.getElementById('sectionsList');
const backButton = document.getElementById('backToCourseBtn');

// Для просмотра теории
let quillPreview = null;

// Текущие разделы для навигации
let currentEditingTheorySection = null;
let currentEditingExerciseSection = null;
let currentUserRole = null;

function getToken() {
    return localStorage.getItem('token');
}

// Функция для сортировки блоков по order_index
function sortBlocksInThemes(themes) {
    if (!themes) return themes;
    
    const sortedThemes = [...themes].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    
    sortedThemes.forEach(theme => {
        if (theme.blocks && theme.blocks.length > 0) {
            theme.blocks.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
        }
    });
    
    return sortedThemes;
}

function showNotification(message, type = 'info') {
    addNotificationStyles();
    
    const oldToasts = document.querySelectorAll('.preview-toast');
    oldToasts.forEach(toast => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    });
    
    const toast = document.createElement('div');
    toast.className = `preview-toast ${type}`;
    
    let title = '';
    switch (type) {
        case 'success': title = 'Успешно'; break;
        case 'error': title = 'Ошибка'; break;
        case 'warning': title = 'Внимание'; break;
        case 'info': title = 'Информация'; break;
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

function addNotificationStyles() {
    if (document.getElementById('preview-toast-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'preview-toast-styles';
    style.textContent = `
        .preview-toast {
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
        .preview-toast.success { border-left: 6px solid #4CAF50; }
        .preview-toast.info { border-left: 6px solid #7651BE; }
        .preview-toast.warning { border-left: 6px solid #FFB800; }
        .preview-toast.error { border-left: 6px solid #FF3B3B; }
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
        .preview-toast.hiding {
            animation: slideOutRight 0.3s ease forwards;
        }
    `;
    document.head.appendChild(style);
}

async function loadCourseData() {
    if (!courseId) {
        console.error('ID курса не указан');
        showNotification('ID курса не указан', 'error');
        return;
    }

    try {
        const userResponse = await fetch('/api/auth/check', {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const userData = await userResponse.json();
        if (userData.success) {
            currentUserRole = userData.user.role;
        }

        const response = await fetch(`${apiBaseUrl}/courses/${courseId}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (!response.ok) throw new Error('Ошибка загрузки курса');

        const data = await response.json();
        if (data.success) {
            currentCourse = data.course;
            
            for (const theme of currentCourse.themes) {
                if (theme.blocks && theme.blocks.length > 0) {
                    theme.blocks.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
                }
            }
            
            courseTitleEl.textContent = currentCourse.title;
            
            await loadAllBlocksSections(currentCourse.themes);
            renderThemes(currentCourse.themes);
            
            if (blockId) {
                let targetBlock = null;
                let targetBlockTitle = '';
                let targetBlockDescription = '';
                
                for (const theme of currentCourse.themes) {
                    const foundBlock = theme.blocks?.find(b => b.id === blockId);
                    if (foundBlock) {
                        targetBlock = foundBlock;
                        targetBlockTitle = foundBlock.title;
                        targetBlockDescription = foundBlock.description || '';
                        break;
                    }
                }
                
                if (targetBlock) {
                    setTimeout(() => {
                        const blockElement = document.querySelector(`.block-item[data-block-id="${blockId}"]`);
                        if (blockElement) {
                            blockElement.click();
                            blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }, 500);
                    
                    loadBlockSections(blockId, targetBlockTitle, targetBlockDescription);
                }
            }
            initButtonsByRole();
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Не удалось загрузить данные курса', 'error');
    }
}

async function loadAllBlocksSections(themes) {
    for (const theme of themes) {
        if (theme.blocks && theme.blocks.length > 0) {
            for (const block of theme.blocks) {
                try {
                    const response = await fetch(`${apiBaseUrl}/blocks/${block.id}/sections`, {
                        headers: { 'Authorization': `Bearer ${getToken()}` }
                    });
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success) {
                            block.sections = data.sections || [];
                        }
                    }
                } catch (error) {
                    console.error(`Ошибка загрузки разделов для блока ${block.id}:`, error);
                    block.sections = [];
                }
            }
        }
    }
}

function renderThemes(themes) {
    if (!themes || themes.length === 0) {
        themesListEl.innerHTML = '<p class="empty-message">Нет тем в этом курсе</p>';
        return;
    }

    const sortedThemes = sortBlocksInThemes(themes);

    themesListEl.innerHTML = sortedThemes.map((theme) => {
        const sortedBlocks = theme.blocks || [];
        
        const hasActiveBlock = sortedBlocks.some(block => block.id === (currentBlock?.id || blockId));
        const isInitiallyExpanded = hasActiveBlock;
        
        return `
            <div class="theme-item" data-theme-id="${theme.id}">
                <div class="theme-header-wrapper">
                    <div class="theme-header">${escapeHtml(theme.title)}</div>
                    <button class="theme-toggle ${!isInitiallyExpanded ? 'collapsed' : ''}" data-theme-id="${theme.id}">
                        <img src="/images/taskCreationPage/chevronDown.svg" alt="toggle">
                    </button>
                </div>
                <div class="theme-blocks-container ${!isInitiallyExpanded ? 'collapsed' : ''}" id="theme-blocks-${theme.id}">
                    <div class="blocks-list">
                        ${sortedBlocks.length > 0 
                            ? sortedBlocks.map((block) => `
                                <div class="block-item-wrapper" data-block-id="${block.id}">
                                    <div class="block-header-wrapper">
                                        <div class="block-item ${(currentBlock?.id === block.id || blockId === block.id) ? 'active' : ''}" 
                                             data-block-id="${block.id}" 
                                             data-block-title="${escapeHtml(block.title)}" 
                                             data-block-description="${escapeHtml(block.description || '')}">
                                            ${escapeHtml(block.title)}
                                        </div>
                                        <button class="block-toggle ${(currentBlock?.id === block.id || blockId === block.id) ? '' : 'collapsed'}" data-block-id="${block.id}">
                                            <img src="/images/taskCreationPage/chevronDown.svg" alt="toggle">
                                        </button>
                                    </div>
                                    <div class="block-sections-list" id="block-sections-${block.id}" style="display: ${(currentBlock?.id === block.id || blockId === block.id) ? 'block' : 'none'};">
                                        ${renderBlockSections(block.sections || [])}
                                    </div>
                                </div>
                            `).join('')
                            : '<div class="empty-message">Нет блоков в этой теме</div>'
                        }
                    </div>
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.theme-toggle').forEach(toggle => {
        const themeId = toggle.dataset.themeId;
        const container = document.getElementById(`theme-blocks-${themeId}`);
        
        toggle.removeEventListener('click', toggle._listener);
        toggle._listener = (e) => {
            e.stopPropagation();
            if (container) {
                container.classList.toggle('collapsed');
                toggle.classList.toggle('collapsed');
            }
        };
        toggle.addEventListener('click', toggle._listener);
    });

    document.querySelectorAll('.block-toggle').forEach(toggle => {
        const blockId = toggle.dataset.blockId;
        const sectionsList = document.getElementById(`block-sections-${blockId}`);
        
        toggle.removeEventListener('click', toggle._listener);
        toggle._listener = (e) => {
            e.stopPropagation();
            if (sectionsList) {
                if (sectionsList.style.display === 'none') {
                    sectionsList.style.display = 'block';
                    toggle.classList.remove('collapsed');
                } else {
                    sectionsList.style.display = 'none';
                    toggle.classList.add('collapsed');
                }
            }
        };
        toggle.addEventListener('click', toggle._listener);
    });

    document.querySelectorAll('.block-item').forEach(blockEl => {
        blockEl.removeEventListener('click', blockEl._listener);
        blockEl._listener = () => {
            const clickedBlockId = blockEl.dataset.blockId;
            const blockTitle = blockEl.dataset.blockTitle;
            const blockDescription = blockEl.dataset.blockDescription;
            
            performBlockSwitch(clickedBlockId, blockTitle, blockDescription);
        };
        blockEl.addEventListener('click', blockEl._listener);
    });
}

function renderBlockSections(sections) {
    if (!sections || sections.length === 0) {
        return '<div class="empty-sections-message">Нет разделов</div>';
    }
    
    return sections.map(section => {
        let typeClass = '';
        switch (section.type) {
            case 'theory': typeClass = 'theory'; break;
            case 'exercise': typeClass = 'exercise'; break;
            case 'test': typeClass = 'test'; break;
            default: typeClass = 'theory';
        }
        
        return `
            <div class="sidebar-section-item" data-section-id="${section.id}" data-section-type="${section.type}">
                <span class="section-title-text" data-type="${typeClass}">${escapeHtml(section.title)}</span>
                <img src="/images/taskCreationPage/rightArrow.svg" alt="arrow" class="section-arrow-icon">
            </div>
        `;
    }).join('');
}

function updateSidebarSections(blockId, sections) {
    const sectionsContainer = document.getElementById(`block-sections-${blockId}`);
    if (sectionsContainer) {
        sectionsContainer.innerHTML = renderBlockSections(sections);
        
        sectionsContainer.querySelectorAll('.sidebar-section-item').forEach(sectionEl => {
            const sectionId = sectionEl.dataset.sectionId;
            const section = sections.find(s => s.id === sectionId);
            
            sectionEl.removeEventListener('click', sectionEl._listener);
            sectionEl._listener = (e) => {
                e.stopPropagation();
                if (section) {
                    if (section.type === 'theory') {
                        loadTheorySection(section.id);
                    } else if (section.type === 'exercise') {
                        loadExerciseSection(section.id);
                    } else if (section.type === 'test') {
                        loadTestSection(section.id);
                    }
                }
            };
            sectionEl.addEventListener('click', sectionEl._listener);
        });
    }
}

async function loadBlockSections(blockId, blockTitle, blockDescription) {
    try {
        const response = await fetch(`${apiBaseUrl}/blocks/${blockId}/sections`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (!response.ok) throw new Error('Ошибка загрузки разделов');

        const data = await response.json();
        if (data.success) {
            currentBlock = { id: blockId, title: blockTitle, description: blockDescription };
            currentSections = data.sections;
            
            if (currentCourse && currentCourse.themes) {
                for (const theme of currentCourse.themes) {
                    const block = theme.blocks?.find(b => b.id === blockId);
                    if (block) {
                        block.sections = currentSections;
                        break;
                    }
                }
            }
            
            updateSidebarSections(blockId, currentSections);
            
            welcomeScreen.style.display = 'none';
            sectionsArea.style.display = 'block';
            
            currentBlockTitle.textContent = blockTitle;
            currentBlockDescription.textContent = blockDescription;
            
            renderSections(currentSections);
            
            updateActiveBlockInSidebar(blockId);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Не удалось загрузить разделы', 'error');
    }
}

function updateActiveBlockInSidebar(blockId) {
    document.querySelectorAll('.block-item').forEach(el => {
        el.classList.remove('active');
    });
    const activeBlock = document.querySelector(`.block-item[data-block-id="${blockId}"]`);
    if (activeBlock) {
        activeBlock.classList.add('active');
    }
    
    expandParentTheme(blockId);
    
    document.querySelectorAll('.block-sections-list').forEach(list => {
        list.style.display = 'none';
    });
    const sectionsListContainer = document.getElementById(`block-sections-${blockId}`);
    if (sectionsListContainer) {
        sectionsListContainer.style.display = 'block';
    }
    
    document.querySelectorAll('.block-toggle').forEach(toggle => {
        const toggleBlockId = toggle.dataset.blockId;
        if (toggleBlockId === blockId) {
            toggle.classList.remove('collapsed');
        } else {
            toggle.classList.add('collapsed');
        }
    });
}

function expandParentTheme(blockId) {
    const blockWrapper = document.querySelector(`.block-item-wrapper[data-block-id="${blockId}"]`);
    if (!blockWrapper) return;
    
    const themeBlocksContainer = blockWrapper.closest('.theme-blocks-container');
    if (!themeBlocksContainer) return;
    
    const themeItem = themeBlocksContainer.closest('.theme-item');
    if (!themeItem) return;
    
    const themeToggle = themeItem.querySelector('.theme-toggle');
    const themeContainer = themeItem.querySelector('.theme-blocks-container');
    
    if (themeContainer && themeContainer.classList.contains('collapsed')) {
        themeContainer.classList.remove('collapsed');
        if (themeToggle) themeToggle.classList.remove('collapsed');
    }
}

function renderSections(sections) {
    if (!sections || sections.length === 0) {
        sectionsList.innerHTML = `
            <div class="empty-state">
                <p>В этом блоке пока нет разделов</p>
            </div>
        `;
        return;
    }

    sectionsList.innerHTML = sections.map(section => {
        let typeLabel = '';
        let typeValue = '';
        switch (section.type) {
            case 'theory': 
                typeLabel = 'Теория'; 
                typeValue = 'theory';
                break;
            case 'exercise': 
                typeLabel = 'Упражнение'; 
                typeValue = 'exercise';
                break;
            case 'test': 
                typeLabel = 'Итоговый тест'; 
                typeValue = 'test';
                break;
            default: 
                typeLabel = 'Раздел';
                typeValue = 'theory';
        }
        
        return `
            <div class="section-card" data-section-id="${section.id}" data-section-type="${section.type}">
                <div class="section-header">
                    <div class="section-title">
                        <span class="section-type-badge" data-type="${typeValue}">${typeLabel}</span>
                        <h3>${escapeHtml(section.title)}</h3>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.section-card').forEach(card => {
        card.removeEventListener('click', card._listener);
        card._listener = () => {
            const sectionId = card.dataset.sectionId;
            const section = currentSections.find(s => s.id === sectionId);
            if (section) {
                if (section.type === 'theory') {
                    loadTheorySection(sectionId);
                } else if (section.type === 'exercise') {
                    loadExerciseSection(sectionId);
                } else if (section.type === 'test') {
                    loadTestSection(sectionId);
                }
            }
        };
        card.addEventListener('click', card._listener);
    });
}

function performBlockSwitch(clickedBlockId, blockTitle, blockDescription) {
    const theoryPreviewContainer = document.getElementById('theoryPreviewContainer');
    const exercisePreviewContainer = document.getElementById('exercisePreviewContainer');
    const testPreviewContainer = document.getElementById('testPreviewContainer');
    
    if (theoryPreviewContainer) theoryPreviewContainer.style.display = 'none';
    if (exercisePreviewContainer) exercisePreviewContainer.style.display = 'none';
    if (testPreviewContainer) testPreviewContainer.style.display = 'none';
    
    document.getElementById('theoryNextStep').style.display = 'none';
    document.getElementById('exerciseNextStep').style.display = 'none';
    document.getElementById('testNextStep').style.display = 'none';
    
    expandParentTheme(clickedBlockId);
    updateActiveBlockInSidebar(clickedBlockId);
    
    const newUrl = `/teacher/course-constructor-preview?courseId=${courseId}&blockId=${clickedBlockId}&themeId=${themeId}`;
    window.history.pushState({}, '', newUrl);
    
    loadBlockSections(clickedBlockId, blockTitle, blockDescription);
}

// ===== ПРОСМОТР ТЕОРИИ =====

function initQuillPreview() {
    const previewContainer = document.getElementById('quillPreview');
    if (!previewContainer) return;
    
    quillPreview = new Quill('#quillPreview', {
        theme: 'bubble',
        readOnly: true,
        modules: {
            toolbar: false
        }
    });
}

async function loadTheorySection(sectionId) {
    try {
        const sectionsAreaEl = document.getElementById('sectionsArea');
        const welcomeScreenEl = document.getElementById('welcomeScreen');
        if (sectionsAreaEl) sectionsAreaEl.style.display = 'none';
        if (welcomeScreenEl) welcomeScreenEl.style.display = 'none';
        
        const token = getToken();
        const response = await fetch(`${apiBaseUrl}/sections/${sectionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const section = data.section;
            
            currentEditingTheorySection = section;
            currentEditingExerciseSection = null;
            
            const theoryTitleEl = document.getElementById('currentTheoryTitle');
            if (theoryTitleEl) {
                theoryTitleEl.textContent = section.title;
            }
            
            const theoryText = section.theoryContent?.text || '';
            
            if (quillPreview) {
                quillPreview.root.innerHTML = theoryText;
            } else {
                const previewDiv = document.getElementById('quillPreview');
                if (previewDiv) previewDiv.innerHTML = theoryText;
            }
            
            const previewContainer = document.getElementById('theoryPreviewContainer');
            const exercisePreviewContainer = document.getElementById('exercisePreviewContainer');
            const testPreviewContainer = document.getElementById('testPreviewContainer');
            
            if (exercisePreviewContainer) exercisePreviewContainer.style.display = 'none';
            if (testPreviewContainer) testPreviewContainer.style.display = 'none';
            if (previewContainer) previewContainer.style.display = 'block';
            
            // Для студента проверяем статус теории
            if (currentUserRole === 'student') {
                const isCompleted = await checkTheoryStatus(sectionId);
                updateTheoryButtonState(sectionId, isCompleted);
            } else {
                updateNextStepButton(sectionId);
            }
        } else {
            showNotification('Ошибка загрузки раздела', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка загрузки раздела', 'error');
    }
}

// ===== ПРОСМОТР УПРАЖНЕНИЙ =====

async function loadExerciseSection(sectionId) {
    try {
        const sectionsAreaEl = document.getElementById('sectionsArea');
        const welcomeScreenEl = document.getElementById('welcomeScreen');
        if (sectionsAreaEl) sectionsAreaEl.style.display = 'none';
        if (welcomeScreenEl) welcomeScreenEl.style.display = 'none';
        
        const token = getToken();
        const response = await fetch(`${apiBaseUrl}/sections/${sectionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const section = data.section;
            
            currentEditingExerciseSection = section;
            currentEditingTheorySection = null;
            
            const exerciseTitleEl = document.getElementById('currentExerciseTitle');
            if (exerciseTitleEl) {
                exerciseTitleEl.textContent = section.title;
            }
            
            const exerciseData = section.exercise || {};
            const exerciseType = exerciseData.exercise_type || 'matching';
            
            let typeText = '';
            switch (exerciseType) {
                case 'matching': typeText = 'Сопоставление'; break;
                case 'choice': typeText = 'Выбор правильного'; break;
                case 'fill_blanks': typeText = 'Дополнение'; break;
                default: typeText = 'Сопоставление';
            }
            
            const typeBadge = document.querySelector('.exercise-type-badge-preview .type-badge');
            if (typeBadge) typeBadge.textContent = typeText;
            
            document.getElementById('matchingExercisePreview').style.display = 'none';
            document.getElementById('choiceExercisePreview').style.display = 'none';
            document.getElementById('fillBlanksExercisePreview').style.display = 'none';
            
            if (currentUserRole === 'student') {
                if (exerciseType === 'matching') {
                    document.getElementById('matchingExercisePreview').style.display = 'block';
                    renderStudentMatching(exerciseData, 'matchingExercisePreview');
                } else if (exerciseType === 'choice') {
                    document.getElementById('choiceExercisePreview').style.display = 'block';
                    renderStudentChoice(exerciseData, 'choiceExercisePreview');
                } else if (exerciseType === 'fill_blanks') {
                    document.getElementById('fillBlanksExercisePreview').style.display = 'block';
                    renderStudentFillBlanks(exerciseData, 'fillBlanksExercisePreview');
                }
            } else {
                if (exerciseType === 'matching') {
                    document.getElementById('matchingExercisePreview').style.display = 'block';
                    renderPreviewMatching(exerciseData);
                } else if (exerciseType === 'choice') {
                    document.getElementById('choiceExercisePreview').style.display = 'block';
                    renderPreviewChoice(exerciseData);
                } else if (exerciseType === 'fill_blanks') {
                    document.getElementById('fillBlanksExercisePreview').style.display = 'block';
                    renderPreviewFillBlanks(exerciseData);
                }
            }
            
            const previewContainer = document.getElementById('exercisePreviewContainer');
            const theoryPreviewContainer = document.getElementById('theoryPreviewContainer');
            const testPreviewContainer = document.getElementById('testPreviewContainer');
            
            if (theoryPreviewContainer) theoryPreviewContainer.style.display = 'none';
            if (testPreviewContainer) testPreviewContainer.style.display = 'none';
            if (previewContainer) previewContainer.style.display = 'block';
            
            updateNextStepButton(sectionId);
            
        } else {
            showNotification('Ошибка загрузки раздела', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка загрузки раздела', 'error');
    }
}

function renderPreviewMatching(exerciseData) {
    const items = exerciseData.left_column || [];
    const targets = exerciseData.right_column || [];
    const pairs = exerciseData.matches || [];
    const taskText = exerciseData.question_text || 'Сопоставьте каждый элемент с его сопоставлением.';
    
    const taskTextEl = document.getElementById('matchingTaskText');
    if (taskTextEl) taskTextEl.textContent = taskText;
    
    const itemsContainer = document.getElementById('previewItemsList');
    if (itemsContainer) {
        if (items.length === 0) {
            itemsContainer.innerHTML = '<div class="empty-message">Нет элементов</div>';
        } else {
            itemsContainer.innerHTML = items.map((item, idx) => `
                <div class="preview-item-row">
                    <div class="item-number-preview">${idx + 1}.</div>
                    <div class="item-text-preview">${escapeHtml(item.text)}</div>
                </div>
            `).join('');
        }
    }
    
    const targetsContainer = document.getElementById('previewTargetsList');
    if (targetsContainer) {
        if (targets.length === 0) {
            targetsContainer.innerHTML = '<div class="empty-message">Нет элементов сопоставления</div>';
        } else {
            targetsContainer.innerHTML = targets.map((target, idx) => `
                <div class="preview-target-row">
                    <div class="target-letter-preview">${String.fromCharCode(65 + idx)}.</div>
                    <div class="target-text-preview">${escapeHtml(target.text)}</div>
                </div>
            `).join('');
        }
    }
    
    const rowsContainer = document.getElementById('previewMatchingRows');
    if (rowsContainer) {
        if (targets.length === 0) {
            rowsContainer.innerHTML = '<div class="empty-message">Добавьте элементы сопоставления</div>';
        } else {
            rowsContainer.innerHTML = targets.map((target, idx) => {
                const pair = pairs.find(p => p.targetId == target.id);
                const item = items.find(i => i.id == pair?.itemId);
                const itemText = item ? `${items.findIndex(i => i.id == item.id) + 1}. ${item.text}` : '—';
                
                return `
                    <div class="matching-row-preview">
                        <div class="matching-cell-preview">
                            <div class="matching-item-text">${escapeHtml(itemText)}</div>
                        </div>
                        <div class="matching-cell-preview">
                            <div class="matching-target-text-preview">
                                <strong>${String.fromCharCode(65 + idx)}.</strong> ${escapeHtml(target.text)}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

function renderPreviewChoice(exerciseData) {
    const statements = exerciseData.options || [];
    const taskText = exerciseData.question_text || 'Сопоставьте каждое утверждение с правильным ответом (правильных ответов может быть несколько).';
    
    const taskTextEl = document.getElementById('choiceTaskText');
    if (taskTextEl) taskTextEl.textContent = taskText;
    
    const statementsContainer = document.getElementById('previewStatementsList');
    if (statementsContainer) {
        if (statements.length === 0) {
            statementsContainer.innerHTML = '<div class="empty-message">Нет утверждений</div>';
        } else {
            statementsContainer.innerHTML = statements.map((statement, stmtIdx) => `
                <div class="preview-statement-card">
                    <div class="preview-statement-header">
                        <div class="statement-number-preview">${stmtIdx + 1}.</div>
                        <div class="statement-text-preview">${escapeHtml(statement.text)}</div>
                    </div>
                    <div class="preview-answers-section">
                        <div class="answers-header">Ответы (правильных может быть несколько):</div>
                        <div class="preview-answers-list">
                            ${(statement.answers || []).map((answer, ansIdx) => `
                                <div class="preview-answer-row">
                                    <div class="radio-indicator ${answer.isCorrect ? 'correct' : ''}"></div>
                                    <div class="answer-number-preview">${String.fromCharCode(65 + ansIdx)}.</div>
                                    <div class="answer-text-preview">${escapeHtml(answer.text)}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }
}

function renderPreviewFillBlanks(exerciseData) {
    const words = exerciseData.options?.words || [];
    const sentences = exerciseData.options?.sentences || [];
    const taskText = exerciseData.question_text || 'Вставьте подходящее по смыслу слово в каждое предложение.';
    
    const taskTextEl = document.getElementById('fillBlanksTaskText');
    if (taskTextEl) taskTextEl.textContent = taskText;
    
    const wordsContainer = document.getElementById('previewWordsList');
    if (wordsContainer) {
        if (words.length === 0) {
            wordsContainer.innerHTML = '<div class="empty-message">Нет слов для справки</div>';
        } else {
            wordsContainer.innerHTML = words.map(word => `
                <span class="preview-word-chip">${escapeHtml(word.text)}</span>
            `).join('');
        }
    }
    
    const sentencesContainer = document.getElementById('previewSentencesList');
    if (sentencesContainer) {
        if (sentences.length === 0) {
            sentencesContainer.innerHTML = '<div class="empty-message">Нет предложений</div>';
        } else {
            sentencesContainer.innerHTML = sentences.map((sentence, idx) => {
                let textWithBlanks = sentence.text || '';
                const blanks = sentence.correctAnswers || [];
                
                let blankIndex = 0;
                textWithBlanks = textWithBlanks.replace(/_______/g, () => {
                    const answer = blanks[blankIndex] || '???';
                    blankIndex++;
                    return `<span class="blank-placeholder">[${escapeHtml(answer)}]</span>`;
                });
                
                return `
                    <div class="preview-sentence-card">
                        <div class="sentence-header-preview">
                            <div class="sentence-number-preview">Предложение ${idx + 1}</div>
                        </div>
                        <div class="sentence-text-preview">${textWithBlanks}</div>
                        <div class="blanks-section-preview">
                            <div class="blanks-title">Правильные ответы:</div>
                            <div class="preview-blanks-list">
                                ${blanks.map((answer, blankIdx) => `
                                    <div class="preview-blank-row">
                                        <div class="blank-number-preview">Пропуск ${blankIdx + 1}:</div>
                                        <div class="blank-answer-preview">${escapeHtml(answer)}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

// ===== ПРОСМОТР ИТОГОВОГО ТЕСТА =====

async function loadTestSection(sectionId) {
    try {
        const sectionsAreaEl = document.getElementById('sectionsArea');
        const welcomeScreenEl = document.getElementById('welcomeScreen');
        if (sectionsAreaEl) sectionsAreaEl.style.display = 'none';
        if (welcomeScreenEl) welcomeScreenEl.style.display = 'none';
        
        const token = getToken();
        const response = await fetch(`${apiBaseUrl}/sections/${sectionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const section = data.section;
            
            currentEditingExerciseSection = section;
            currentEditingTheorySection = null;
            
            const testTitleEl = document.getElementById('currentTestTitle');
            if (testTitleEl) {
                testTitleEl.textContent = section.title;
            }
            
            const testData = section.test || {};
            
            const deadlineSpan = document.getElementById('previewDeadline');
            if (deadlineSpan) {
                if (testData.deadline) {
                    const date = new Date(testData.deadline);
                    deadlineSpan.textContent = date.toLocaleString('ru-RU');
                } else {
                    deadlineSpan.textContent = 'Не установлен';
                }
            }
            
            const timeLimitSpan = document.getElementById('previewTimeLimit');
            if (timeLimitSpan) {
                const timeLimitMinutes = testData.time_limit;
                if (timeLimitMinutes && timeLimitMinutes > 0) {
                    const days = Math.floor(timeLimitMinutes / (24 * 60));
                    const hours = Math.floor((timeLimitMinutes % (24 * 60)) / 60);
                    const minutes = timeLimitMinutes % 60;
                    
                    let timeStr = '';
                    if (days > 0) timeStr += `${days} дн. `;
                    if (hours > 0) timeStr += `${hours} ч. `;
                    if (minutes > 0) timeStr += `${minutes} мин.`;
                    timeLimitSpan.textContent = timeStr.trim() || 'Без ограничения';
                } else {
                    timeLimitSpan.textContent = 'Без ограничения';
                }
            }
            
            const exercises = testData.exercises || [];
            renderPreviewTestExercises(exercises);
            
            const previewContainer = document.getElementById('testPreviewContainer');
            const theoryPreviewContainer = document.getElementById('theoryPreviewContainer');
            const exercisePreviewContainer = document.getElementById('exercisePreviewContainer');
            
            if (theoryPreviewContainer) theoryPreviewContainer.style.display = 'none';
            if (exercisePreviewContainer) exercisePreviewContainer.style.display = 'none';
            if (previewContainer) previewContainer.style.display = 'block';
            
            updateNextStepButton(sectionId);
            
        } else {
            showNotification('Ошибка загрузки раздела', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка загрузки раздела', 'error');
    }
}

function renderPreviewTestExercises(exercises) {
    const container = document.getElementById('previewTestExercisesList');
    if (!container) return;
    
    if (exercises.length === 0) {
        container.innerHTML = '<div class="empty-message">Нет тестирований</div>';
        return;
    }
    
    container.innerHTML = '';
    
    exercises.forEach((exercise, idx) => {
        let typeText = '';
        switch (exercise.type) {
            case 'matching': typeText = 'Сопоставление'; break;
            case 'choice': typeText = 'Выбор правильного'; break;
            case 'fill_blanks': typeText = 'Дополнение'; break;
            default: typeText = 'Сопоставление';
        }
        
        const exerciseContainerId = `test-exercise-${exercise.id}-${Date.now()}-${idx}`;
        
        const card = document.createElement('div');
        card.className = 'preview-test-exercise-card';
        card.dataset.exerciseId = exercise.id;
        
        // Для студента - скрываем баллы
        const scoringHtml = currentUserRole === 'student' ? '' : `
            <div class="preview-scoring-section">
                <div class="scoring-title">Баллы за попытки</div>
                <div class="scoring-row">
                    <div class="scoring-field">
                        <label>1 попытка:</label>
                        <span class="scoring-value">${exercise.scoring?.firstAttempt ?? 100} баллов</span>
                    </div>
                    <div class="scoring-field">
                        <label>2 попытка:</label>
                        <span class="scoring-value">${exercise.scoring?.secondAttempt ?? 50} баллов</span>
                    </div>
                    <div class="scoring-field">
                        <label>3 попытка:</label>
                        <span class="scoring-value">${exercise.scoring?.thirdAttempt ?? 25} баллов</span>
                    </div>
                    <div class="scoring-field">
                        <label>последующие:</label>
                        <span class="scoring-value">${exercise.scoring?.subsequentAttempts ?? 0} баллов</span>
                    </div>
                </div>
            </div>
        `;

        card.innerHTML = `
            <div class="preview-test-exercise-header">
                <div class="exercise-number-preview">${idx + 1}.</div>
                <div class="exercise-title-preview">${escapeHtml(exercise.title)}</div>
                <div class="exercise-type-preview">${typeText}</div>
            </div>
            <div class="preview-test-exercise-content" id="${exerciseContainerId}">
            </div>
            ${scoringHtml}
        `;
        
        container.appendChild(card);
        
        const contentContainer = document.getElementById(exerciseContainerId);
        if (contentContainer) {
            if (currentUserRole === 'student') {
                if (exercise.type === 'matching') {
                    renderStudentMatchingForTest(exercise.data, exerciseContainerId);
                } else if (exercise.type === 'choice') {
                    renderStudentChoiceForTest(exercise.data, exerciseContainerId);
                } else if (exercise.type === 'fill_blanks') {
                    renderStudentFillBlanksForTest(exercise.data, exerciseContainerId);
                }
            } else {
                if (exercise.type === 'matching') {
                    contentContainer.innerHTML = renderPreviewTestMatchingContent(exercise.data);
                } else if (exercise.type === 'choice') {
                    contentContainer.innerHTML = renderPreviewTestChoiceContent(exercise.data);
                } else if (exercise.type === 'fill_blanks') {
                    contentContainer.innerHTML = renderPreviewTestFillBlanksContent(exercise.data);
                }
            }
        }
    });
}

function renderPreviewTestMatchingContent(data) {
    const items = data?.items || [];
    const targets = data?.targets || [];
    const pairs = data?.pairs || [];
    const taskText = data?.question_text || 'Сопоставьте каждый элемент с его сопоставлением.';
    
    let itemsHtml = items.length === 0 ? '<div class="empty-message">Нет элементов</div>' : 
        items.map((item, idx) => `
            <div class="preview-item-row">
                <div class="item-number-preview">${idx + 1}.</div>
                <div class="item-text-preview">${escapeHtml(item.text)}</div>
            </div>
        `).join('');
    
    let targetsHtml = targets.length === 0 ? '<div class="empty-message">Нет элементов сопоставления</div>' : 
        targets.map((target, idx) => `
            <div class="preview-target-row">
                <div class="target-letter-preview">${String.fromCharCode(65 + idx)}.</div>
                <div class="target-text-preview">${escapeHtml(target.text)}</div>
            </div>
        `).join('');
    
    let rowsHtml = targets.length === 0 ? '<div class="empty-message">Добавьте элементы сопоставления</div>' : 
        targets.map((target, idx) => {
            const pair = pairs.find(p => p.targetId == target.id);
            const item = items.find(i => i.id == pair?.itemId);
            const itemText = item ? `${items.findIndex(i => i.id == item.id) + 1}. ${item.text}` : '—';
            return `
                <div class="matching-row-preview">
                    <div class="matching-cell-preview">
                        <div class="matching-item-text">${escapeHtml(itemText)}</div>
                    </div>
                    <div class="matching-cell-preview">
                        <div class="matching-target-text-preview">
                            <strong>${String.fromCharCode(65 + idx)}.</strong> ${escapeHtml(target.text)}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    
    return `
        <div class="task-description">
            <label>Задача:</label>
            <div class="task-text">${escapeHtml(taskText)}</div>
        </div>
        <div class="two-columns">
            <div class="left-column">
                <div class="column-header">Элементы</div>
                <div class="items-list-preview">${itemsHtml}</div>
            </div>
            <div class="right-column">
                <div class="column-header">Элементы сопоставления</div>
                <div class="targets-list-preview">${targetsHtml}</div>
            </div>
        </div>
        <div class="matching-table-section">
            <div class="table-label">Таблица сопоставления</div>
            <div class="matching-table">
                <div class="table-header">
                    <div class="table-header-cell">Элемент</div>
                    <div class="table-header-cell">Сопоставление</div>
                </div>
                <div class="matching-rows">${rowsHtml}</div>
            </div>
        </div>
    `;
}

function renderPreviewTestChoiceContent(data) {
    const statements = data?.statements || [];
    const taskText = data?.question_text || 'Сопоставьте каждое утверждение с правильным ответом (правильных ответов может быть несколько).';
    
    let statementsHtml = statements.length === 0 ? '<div class="empty-message">Нет утверждений</div>' : 
        statements.map((statement, stmtIdx) => `
            <div class="preview-statement-card">
                <div class="preview-statement-header">
                    <div class="statement-number-preview">${stmtIdx + 1}.</div>
                    <div class="statement-text-preview">${escapeHtml(statement.text)}</div>
                </div>
                <div class="preview-answers-section">
                    <div class="answers-header">Ответы (правильных может быть несколько):</div>
                    <div class="preview-answers-list">
                        ${(statement.answers || []).map((answer, ansIdx) => `
                            <div class="preview-answer-row">
                                <div class="radio-indicator ${answer.isCorrect ? 'correct' : ''}"></div>
                                <div class="answer-number-preview">${String.fromCharCode(65 + ansIdx)}.</div>
                                <div class="answer-text-preview">${escapeHtml(answer.text)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    
    return `
        <div class="task-description">
            <label>Задача:</label>
            <div class="task-text">${escapeHtml(taskText)}</div>
        </div>
        <div class="statements-section">
            <div class="section-header">Утверждения</div>
            <div class="statements-list-preview">${statementsHtml}</div>
        </div>
    `;
}

function renderPreviewTestFillBlanksContent(data) {
    const words = data?.words || [];
    const sentences = data?.sentences || [];
    const taskText = data?.question_text || 'Вставьте подходящее по смыслу слово в каждое предложение.';
    
    let wordsHtml = words.length === 0 ? '<div class="empty-message">Нет слов для справки</div>' : 
        words.map(word => `<span class="preview-word-chip">${escapeHtml(word.text)}</span>`).join('');
    
    let sentencesHtml = sentences.length === 0 ? '<div class="empty-message">Нет предложений</div>' : 
        sentences.map((sentence, idx) => {
            let textWithBlanks = sentence.text || '';
            const blanks = sentence.correctAnswers || [];
            
            let blankIndex = 0;
            textWithBlanks = textWithBlanks.replace(/_______/g, () => {
                const answer = blanks[blankIndex] || '???';
                blankIndex++;
                return `<span class="blank-placeholder">[${escapeHtml(answer)}]</span>`;
            });
            
            return `
                <div class="preview-sentence-card">
                    <div class="sentence-header-preview">
                        <div class="sentence-number-preview">Предложение ${idx + 1}</div>
                    </div>
                    <div class="sentence-text-preview">${textWithBlanks}</div>
                    <div class="blanks-section-preview">
                        <div class="blanks-title">Правильные ответы:</div>
                        <div class="preview-blanks-list">
                            ${blanks.map((answer, blankIdx) => `
                                <div class="preview-blank-row">
                                    <div class="blank-number-preview">Пропуск ${blankIdx + 1}:</div>
                                    <div class="blank-answer-preview">${escapeHtml(answer)}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    
    return `
        <div class="task-description">
            <label>Задача:</label>
            <div class="task-text">${escapeHtml(taskText)}</div>
        </div>
        <div class="words-section">
            <div class="section-header">Слова для справки:</div>
            <div class="words-list-preview">${wordsHtml}</div>
        </div>
        <div class="sentences-section">
            <div class="sentences-list-preview">${sentencesHtml}</div>
        </div>
    `;
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

function backToSections() {
    const theoryPreviewContainer = document.getElementById('theoryPreviewContainer');
    const exercisePreviewContainer = document.getElementById('exercisePreviewContainer');
    const testPreviewContainer = document.getElementById('testPreviewContainer');
    const sectionsAreaEl = document.getElementById('sectionsArea');
    const welcomeScreenEl = document.getElementById('welcomeScreen');
    
    if (theoryPreviewContainer) theoryPreviewContainer.style.display = 'none';
    if (exercisePreviewContainer) exercisePreviewContainer.style.display = 'none';
    if (testPreviewContainer) testPreviewContainer.style.display = 'none';
    
    document.getElementById('theoryNextStep').style.display = 'none';
    document.getElementById('exerciseNextStep').style.display = 'none';
    document.getElementById('testNextStep').style.display = 'none';
    
    if (currentBlock && sectionsAreaEl) {
        sectionsAreaEl.style.display = 'block';
        welcomeScreenEl.style.display = 'none';
        
        currentBlockTitle.textContent = currentBlock.title;
        currentBlockDescription.textContent = currentBlock.description;
        
        renderSections(currentSections);
        
        updateActiveBlockInSidebar(currentBlock.id);
        
        const newUrl = `/teacher/course-constructor-preview?courseId=${courseId}&blockId=${currentBlock.id}&themeId=${themeId}`;
        window.history.pushState({}, '', newUrl);
        
    } else if (welcomeScreenEl) {
        welcomeScreenEl.style.display = 'flex';
        sectionsAreaEl.style.display = 'none';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== НАВИГАЦИЯ "СЛЕДУЮЩИЙ ШАГ" =====

function getAllSectionsInOrder() {
    const sectionsList = [];
    
    if (!currentCourse || !currentCourse.themes) return sectionsList;
    
    const sortedThemes = [...currentCourse.themes].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    
    for (const theme of sortedThemes) {
        const sortedBlocks = (theme.blocks || []).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
        
        for (const block of sortedBlocks) {
            const sortedSections = (block.sections || []).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
            
            for (const section of sortedSections) {
                sectionsList.push({
                    sectionId: section.id,
                    sectionType: section.type,
                    blockId: block.id,
                    blockTitle: block.title,
                    blockDescription: block.description || '',
                    themeId: theme.id,
                    themeTitle: theme.title
                });
            }
        }
    }
    
    return sectionsList;
}

function findNextSection(currentSectionId) {
    const allSections = getAllSectionsInOrder();
    const currentIndex = allSections.findIndex(s => s.sectionId === currentSectionId);
    
    if (currentIndex !== -1 && currentIndex < allSections.length - 1) {
        return allSections[currentIndex + 1];
    }
    
    return null;
}

function navigateToNextSection() {
    let currentSectionId = null;
    
    if (document.getElementById('theoryPreviewContainer').style.display === 'block') {
        currentSectionId = currentEditingTheorySection?.id;
    } else if (document.getElementById('exercisePreviewContainer').style.display === 'block') {
        currentSectionId = currentEditingExerciseSection?.id;
    } else if (document.getElementById('testPreviewContainer').style.display === 'block') {
        currentSectionId = currentEditingExerciseSection?.id;
    }
    
    if (!currentSectionId) return;
    
    const nextSection = findNextSection(currentSectionId);
    
    if (nextSection) {
        const theoryPreviewContainer = document.getElementById('theoryPreviewContainer');
        const exercisePreviewContainer = document.getElementById('exercisePreviewContainer');
        const testPreviewContainer = document.getElementById('testPreviewContainer');
        
        if (theoryPreviewContainer) theoryPreviewContainer.style.display = 'none';
        if (exercisePreviewContainer) exercisePreviewContainer.style.display = 'none';
        if (testPreviewContainer) testPreviewContainer.style.display = 'none';
        
        document.getElementById('theoryNextStep').style.display = 'none';
        document.getElementById('exerciseNextStep').style.display = 'none';
        document.getElementById('testNextStep').style.display = 'none';
        
        currentBlock = {
            id: nextSection.blockId,
            title: nextSection.blockTitle,
            description: nextSection.blockDescription
        };
        
        currentBlockTitle.textContent = currentBlock.title;
        currentBlockDescription.textContent = currentBlock.description;
        
        expandParentTheme(nextSection.blockId);
        updateActiveBlockInSidebar(nextSection.blockId);
        
        loadBlockSections(nextSection.blockId, nextSection.blockTitle, nextSection.blockDescription)
            .then(() => {
                if (nextSection.sectionType === 'theory') {
                    loadTheorySection(nextSection.sectionId);
                } else if (nextSection.sectionType === 'exercise') {
                    loadExerciseSection(nextSection.sectionId);
                } else if (nextSection.sectionType === 'test') {
                    loadTestSection(nextSection.sectionId);
                }
            });
        
        const newUrl = `/teacher/course-constructor-preview?courseId=${courseId}&blockId=${nextSection.blockId}&themeId=${nextSection.themeId}`;
        window.history.pushState({}, '', newUrl);
    }
}

function updateNextStepButton(sectionId) {
    const nextSection = findNextSection(sectionId);
    const hasNext = nextSection !== null;
    
    document.getElementById('theoryNextStep').style.display = 'none';
    document.getElementById('exerciseNextStep').style.display = 'none';
    document.getElementById('testNextStep').style.display = 'none';
    
    let activeContainer = null;
    if (document.getElementById('theoryPreviewContainer').style.display === 'block') {
        activeContainer = 'theory';
    } else if (document.getElementById('exercisePreviewContainer').style.display === 'block') {
        activeContainer = 'exercise';
    } else if (document.getElementById('testPreviewContainer').style.display === 'block') {
        activeContainer = 'test';
    }
    
    if (!activeContainer) return;
    
    if (currentUserRole === 'teacher') {
        if (hasNext) {
            document.getElementById(`${activeContainer}NextStep`).style.display = 'flex';
        }
    } else if (currentUserRole === 'student') {
        document.getElementById(`${activeContainer}NextStep`).style.display = 'flex';
    }
}

function initButtonsByRole() {
    if (currentUserRole === 'teacher') {
        document.querySelectorAll('.next-step-btn').forEach(btn => {
            btn.style.display = 'flex';
        });
        document.querySelectorAll('.submit-solution-btn').forEach(btn => {
            btn.style.display = 'none';
        });
        
        document.getElementById('theoryNextBtn')?.addEventListener('click', navigateToNextSection);
        document.getElementById('exerciseNextBtn')?.addEventListener('click', navigateToNextSection);
        document.getElementById('testNextBtn')?.addEventListener('click', navigateToNextSection);
    } 
    // В функции initButtonsByRole, для студента:
    else if (currentUserRole === 'student') {
        document.querySelectorAll('.next-step-btn').forEach(btn => {
            btn.style.display = 'none';
        });
        document.querySelectorAll('.submit-solution-btn').forEach(btn => {
            btn.style.display = 'flex';
        });
        
        // Обработчик для упражнений с валидацией
        document.getElementById('exerciseSubmitBtn')?.addEventListener('click', async () => {
            const isValid = validateCurrentExercise();
            if (isValid) {
                showNotification('Решение отправлено на проверку', 'success');
            }
        });
        
        // Обработчик для теста с валидацией
        document.getElementById('testSubmitBtn')?.addEventListener('click', async () => {
            const isValid = validateCurrentTest();
            if (isValid) {
                showNotification('Тест отправлен на проверку', 'success');
            }
        });
        
        document.getElementById('theoryNextBtn')?.addEventListener('click', navigateToNextSection);
    }
}

// ===== ИНТЕРАКТИВНЫЕ ФУНКЦИИ ДЛЯ СТУДЕНТА =====

function renderStudentMatching(exerciseData, containerId) {
    const items = exerciseData.left_column || [];
    const targets = exerciseData.right_column || [];
    const taskText = exerciseData.question_text || 'Сопоставьте каждый элемент с его сопоставлением.';
    
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let html = `
        <div class="task-description">
            <label>Задача:</label>
            <div class="task-text">${escapeHtml(taskText)}</div>
        </div>
        
        <div class="two-columns">
            <div class="left-column">
                <div class="column-header">
                    <span>Элементы</span>
                </div>
                <div class="items-list-preview">
                    ${items.map((item, idx) => `
                        <div class="preview-item-row">
                            <div class="item-number-preview">${idx + 1}.</div>
                            <div class="item-text-preview">${escapeHtml(item.text)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="right-column">
                <div class="column-header">
                    <span>Элементы сопоставления</span>
                </div>
                <div class="targets-list-preview">
                    ${targets.map((target, idx) => `
                        <div class="preview-target-row">
                            <div class="target-letter-preview">${String.fromCharCode(65 + idx)}.</div>
                            <div class="target-text-preview">${escapeHtml(target.text)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        
        <div class="matching-table-section">
            <div class="table-label">Таблица сопоставления</div>
            <div class="matching-table">
                <div class="table-header">
                    <div class="table-header-cell">Элементы</div>
                    <div class="table-header-cell">Элементы сопоставления</div>
                </div>
                <div class="matching-rows">
                    ${items.map((item, idx) => `
                        <div class="matching-row-preview" data-item-id="${item.id}">
                            <div class="matching-cell-preview">
                                <div class="matching-item-text">${idx + 1}. ${escapeHtml(item.text)}</div>
                            </div>
                            <div class="matching-cell-preview">
                                <div class="matching-select-wrapper" data-item-id="${item.id}">
                                    <button class="matching-select-btn" data-item-id="${item.id}">
                                        <span class="selected-text">-- выберите элемент --</span>
                                        <img src="/images/taskCreationPage/chevronDown.svg" alt="toggle" class="select-chevron">
                                    </button>
                                    <div class="matching-select-menu" style="display: none;">
                                        <button class="matching-select-option" data-value="">-- выберите элемент --</button>
                                        ${targets.map((target, targetIdx) => `
                                            <button class="matching-select-option" data-value="${target.id}">
                                                ${String.fromCharCode(65 + targetIdx)}. ${escapeHtml(target.text)}
                                            </button>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    function closeAllMenus() {
        container.querySelectorAll('.matching-select-menu').forEach(menu => {
            menu.style.display = 'none';
        });
        container.querySelectorAll('.matching-select-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        container.querySelectorAll('.matching-select-wrapper').forEach(wrapper => {
            wrapper.style.zIndex = '';
        });
    }
    
    container.querySelectorAll('.matching-select-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wrapper = btn.closest('.matching-select-wrapper');
            const menu = wrapper.querySelector('.matching-select-menu');
            const isOpen = menu.style.display === 'block';
            
            closeAllMenus();
            
            if (!isOpen) {
                menu.style.display = 'block';
                btn.classList.add('active');
                wrapper.style.zIndex = '10000';
            }
        });
    });
    
    container.querySelectorAll('.matching-select-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = option.textContent;
            const wrapper = option.closest('.matching-select-wrapper');
            const btn = wrapper.querySelector('.matching-select-btn');
            const menu = wrapper.querySelector('.matching-select-menu');
            
            btn.querySelector('.selected-text').textContent = text;
            menu.style.display = 'none';
            btn.classList.remove('active');
            wrapper.style.zIndex = '';
            
            wrapper.querySelectorAll('.matching-select-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            option.classList.add('selected');
        });
    });
    
    document.addEventListener('click', closeAllMenus);
}

function renderStudentChoice(exerciseData, containerId) {
    const statements = exerciseData.options || [];
    const taskText = exerciseData.question_text || 'Сопоставьте каждое утверждение с правильным ответом (правильных ответов может быть несколько).';
    
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let html = `
        <div class="task-description">
            <label>Задача:</label>
            <div class="task-text">${escapeHtml(taskText)}</div>
        </div>
        <div class="statements-section">
            <div class="section-header">Утверждения</div>
            <div class="statements-list-preview">
                ${statements.map((statement, stmtIdx) => `
                    <div class="preview-statement-card" data-statement-id="${statement.id}">
                        <div class="preview-statement-header">
                            <div class="statement-number-preview">${stmtIdx + 1}.</div>
                            <div class="statement-text-preview">${escapeHtml(statement.text)}</div>
                        </div>
                        <div class="preview-answers-section">
                            <div class="answers-header">Выберите правильные ответы (можно несколько):</div>
                            <div class="preview-answers-list">
                                ${(statement.answers || []).map((answer, ansIdx) => `
                                    <div class="preview-answer-row" data-answer-id="${answer.id}">
                                        <div class="checkbox-student" data-statement-id="${statement.id}" data-answer-id="${answer.id}"></div>
                                        <div class="answer-number-preview">${String.fromCharCode(65 + ansIdx)}.</div>
                                        <div class="answer-text-preview">${escapeHtml(answer.text)}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    container.querySelectorAll('.checkbox-student').forEach(checkbox => {
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            checkbox.classList.toggle('selected');
        });
    });
}

function renderStudentFillBlanks(exerciseData, containerId) {
    const words = exerciseData.options?.words || [];
    const sentences = exerciseData.options?.sentences || [];
    const taskText = exerciseData.question_text || 'Вставьте подходящее по смыслу слово в каждое предложение.';
    
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let html = `
        <div class="task-description">
            <label>Задача:</label>
            <div class="task-text">${escapeHtml(taskText)}</div>
        </div>
        
        <div class="words-section">
            <div class="section-header">Слова для справки:</div>
            <div class="words-list-preview">
                ${words.map(word => `
                    <span class="preview-word-chip">${escapeHtml(word.text)}</span>
                `).join('')}
            </div>
        </div>
        
        <div class="sentences-section">
            <div class="sentences-list-preview">
                ${sentences.map((sentence, idx) => {
                    let textWithBlanks = sentence.text || '';
                    const blanks = sentence.correctAnswers || [];
                    const blankWords = [...words];
                    
                    let blankIndex = 0;
                    textWithBlanks = textWithBlanks.replace(/_______/g, () => {
                        blankIndex++;
                        return `<div class="fillblanks-select-wrapper" data-blank-index="${blankIndex - 1}" style="display: inline-block; min-width: 140px; margin: 0 4px; vertical-align: middle;">
                                    <button class="fillblanks-select-btn">
                                        <span class="selected-text">-- выберите слово --</span>
                                        <img src="/images/taskCreationPage/chevronDown.svg" alt="toggle" class="select-chevron">
                                    </button>
                                    <div class="fillblanks-select-menu" style="display: none;">
                                        <button class="fillblanks-select-option" data-value="">-- выберите слово --</button>
                                        ${blankWords.map(word => `
                                            <button class="fillblanks-select-option" data-value="${escapeHtml(word.text)}">
                                                ${escapeHtml(word.text)}
                                            </button>
                                        `).join('')}
                                    </div>
                                </div>`;
                    });
                    
                    return `
                        <div class="preview-sentence-card" data-sentence-id="${sentence.id}">
                            <div class="sentence-header-preview">
                                <div class="sentence-number-preview">Предложение ${idx + 1}</div>
                            </div>
                            <div class="sentence-text-preview">${textWithBlanks}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    container.querySelectorAll('.fillblanks-select-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wrapper = btn.closest('.fillblanks-select-wrapper');
            const menu = wrapper.querySelector('.fillblanks-select-menu');
            const isOpen = menu.style.display === 'block';
            
            document.querySelectorAll('.fillblanks-select-menu').forEach(m => {
                m.style.display = 'none';
            });
            document.querySelectorAll('.fillblanks-select-btn').forEach(b => {
                b.classList.remove('active');
            });
            
            if (!isOpen) {
                menu.style.display = 'block';
                btn.classList.add('active');
            }
        });
    });
    
    container.querySelectorAll('.fillblanks-select-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const value = option.dataset.value;
            const text = option.textContent;
            const wrapper = option.closest('.fillblanks-select-wrapper');
            const btn = wrapper.querySelector('.fillblanks-select-btn');
            const menu = wrapper.querySelector('.fillblanks-select-menu');
            
            btn.querySelector('.selected-text').textContent = text;
            menu.style.display = 'none';
            btn.classList.remove('active');
            
            wrapper.querySelectorAll('.fillblanks-select-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            option.classList.add('selected');
        });
    });
}

// ===== ФУНКЦИИ ДЛЯ ТЕСТА =====

function renderStudentMatchingForTest(exerciseData, containerId) {
    const items = exerciseData.items || [];
    const targets = exerciseData.targets || [];
    const taskText = exerciseData.question_text || 'Сопоставьте каждый элемент с его сопоставлением.';
    
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let html = `
        <div class="task-description">
            <label>Задача:</label>
            <div class="task-text">${escapeHtml(taskText)}</div>
        </div>
        
        <div class="two-columns">
            <div class="left-column">
                <div class="column-header">
                    <span>Элементы</span>
                </div>
                <div class="items-list-preview">
                    ${items.map((item, idx) => `
                        <div class="preview-item-row">
                            <div class="item-number-preview">${idx + 1}.</div>
                            <div class="item-text-preview">${escapeHtml(item.text)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="right-column">
                <div class="column-header">
                    <span>Элементы сопоставления</span>
                </div>
                <div class="targets-list-preview">
                    ${targets.map((target, idx) => `
                        <div class="preview-target-row">
                            <div class="target-letter-preview">${String.fromCharCode(65 + idx)}.</div>
                            <div class="target-text-preview">${escapeHtml(target.text)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        
        <div class="matching-table-section">
            <div class="table-label">Таблица сопоставления</div>
            <div class="matching-table">
                <div class="table-header">
                    <div class="table-header-cell">Элементы</div>
                    <div class="table-header-cell">Элементы сопоставления</div>
                </div>
                <div class="matching-rows">
                    ${items.map((item, idx) => `
                        <div class="matching-row-preview" data-item-id="${item.id}">
                            <div class="matching-cell-preview">
                                <div class="matching-item-text">${idx + 1}. ${escapeHtml(item.text)}</div>
                            </div>
                            <div class="matching-cell-preview">
                                <div class="matching-select-wrapper" data-item-id="${item.id}">
                                    <button class="matching-select-btn" data-item-id="${item.id}">
                                        <span class="selected-text">-- выберите элемент --</span>
                                        <img src="/images/taskCreationPage/chevronDown.svg" alt="toggle" class="select-chevron">
                                    </button>
                                    <div class="matching-select-menu" style="display: none;">
                                        <button class="matching-select-option" data-value="">-- выберите элемент --</button>
                                        ${targets.map((target, targetIdx) => `
                                            <button class="matching-select-option" data-value="${target.id}">
                                                ${String.fromCharCode(65 + targetIdx)}. ${escapeHtml(target.text)}
                                            </button>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    function closeAllMenus() {
        container.querySelectorAll('.matching-select-menu').forEach(menu => {
            menu.style.display = 'none';
        });
        container.querySelectorAll('.matching-select-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        container.querySelectorAll('.matching-select-wrapper').forEach(wrapper => {
            wrapper.style.zIndex = '';
        });
    }
    
    container.querySelectorAll('.matching-select-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wrapper = btn.closest('.matching-select-wrapper');
            const menu = wrapper.querySelector('.matching-select-menu');
            const isOpen = menu.style.display === 'block';
            
            closeAllMenus();
            
            if (!isOpen) {
                menu.style.display = 'block';
                btn.classList.add('active');
                wrapper.style.zIndex = '10000';
            }
        });
    });
    
    container.querySelectorAll('.matching-select-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = option.textContent;
            const wrapper = option.closest('.matching-select-wrapper');
            const btn = wrapper.querySelector('.matching-select-btn');
            const menu = wrapper.querySelector('.matching-select-menu');
            
            btn.querySelector('.selected-text').textContent = text;
            menu.style.display = 'none';
            btn.classList.remove('active');
            wrapper.style.zIndex = '';
            
            wrapper.querySelectorAll('.matching-select-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            option.classList.add('selected');
        });
    });
    
    document.addEventListener('click', closeAllMenus);
}

function renderStudentChoiceForTest(exerciseData, containerId) {
    const statements = exerciseData.statements || [];
    const taskText = exerciseData.question_text || 'Сопоставьте каждое утверждение с правильным ответом (правильных ответов может быть несколько).';
    
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let html = `
        <div class="task-description">
            <label>Задача:</label>
            <div class="task-text">${escapeHtml(taskText)}</div>
        </div>
        <div class="statements-section">
            <div class="section-header">Утверждения</div>
            <div class="statements-list-preview">
                ${statements.map((statement, stmtIdx) => `
                    <div class="preview-statement-card" data-statement-id="${statement.id}">
                        <div class="preview-statement-header">
                            <div class="statement-number-preview">${stmtIdx + 1}.</div>
                            <div class="statement-text-preview">${escapeHtml(statement.text)}</div>
                        </div>
                        <div class="preview-answers-section">
                            <div class="answers-header">Выберите правильные ответы (можно несколько):</div>
                            <div class="preview-answers-list">
                                ${(statement.answers || []).map((answer, ansIdx) => `
                                    <div class="preview-answer-row" data-answer-id="${answer.id}">
                                        <div class="checkbox-student" data-statement-id="${statement.id}" data-answer-id="${answer.id}"></div>
                                        <div class="answer-number-preview">${String.fromCharCode(65 + ansIdx)}.</div>
                                        <div class="answer-text-preview">${escapeHtml(answer.text)}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    container.querySelectorAll('.checkbox-student').forEach(checkbox => {
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            checkbox.classList.toggle('selected');
        });
    });
}

function renderStudentFillBlanksForTest(exerciseData, containerId) {
    const words = exerciseData.words || [];
    const sentences = exerciseData.sentences || [];
    const taskText = exerciseData.question_text || 'Вставьте подходящее по смыслу слово в каждое предложение.';
    
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let html = `
        <div class="task-description">
            <label>Задача:</label>
            <div class="task-text">${escapeHtml(taskText)}</div>
        </div>
        
        <div class="words-section">
            <div class="section-header">Слова для справки:</div>
            <div class="words-list-preview">
                ${words.map(word => `
                    <span class="preview-word-chip">${escapeHtml(word.text)}</span>
                `).join('')}
            </div>
        </div>
        
        <div class="sentences-section">
            <div class="sentences-list-preview">
                ${sentences.map((sentence, idx) => {
                    let textWithBlanks = sentence.text || '';
                    const blanks = sentence.correctAnswers || [];
                    const blankWords = [...words];
                    
                    let blankIndex = 0;
                    textWithBlanks = textWithBlanks.replace(/_______/g, () => {
                        blankIndex++;
                        return `<div class="fillblanks-select-wrapper" data-blank-index="${blankIndex - 1}" style="display: inline-block; min-width: 140px; margin: 0 4px; vertical-align: middle;">
                                    <button class="fillblanks-select-btn">
                                        <span class="selected-text">-- выберите слово --</span>
                                        <img src="/images/taskCreationPage/chevronDown.svg" alt="toggle" class="select-chevron">
                                    </button>
                                    <div class="fillblanks-select-menu" style="display: none;">
                                        <button class="fillblanks-select-option" data-value="">-- выберите слово --</button>
                                        ${blankWords.map(word => `
                                            <button class="fillblanks-select-option" data-value="${escapeHtml(word.text)}">
                                                ${escapeHtml(word.text)}
                                            </button>
                                        `).join('')}
                                    </div>
                                </div>`;
                    });
                    
                    return `
                        <div class="preview-sentence-card" data-sentence-id="${sentence.id}">
                            <div class="sentence-header-preview">
                                <div class="sentence-number-preview">Предложение ${idx + 1}</div>
                            </div>
                            <div class="sentence-text-preview">${textWithBlanks}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    container.querySelectorAll('.fillblanks-select-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wrapper = btn.closest('.fillblanks-select-wrapper');
            const menu = wrapper.querySelector('.fillblanks-select-menu');
            const isOpen = menu.style.display === 'block';
            
            document.querySelectorAll('.fillblanks-select-menu').forEach(m => {
                m.style.display = 'none';
            });
            document.querySelectorAll('.fillblanks-select-btn').forEach(b => {
                b.classList.remove('active');
            });
            
            if (!isOpen) {
                menu.style.display = 'block';
                btn.classList.add('active');
            }
        });
    });
    
    container.querySelectorAll('.fillblanks-select-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const value = option.dataset.value;
            const text = option.textContent;
            const wrapper = option.closest('.fillblanks-select-wrapper');
            const btn = wrapper.querySelector('.fillblanks-select-btn');
            const menu = wrapper.querySelector('.fillblanks-select-menu');
            
            btn.querySelector('.selected-text').textContent = text;
            menu.style.display = 'none';
            btn.classList.remove('active');
            
            wrapper.querySelectorAll('.fillblanks-select-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            option.classList.add('selected');
        });
    });
}

// Сохранение прогресса теории
async function markTheoryAsCompleted(sectionId) {
    try {
        const token = getToken();
        const response = await fetch(`${apiBaseUrl}/student/progress/theory`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ sectionId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Получаем название раздела
            const sectionTitle = currentEditingTheorySection?.title || 'Раздел теории';
            showNotification(`${sectionTitle} пройдено`, 'success');
        }
        
        return data.success;
    } catch (error) {
        console.error('Ошибка сохранения прогресса теории:', error);
        return false;
    }
}

// Проверка статуса теории
async function checkTheoryStatus(sectionId) {
    try {
        const token = getToken();
        const response = await fetch(`${apiBaseUrl}/student/progress/theory/${sectionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        return data.completed || false;
    } catch (error) {
        console.error('Ошибка проверки статуса теории:', error);
        return false;
    }
}

function updateTheoryButtonState(sectionId, isCompleted) {
    const theoryNextStep = document.getElementById('theoryNextStep');
    if (!theoryNextStep) return;
    
    const theorySubmitBtn = document.getElementById('theorySubmitBtn');
    const theoryNextBtn = document.getElementById('theoryNextBtn');
    
    if (isCompleted) {
        // Теория пройдена - показываем кнопку "Следующий шаг"
        if (theorySubmitBtn) theorySubmitBtn.style.display = 'none';
        if (theoryNextBtn) {
            theoryNextBtn.style.display = 'flex';
            // Меняем стиль кнопки на фиолетовый
            theoryNextBtn.style.background = '#7651BE';
            const arrowIcon = theoryNextBtn.querySelector('.next-arrow-icon');
            if (arrowIcon) arrowIcon.style.filter = 'brightness(0) invert(1)';
        }
        theoryNextStep.style.display = 'flex';
    } else {
        // Теория не пройдена - показываем кнопку "Отметить пройденным"
        if (theorySubmitBtn) {
            theorySubmitBtn.style.display = 'flex';
            // Убираем старый обработчик и добавляем новый
            const newSubmitBtn = theorySubmitBtn.cloneNode(true);
            theorySubmitBtn.parentNode.replaceChild(newSubmitBtn, theorySubmitBtn);
            newSubmitBtn.addEventListener('click', async () => {
                const success = await markTheoryAsCompleted(sectionId);
                if (success) {
                    updateTheoryButtonState(sectionId, true);
                    // Уведомление уже показывается в markTheoryAsCompleted
                } else {
                    showNotification('Ошибка при сохранении прогресса', 'error');
                }
            });
        }
        if (theoryNextBtn) theoryNextBtn.style.display = 'none';
        theoryNextStep.style.display = 'flex';
    }
}

// Валидация текущего упражнения
function validateCurrentExercise() {
    const exerciseType = currentEditingExerciseSection?.type;
    if (exerciseType !== 'exercise') return true;
    
    const exerciseData = currentEditingExerciseSection?.exercise || {};
    const exerciseTypeName = exerciseData.exercise_type || 'matching';
    
    // Очищаем предыдущие подсветки
    clearCurrentExerciseHighlights();
    
    if (exerciseTypeName === 'matching') {
        const selectWrappers = document.querySelectorAll('#matchingExercisePreview .matching-select-wrapper');
        let allSelected = true;
        let emptyCount = 0;
        
        selectWrappers.forEach((wrapper, idx) => {
            const selectedText = wrapper.querySelector('.selected-text')?.textContent || '';
            if (selectedText === '-- выберите элемент --') {
                allSelected = false;
                emptyCount++;
                const btn = wrapper.querySelector('.matching-select-btn');
                btn.classList.add('error-highlight');
            }
        });
        
        if (!allSelected) {
            setTimeout(() => clearCurrentExerciseHighlights(), 3000);
            showNotification(`Пожалуйста, заполните все поля сопоставления (${emptyCount} пропущено)`, 'warning');
            return false;
        }
        return true;
    }
    
    else if (exerciseTypeName === 'choice') {
        const statementCards = document.querySelectorAll('#choiceExercisePreview .preview-statement-card');
        let allHaveSelection = true;
        let emptyStatements = [];
        
        statementCards.forEach((card, idx) => {
            const selectedCheckboxes = card.querySelectorAll('.checkbox-student.selected');
            if (selectedCheckboxes.length === 0) {
                allHaveSelection = false;
                emptyStatements.push(idx + 1);
                const answersSection = card.querySelector('.preview-answers-section');
                answersSection.classList.add('error-highlight');
            }
        });
        
        if (!allHaveSelection) {
            setTimeout(() => clearCurrentExerciseHighlights(), 3000);
            const statementNumbers = emptyStatements.join(', ');
            showNotification(`Пожалуйста, выберите ответ(ы) для утверждений: ${statementNumbers}`, 'warning');
            return false;
        }
        return true;
    }
    
    else if (exerciseTypeName === 'fill_blanks') {
        const selectWrappers = document.querySelectorAll('#fillBlanksExercisePreview .fillblanks-select-wrapper');
        let allSelected = true;
        let emptyCount = 0;
        
        selectWrappers.forEach((wrapper, idx) => {
            const selectedText = wrapper.querySelector('.selected-text')?.textContent || '';
            if (selectedText === '-- выберите слово --') {
                allSelected = false;
                emptyCount++;
                const btn = wrapper.querySelector('.fillblanks-select-btn');
                btn.classList.add('error-highlight');
            }
        });
        
        if (!allSelected) {
            setTimeout(() => clearCurrentExerciseHighlights(), 3000);
            showNotification(`Пожалуйста, заполните все пропуски (${emptyCount} пропущено)`, 'warning');
            return false;
        }
        return true;
    }
    
    return true;
}

// Очистка подсветок текущего упражнения
function clearCurrentExerciseHighlights() {
    // Для сопоставления
    document.querySelectorAll('#matchingExercisePreview .matching-select-btn.error-highlight').forEach(el => {
        el.classList.remove('error-highlight');
    });
    // Для выбора правильного
    document.querySelectorAll('#choiceExercisePreview .preview-answers-section.error-highlight').forEach(el => {
        el.classList.remove('error-highlight');
    });
    // Для дополнения
    document.querySelectorAll('#fillBlanksExercisePreview .fillblanks-select-btn.error-highlight').forEach(el => {
        el.classList.remove('error-highlight');
    });
}

// Валидация теста (проверяет все упражнения внутри с точечной подсветкой)
function validateCurrentTest() {
    const exerciseCards = document.querySelectorAll('#previewTestExercisesList .preview-test-exercise-card');
    if (exerciseCards.length === 0) {
        showNotification('В тесте нет упражнений', 'warning');
        return false;
    }
    
    let allValid = true;
    let invalidFields = [];
    
    // Очищаем предыдущие подсветки
    clearAllTestHighlights();
    
    exerciseCards.forEach((card, cardIndex) => {
        const typeText = card.querySelector('.exercise-type-preview')?.textContent || '';
        
        if (typeText === 'Сопоставление') {
            const selectWrappers = card.querySelectorAll('.matching-select-wrapper');
            let hasError = false;
            
            selectWrappers.forEach((wrapper, idx) => {
                const selectedText = wrapper.querySelector('.selected-text')?.textContent || '';
                if (selectedText === '-- выберите элемент --') {
                    hasError = true;
                    allValid = false;
                    // Подсвечиваем только кнопку
                    const btn = wrapper.querySelector('.matching-select-btn');
                    btn.classList.add('error-highlight');
                    invalidFields.push(`упр.${cardIndex + 1} строка ${idx + 1}`);
                }
            });
            
            if (hasError) {
                // Убираем подсветку через 3 секунды
                setTimeout(() => {
                    selectWrappers.forEach(w => {
                        w.querySelector('.matching-select-btn')?.classList.remove('error-highlight');
                    });
                }, 3000);
            }
        }
        else if (typeText === 'Выбор правильного') {
            const statementCards = card.querySelectorAll('.preview-statement-card');
            let hasError = false;
            
            statementCards.forEach((statementCard, stmtIdx) => {
                const selectedCheckboxes = statementCard.querySelectorAll('.checkbox-student.selected');
                if (selectedCheckboxes.length === 0) {
                    hasError = true;
                    allValid = false;
                    // Подсвечиваем всю секцию с ответами
                    const answersSection = statementCard.querySelector('.preview-answers-section');
                    answersSection.classList.add('error-highlight');
                    invalidFields.push(`упр.${cardIndex + 1} утверждение ${stmtIdx + 1}`);
                }
            });
            
            if (hasError) {
                setTimeout(() => {
                    statementCards.forEach(sc => {
                        sc.querySelector('.preview-answers-section')?.classList.remove('error-highlight');
                    });
                }, 3000);
            }
        }
        else if (typeText === 'Дополнение') {
            const selectWrappers = card.querySelectorAll('.fillblanks-select-wrapper');
            let hasError = false;
            
            selectWrappers.forEach((wrapper, idx) => {
                const selectedText = wrapper.querySelector('.selected-text')?.textContent || '';
                if (selectedText === '-- выберите слово --') {
                    hasError = true;
                    allValid = false;
                    // Подсвечиваем кнопку
                    const btn = wrapper.querySelector('.fillblanks-select-btn');
                    btn.classList.add('error-highlight');
                    invalidFields.push(`упр.${cardIndex + 1} пропуск ${idx + 1}`);
                }
            });
            
            if (hasError) {
                setTimeout(() => {
                    selectWrappers.forEach(w => {
                        w.querySelector('.fillblanks-select-btn')?.classList.remove('error-highlight');
                    });
                }, 3000);
            }
        }
    });
    
    if (!allValid) {
        const fieldsList = invalidFields.slice(0, 5).join(', ');
        const more = invalidFields.length > 5 ? ` и ещё ${invalidFields.length - 5}` : '';
        showNotification(`Пожалуйста, заполните все поля: ${fieldsList}${more}`, 'warning');
        return false;
    }
    
    return true;
}

// Очистка всех подсветок в тесте
function clearAllTestHighlights() {
    // Очищаем подсветку сопоставления
    document.querySelectorAll('#previewTestExercisesList .matching-select-btn.error-highlight').forEach(el => {
        el.classList.remove('error-highlight');
    });
    // Очищаем подсветку выбора правильного
    document.querySelectorAll('#previewTestExercisesList .preview-answers-section.error-highlight').forEach(el => {
        el.classList.remove('error-highlight');
    });
    // Очищаем подсветку дополнения
    document.querySelectorAll('#previewTestExercisesList .fillblanks-select-btn.error-highlight').forEach(el => {
        el.classList.remove('error-highlight');
    });
    // Очищаем подсветку карточек
    document.querySelectorAll('#previewTestExercisesList .preview-test-exercise-card.error-highlight').forEach(el => {
        el.classList.remove('error-highlight');
    });
}

// ===== ОБРАБОТЧИКИ СОБЫТИЙ =====

backButton.addEventListener('click', () => {
    window.location.href = `/teacher/course-preview?id=${courseId}`;
});

document.getElementById('backToStructureBtn')?.addEventListener('click', backToSections);
document.getElementById('backToStructureFromExerciseBtn')?.addEventListener('click', backToSections);
document.getElementById('backToStructureFromTestBtn')?.addEventListener('click', backToSections);

// ===== СВОРАЧИВАНИЕ САЙДБАРА =====
const collapseSidebarBtn = document.getElementById('collapseSidebarBtn');
const sidebar = document.querySelector('.sidebar');

function toggleSidebar() {
    const isCollapsed = sidebar.classList.contains('collapsed');
    
    if (isCollapsed) {
        sidebar.classList.remove('collapsed');
        localStorage.setItem('sidebar_collapsed', 'false');
    } else {
        sidebar.classList.add('collapsed');
        localStorage.setItem('sidebar_collapsed', 'true');
    }
    
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 300);
}

if (collapseSidebarBtn) {
    collapseSidebarBtn.addEventListener('click', toggleSidebar);
    
    const savedState = localStorage.getItem('sidebar_collapsed');
    if (savedState === 'true') {
        sidebar.classList.add('collapsed');
    }
    
    setTimeout(() => {
        sidebar.classList.add('initialized');
    }, 10);
}

// ===== ИНИЦИАЛИЗАЦИЯ =====

initQuillPreview();
loadCourseData();

gsap.set('body', { opacity: 0 });
gsap.to('body', { opacity: 1, duration: 0.8, ease: 'power3.out' });
gsap.from('header', { y: -30, opacity: 0, duration: 0.8, delay: 0.2, ease: 'power3.out' });