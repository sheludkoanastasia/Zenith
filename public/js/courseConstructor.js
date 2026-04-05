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
const showCreateMenuBtn = document.getElementById('showCreateMenuBtn');
const createMenu = document.getElementById('createMenu');
const addSectionWrapper = document.getElementById('addSectionWrapper');

const editModal = document.getElementById('editModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const saveModalBtn = document.getElementById('saveModalBtn');

let currentEditingSection = null;

// ===== ДЛЯ РЕДАКТОРА ТЕОРИИ =====
let quillEditor = null;
let hasUnsavedChanges = false;
let currentEditingTheorySection = null;
let originalTheoryText = '';

// ===== ДЛЯ РЕДАКТОРА УПРАЖНЕНИЙ =====
let currentEditingExerciseSection = null;
let originalExerciseData = null;
let currentExerciseType = 'matching';
let hasExerciseUnsavedChanges = false;
let originalExerciseState = null;

// Данные для сопоставления (matching)
let matchingItems = [];
let matchingTargets = [];
let matchingPairs = [];
let nextItemId = 1;
let nextTargetId = 1;

// Данные для выбора правильного (choice)
let choiceStatements = [];
let nextStatementId = 1;
let nextAnswerId = 1;

function getToken() {
    return localStorage.getItem('token');
}

// Проверка наличия несохраненных изменений в теории
function checkUnsavedChanges() {
    if (!quillEditor || !currentEditingTheorySection) return false;
    
    const currentText = quillEditor.root.innerHTML;
    hasUnsavedChanges = currentText !== originalTheoryText;
    return hasUnsavedChanges;
}

// Проверка наличия несохраненных изменений в упражнении
function checkExerciseUnsavedChanges() {
    if (!currentEditingExerciseSection) return false;
    
    if (currentExerciseType === 'matching') {
        const currentState = {
            items: JSON.parse(JSON.stringify(matchingItems)),
            targets: JSON.parse(JSON.stringify(matchingTargets)),
            pairs: JSON.parse(JSON.stringify(matchingPairs)),
            taskText: document.getElementById('matchingTaskText')?.textContent || ''
        };
        
        if (!originalExerciseState || originalExerciseState.type !== 'matching') {
            hasExerciseUnsavedChanges = true;
            return true;
        }
        
        const hasChanges = 
            JSON.stringify(currentState.items) !== JSON.stringify(originalExerciseState.items) ||
            JSON.stringify(currentState.targets) !== JSON.stringify(originalExerciseState.targets) ||
            JSON.stringify(currentState.pairs) !== JSON.stringify(originalExerciseState.pairs) ||
            currentState.taskText !== originalExerciseState.taskText;
        
        hasExerciseUnsavedChanges = hasChanges;
        return hasChanges;
    } 
    else if (currentExerciseType === 'choice') {
        const currentState = {
            statements: JSON.parse(JSON.stringify(choiceStatements)),
            taskText: document.getElementById('choiceTaskText')?.textContent || ''
        };
        
        if (!originalExerciseState || originalExerciseState.type !== 'choice') {
            hasExerciseUnsavedChanges = true;
            return true;
        }
        
        const hasChanges = 
            JSON.stringify(currentState.statements) !== JSON.stringify(originalExerciseState.statements) ||
            currentState.taskText !== originalExerciseState.taskText;
        
        hasExerciseUnsavedChanges = hasChanges;
        return hasChanges;
    }
    
    return false;
}

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
        case 'info': title = 'Информация'; break;
        default: title = 'Успешно';
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
    if (document.getElementById('course-constructor-toast-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'course-constructor-toast-styles';
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

async function loadCourseData() {
    if (!courseId) {
        console.error('ID курса не указан');
        showNotification('ID курса не указан', 'error');
        return;
    }

    try {
        const response = await fetch(`${apiBaseUrl}/courses/${courseId}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (!response.ok) throw new Error('Ошибка загрузки курса');

        const data = await response.json();
        if (data.success) {
            currentCourse = data.course;
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

    themesListEl.innerHTML = themes.map((theme) => {
        const hasActiveBlock = theme.blocks?.some(block => block.id === blockId);
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
                        ${theme.blocks && theme.blocks.length > 0 
                            ? theme.blocks.map((block) => `
                                <div class="block-item-wrapper" data-block-id="${block.id}">
                                    <div class="block-header-wrapper">
                                        <div class="block-item ${blockId === block.id ? 'active' : ''}" 
                                             data-block-id="${block.id}" 
                                             data-block-title="${escapeHtml(block.title)}" 
                                             data-block-description="${escapeHtml(block.description || '')}">
                                            ${escapeHtml(block.title)}
                                        </div>
                                        <button class="block-toggle ${blockId === block.id ? '' : 'collapsed'}" data-block-id="${block.id}">
                                            <img src="/images/taskCreationPage/chevronDown.svg" alt="toggle">
                                        </button>
                                    </div>
                                    <div class="block-sections-list" id="block-sections-${block.id}" style="display: ${blockId === block.id ? 'block' : 'none'};">
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
        
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (container) {
                container.classList.toggle('collapsed');
                toggle.classList.toggle('collapsed');
            }
        });
    });

    document.querySelectorAll('.block-toggle').forEach(toggle => {
        const blockId = toggle.dataset.blockId;
        const sectionsList = document.getElementById(`block-sections-${blockId}`);
        
        toggle.addEventListener('click', (e) => {
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
        });
    });

    document.querySelectorAll('.block-item').forEach(blockEl => {
        blockEl.addEventListener('click', () => {
            const clickedBlockId = blockEl.dataset.blockId;
            const blockTitle = blockEl.dataset.blockTitle;
            const blockDescription = blockEl.dataset.blockDescription;
            
            checkUnsavedChanges();
            checkExerciseUnsavedChanges();
            
            if (hasUnsavedChanges || hasExerciseUnsavedChanges) {
                showUnsavedChangesDialog(
                    'Несохраненные изменения',
                    'У вас есть несохраненные изменения. Перейти к другому блоку?',
                    () => {
                        hideTheoryEditor();
                        hideExerciseEditor();
                        performBlockSwitch(clickedBlockId, blockTitle, blockDescription);
                    }
                );
                return;
            }
            
            hideTheoryEditor();
            hideExerciseEditor();
            performBlockSwitch(clickedBlockId, blockTitle, blockDescription);
        });
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
            
            sectionEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (section) {
                    if (section.type === 'theory') {
                        checkUnsavedChanges();
                        
                        if (hasUnsavedChanges) {
                            showUnsavedChangesDialog(
                                'Несохраненные изменения',
                                'У вас есть несохраненные изменения в текущем разделе. Перейти к другому разделу?',
                                () => {
                                    loadTheorySection(section.id);
                                }
                            );
                        } else {
                            loadTheorySection(section.id);
                        }
                    } else if (section.type === 'exercise') {
                        checkExerciseUnsavedChanges();
                        
                        if (hasExerciseUnsavedChanges) {
                            showUnsavedChangesDialog(
                                'Несохраненные изменения',
                                'У вас есть несохраненные изменения в текущем разделе. Перейти к другому разделу?',
                                () => {
                                    const theoryEditorContainer = document.getElementById('theoryEditorContainer');
                                    if (theoryEditorContainer) theoryEditorContainer.style.display = 'none';
                                    loadExerciseSection(section.id);
                                }
                            );
                        } else {
                            const theoryEditorContainer = document.getElementById('theoryEditorContainer');
                            if (theoryEditorContainer) theoryEditorContainer.style.display = 'none';
                            loadExerciseSection(section.id);
                        }
                    } else {
                        showNotification(`Редактирование "${section.title}" будет реализовано позже`, 'info');
                    }
                }
            });
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
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Не удалось загрузить разделы', 'error');
    }
}

function renderSections(sections) {
    if (!sections || sections.length === 0) {
        sectionsList.innerHTML = `
            <div class="empty-state">
                <p>В этом блоке пока нет разделов</p>
                <p>Нажмите "Создать раздел", чтобы добавить теорию или упражнения</p>
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
                    <div class="section-actions">
                        <button class="edit-section-btn" data-section-id="${section.id}" title="Редактировать название">
                            <img src="/images/taskCreationPage/edit.svg" alt="Редактировать" class="action-icon">
                        </button>
                        <button class="delete-section-btn" data-section-id="${section.id}" title="Удалить">
                            <img src="/images/taskCreationPage/delete.svg" alt="Удалить" class="action-icon">
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.edit-section-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const sectionId = btn.dataset.sectionId;
            const section = currentSections.find(s => s.id === sectionId);
            if (section) openEditModal(section);
        });
    });
    
    document.querySelectorAll('.delete-section-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const sectionId = btn.dataset.sectionId;
            const section = currentSections.find(s => s.id === sectionId);
            if (section) {
                showConfirmDialog('Удаление раздела', `Вы действительно хотите удалить раздел "${section.title}"?`, async () => {
                    await deleteSection(sectionId);
                });
            }
        });
    });
    
    document.querySelectorAll('.section-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.edit-section-btn') || e.target.closest('.delete-section-btn')) return;
            const sectionId = card.dataset.sectionId;
            const section = currentSections.find(s => s.id === sectionId);
            if (section) {
                if (section.type === 'theory') {
                    if (currentEditingTheorySection && currentEditingTheorySection.id === sectionId) {
                        return;
                    }
                    
                    checkUnsavedChanges();
                    
                    if (hasUnsavedChanges) {
                        showUnsavedChangesDialog(
                            'Несохраненные изменения',
                            'У вас есть несохраненные изменения в текущем разделе. Перейти к другому разделу?',
                            () => {
                                loadTheorySection(sectionId);
                            }
                        );
                    } else {
                        loadTheorySection(sectionId);
                    }
                } else if (section.type === 'exercise') {
                    checkExerciseUnsavedChanges();
                    
                    if (hasExerciseUnsavedChanges) {
                        showUnsavedChangesDialog(
                            'Несохраненные изменения',
                            'У вас есть несохраненные изменения в текущем разделе. Перейти к другому разделу?',
                            () => {
                                const theoryEditorContainer = document.getElementById('theoryEditorContainer');
                                if (theoryEditorContainer) theoryEditorContainer.style.display = 'none';
                                loadExerciseSection(sectionId);
                            }
                        );
                    } else {
                        const theoryEditorContainer = document.getElementById('theoryEditorContainer');
                        if (theoryEditorContainer) theoryEditorContainer.style.display = 'none';
                        loadExerciseSection(sectionId);
                    }
                } else {
                    showNotification(`Редактирование "${section.title}" будет реализовано позже`, 'info');
                }
            }
        });
    });
}

function restoreCollapseStates() {
    document.querySelectorAll('.theme-toggle').forEach(toggle => {
        const themeId = toggle.dataset.themeId;
        const container = document.getElementById(`theme-blocks-${themeId}`);
        const isCollapsed = localStorage.getItem(`theme_${themeId}_collapsed`) === 'true';
        if (isCollapsed && container) {
            container.classList.add('collapsed');
            toggle.classList.add('collapsed');
        }
    });
    
    document.querySelectorAll('.block-toggle').forEach(toggle => {
        const blockId = toggle.dataset.blockId;
        const sectionsList = document.getElementById(`block-sections-${blockId}`);
        const isCollapsed = localStorage.getItem(`block_${blockId}_collapsed`) === 'true';
        if (isCollapsed && sectionsList) {
            sectionsList.classList.add('collapsed');
            toggle.classList.add('collapsed');
        }
    });
}

function openEditModal(section) {
    currentEditingSection = section;
    modalTitle.textContent = 'Редактирование названия';
    
    modalBody.innerHTML = `
        <div class="form-group">
            <label>Название раздела</label>
            <input type="text" id="editTitle" class="edit-title-input" value="${escapeHtml(section.title)}" placeholder="Введите название раздела">
        </div>
    `;
    
    editModal.style.display = 'flex';
    
    setTimeout(() => {
        const input = document.getElementById('editTitle');
        if (input) {
            input.focus();
            input.select();
        }
    }, 100);
}

async function saveSection() {
    if (!currentEditingSection) return;
    
    const title = document.getElementById('editTitle')?.value.trim();
    if (!title) {
        showNotification('Введите название раздела', 'warning');
        return;
    }
    
    let url = '';
    let body = {};
    
    switch (currentEditingSection.type) {
        case 'theory':
            url = `${apiBaseUrl}/sections/${currentEditingSection.id}/theory`;
            body = { title, file_url: null };
            break;
        case 'exercise':
            url = `${apiBaseUrl}/sections/${currentEditingSection.id}/exercise`;
            body = { title };
            break;
        case 'test':
            url = `${apiBaseUrl}/sections/${currentEditingSection.id}/test`;
            body = { title };
            break;
        default:
            showNotification('Неизвестный тип раздела', 'error');
            return;
    }
    
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) throw new Error('Ошибка сохранения');
        
        const data = await response.json();
        if (data.success) {
            editModal.style.display = 'none';
            showNotification('Название раздела успешно сохранено', 'success');
            
            const sectionIndex = currentSections.findIndex(s => s.id === currentEditingSection.id);
            if (sectionIndex !== -1) {
                currentSections[sectionIndex].title = title;
            }
            
            renderSections(currentSections);
            updateSidebarSections(currentBlock.id, currentSections);
        } else {
            showNotification(data.message || 'Не удалось сохранить название раздела', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Не удалось сохранить название раздела', 'error');
    }
}

async function deleteSection(sectionId) {
    try {
        const response = await fetch(`${apiBaseUrl}/sections/${sectionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        
        if (!response.ok) throw new Error('Ошибка удаления');
        
        const data = await response.json();
        if (data.success) {
            showNotification('Раздел успешно удален', 'success');
            
            currentSections = currentSections.filter(s => s.id !== sectionId);
            
            renderSections(currentSections);
            updateSidebarSections(currentBlock.id, currentSections);
        } else {
            showNotification(data.message || 'Не удалось удалить раздел', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Не удалось удалить раздел', 'error');
    }
}

async function createSection(type) {
    if (!currentBlock) return;
    
    let defaultTitle = '';
    
    switch (type) {
        case 'theory':
            defaultTitle = 'Новая теория';
            break;
        case 'exercise':
            defaultTitle = 'Новое упражнение';
            break;
        case 'test':
            defaultTitle = 'Новый итоговый тест';
            break;
        default:
            console.error('Неизвестный тип:', type);
            return;
    }
    
    try {
        const response = await fetch(`${apiBaseUrl}/blocks/${currentBlock.id}/sections`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ type, title: defaultTitle })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Ошибка сервера:', errorData);
            throw new Error('Ошибка создания раздела');
        }
        
        const data = await response.json();
        if (data.success) {
            createMenu.style.display = 'none';
            showNotification('Раздел успешно создан', 'success');
            
            await loadBlockSections(currentBlock.id, currentBlock.title, currentBlock.description);
            
            if (data.section) {
                openEditModal(data.section);
            }
        } else {
            showNotification(data.message || 'Не удалось создать раздел', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Не удалось создать раздел', 'error');
    }
}

function scrollToElement(element) {
    if (!element) return;
    
    const elementRect = element.getBoundingClientRect();
    const absoluteElementTop = elementRect.top + window.pageYOffset;
    const offset = 100;
    
    window.scrollTo({
        top: absoluteElementTop - offset,
        behavior: 'smooth'
    });
}

// ========== ДИАЛОГ ПОДТВЕРЖДЕНИЯ ==========
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
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeConfirmDialog(overlay);
    });
    
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
    if (document.getElementById('confirm-dialog-styles-constructor')) return;
    
    const style = document.createElement('style');
    style.id = 'confirm-dialog-styles-constructor';
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
            font-family: 'Ysabeau', 'Inter', sans-serif;
        }
        .confirm-dialog-message {
            font-size: 18px;
            color: #4C4C4C;
            margin-bottom: 32px;
            line-height: 1.5;
            font-family: 'Ysabeau', 'Inter', sans-serif;
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
            font-family: 'Ysabeau', 'Inter', sans-serif;
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

// Обработчики событий
backButton.addEventListener('click', () => {
    window.location.href = `/teacher/create-course?id=${courseId}`;
});

showCreateMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = createMenu.style.display === 'block';
    
    if (!isVisible) {
        createMenu.style.display = 'block';
        
    } else {
        createMenu.style.display = 'none';
    }
});

document.addEventListener('click', (e) => {
    if (createMenu.style.display === 'block' && 
        !createMenu.contains(e.target) && 
        e.target !== showCreateMenuBtn &&
        !addSectionWrapper.contains(e.target)) {
        createMenu.style.display = 'none';
    }
});

closeModalBtn.addEventListener('click', () => {
    editModal.style.display = 'none';
});

cancelModalBtn.addEventListener('click', () => {
    editModal.style.display = 'none';
});

saveModalBtn.addEventListener('click', saveSection);

document.querySelectorAll('.create-option').forEach(option => {
    option.addEventListener('click', () => {
        const type = option.dataset.type;
        createMenu.style.display = 'none';
        createSection(type);
    });
});

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== ФУНКЦИИ ДЛЯ РЕДАКТОРА ТЕОРИИ =====

function compressImage(file, maxSizeKB = 500) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                const maxWidth = 800;
                const maxHeight = 600;
                
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, file.type, 0.7);
            };
        };
        reader.onerror = (error) => reject(error);
    });
}

function initQuillEditor() {
    const editorContainer = document.getElementById('quillEditor');
    if (!editorContainer) return;
    
    quillEditor = new Quill('#quillEditor', {
        theme: 'snow',
        modules: {
            toolbar: {
                container: [
                    ['bold', 'italic', 'underline'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'align': [] }],
                    ['link', 'image', 'clean']
                ],
                handlers: {
                    image: function() {
                        const input = document.createElement('input');
                        input.setAttribute('type', 'file');
                        input.setAttribute('accept', 'image/*');
                        input.click();
                        
                        input.onchange = async () => {
                            const file = input.files[0];
                            if (file) {
                                try {
                                    showNotification('Сжатие изображения...', 'info');
                                    const compressedBlob = await compressImage(file);
                                    
                                    if (compressedBlob.size > 500 * 1024) {
                                        showNotification('Изображение всё ещё слишком большое! Попробуйте другое.', 'warning');
                                        return;
                                    }
                                    
                                    const reader = new FileReader();
                                    reader.onload = (e) => {
                                        const range = quillEditor.getSelection();
                                        const index = range ? range.index : 0;
                                        quillEditor.insertEmbed(index, 'image', e.target.result);
                                        showNotification('Изображение вставлено', 'success');
                                    };
                                    reader.readAsDataURL(compressedBlob);
                                } catch (error) {
                                    showNotification('Ошибка при сжатии', 'error');
                                }
                            }
                        };
                    }
                }
            }
        },
        placeholder: 'Введите теоретический материал...'
    });
}

async function loadTheorySection(sectionId) {
    try {       
        const token = getToken();
        const response = await fetch(`${apiBaseUrl}/sections/${sectionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const section = data.section;
            currentEditingTheorySection = section;
            
            const theoryTitleEl = document.getElementById('currentTheoryTitle');
            if (theoryTitleEl) {
                theoryTitleEl.textContent = section.title;
            }
            
            const blockIdFromSection = section.block_id;
            
            for (const theme of currentCourse.themes) {
                const foundBlock = theme.blocks?.find(b => b.id === blockIdFromSection);
                if (foundBlock) {
                    currentBlock = {
                        id: foundBlock.id,
                        title: foundBlock.title,
                        description: foundBlock.description || ''
                    };
                    currentSections = foundBlock.sections || [];
                    break;
                }
            }
            
            document.querySelectorAll('.block-item').forEach(el => el.classList.remove('active'));
            const activeBlock = document.querySelector(`.block-item[data-block-id="${blockIdFromSection}"]`);
            if (activeBlock) activeBlock.classList.add('active');
            
            currentBlockTitle.textContent = currentBlock.title;
            currentBlockDescription.textContent = currentBlock.description;
            
            const theoryText = section.theoryContent?.text || '';
            originalTheoryText = theoryText;
            
            if (quillEditor) {
                quillEditor.root.innerHTML = theoryText;
            }
            
            const editorContainer = document.getElementById('theoryEditorContainer');
            const sectionsAreaEl = document.getElementById('sectionsArea');
            const welcomeScreenEl = document.getElementById('welcomeScreen');
            const exerciseEditorContainer = document.getElementById('exerciseEditorContainer');
            
            if (exerciseEditorContainer) exerciseEditorContainer.style.display = 'none';
            if (editorContainer) editorContainer.style.display = 'block';
            if (sectionsAreaEl) sectionsAreaEl.style.display = 'none';
            if (welcomeScreenEl) welcomeScreenEl.style.display = 'none';
            
            hasUnsavedChanges = false;
        } else {
            showNotification('Ошибка загрузки раздела', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка загрузки раздела', 'error');
    }
}

async function saveTheorySection() {
    if (!currentEditingTheorySection) {
        showNotification('Раздел не выбран', 'error');
        return;
    }
    
    const title = currentEditingTheorySection.title;
    const text = quillEditor ? quillEditor.root.innerHTML : '';
    
    if (!title.trim()) {
        showNotification('Название раздела не может быть пустым', 'warning');
        return;
    }
    
    try {
        const token = getToken();
        const response = await fetch(`${apiBaseUrl}/sections/${currentEditingTheorySection.id}/theory`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title: title,
                text: text,
                file_url: null
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Теория успешно сохранена!', 'success');
            
            originalTheoryText = text;
            hasUnsavedChanges = false;
            
            if (currentEditingTheorySection.theoryContent) {
                currentEditingTheorySection.theoryContent.text = text;
            }
            
            renderSections(currentSections);
            updateSidebarSections(currentBlock.id, currentSections);
        } else {
            showNotification('Ошибка при сохранении', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка при сохранении', 'error');
    }
}

function backToCourseStructure() {
    checkUnsavedChanges();
    
    if (hasUnsavedChanges) {
        showUnsavedChangesDialog(
            'Несохраненные изменения',
            'У вас есть несохраненные изменения. Вернуться к разделам?',
            () => {
                performBackToSections();
            }
        );
        return;
    }
    
    performBackToSections();
}

function performBackToSections() {
    const editorContainer = document.getElementById('theoryEditorContainer');
    const sectionsAreaEl = document.getElementById('sectionsArea');
    const welcomeScreenEl = document.getElementById('welcomeScreen');
    
    if (editorContainer) editorContainer.style.display = 'none';
    
    const theoryTitleEl = document.getElementById('currentTheoryTitle');
    if (theoryTitleEl) {
        theoryTitleEl.textContent = '';
    }
    
    if (currentBlock && sectionsAreaEl) {
        sectionsAreaEl.style.display = 'block';
        welcomeScreenEl.style.display = 'none';
        
        currentBlockTitle.textContent = currentBlock.title;
        currentBlockDescription.textContent = currentBlock.description;
        
        renderSections(currentSections);
        
        document.querySelectorAll('.block-item').forEach(el => el.classList.remove('active'));
        const activeBlock = document.querySelector(`.block-item[data-block-id="${currentBlock.id}"]`);
        if (activeBlock) activeBlock.classList.add('active');
        
        const newUrl = `/teacher/course-constructor?courseId=${courseId}&blockId=${currentBlock.id}&themeId=${themeId}`;
        window.history.pushState({}, '', newUrl);
        
    } else if (welcomeScreenEl) {
        welcomeScreenEl.style.display = 'flex';
        sectionsAreaEl.style.display = 'none';
    }
    
    if (quillEditor) {
        quillEditor.root.innerHTML = '';
    }
    
    currentEditingTheorySection = null;
    originalTheoryText = '';
    hasUnsavedChanges = false;
}

function hideTheoryEditor() {
    const editorContainer = document.getElementById('theoryEditorContainer');
    const sectionsAreaEl = document.getElementById('sectionsArea');
    const welcomeScreenEl = document.getElementById('welcomeScreen');
    
    if (editorContainer) editorContainer.style.display = 'none';
    
    if (currentBlock && sectionsAreaEl) {
        sectionsAreaEl.style.display = 'block';
        welcomeScreenEl.style.display = 'none';
    } else if (welcomeScreenEl) {
        welcomeScreenEl.style.display = 'flex';
        sectionsAreaEl.style.display = 'none';
    }
    
    if (quillEditor) {
        quillEditor.root.innerHTML = '';
    }
    
    currentEditingTheorySection = null;
    originalTheoryText = '';
    hasUnsavedChanges = false;
}

function hideExerciseEditor() {
    const exerciseEditorContainer = document.getElementById('exerciseEditorContainer');
    const sectionsAreaEl = document.getElementById('sectionsArea');
    const welcomeScreenEl = document.getElementById('welcomeScreen');
    
    if (exerciseEditorContainer) exerciseEditorContainer.style.display = 'none';
    
    if (currentBlock && sectionsAreaEl) {
        sectionsAreaEl.style.display = 'block';
        welcomeScreenEl.style.display = 'none';
    } else if (welcomeScreenEl) {
        welcomeScreenEl.style.display = 'flex';
        sectionsAreaEl.style.display = 'none';
    }
    
    currentEditingExerciseSection = null;
    hasExerciseUnsavedChanges = false;
}

function performBlockSwitch(clickedBlockId, blockTitle, blockDescription) {
    hasUnsavedChanges = false;
    currentEditingTheorySection = null;
    originalTheoryText = '';
    hasExerciseUnsavedChanges = false;
    currentEditingExerciseSection = null;
    
    if (quillEditor) {
        quillEditor.root.innerHTML = '';
    }
    
    document.querySelectorAll('.block-item').forEach(el => el.classList.remove('active'));
    const activeBlock = document.querySelector(`.block-item[data-block-id="${clickedBlockId}"]`);
    if (activeBlock) activeBlock.classList.add('active');
    
    document.querySelectorAll('.block-sections-list').forEach(list => {
        list.style.display = 'none';
        const parentWrapper = list.closest('.block-item-wrapper');
        if (parentWrapper) {
            const blockToggle = parentWrapper.querySelector('.block-toggle');
            if (blockToggle && !blockToggle.classList.contains('collapsed')) {
                blockToggle.classList.add('collapsed');
            }
        }
    });
    
    const sectionsListContainer = document.getElementById(`block-sections-${clickedBlockId}`);
    if (sectionsListContainer) {
        sectionsListContainer.style.display = 'block';
        const currentBlockWrapper = document.querySelector(`.block-item-wrapper[data-block-id="${clickedBlockId}"]`);
        if (currentBlockWrapper) {
            const blockToggle = currentBlockWrapper.querySelector('.block-toggle');
            if (blockToggle && blockToggle.classList.contains('collapsed')) {
                blockToggle.classList.remove('collapsed');
            }
        }
    }
    
    const newUrl = `/teacher/course-constructor?courseId=${courseId}&blockId=${clickedBlockId}&themeId=${themeId}`;
    window.history.pushState({}, '', newUrl);
    
    loadBlockSections(clickedBlockId, blockTitle, blockDescription);
}

function performBackToCourseStructure() {
    const editorContainer = document.getElementById('theoryEditorContainer');
    const sectionsAreaEl = document.getElementById('sectionsArea');
    const welcomeScreenEl = document.getElementById('welcomeScreen');
    
    if (editorContainer) editorContainer.style.display = 'none';
    
    if (currentBlock && sectionsAreaEl) {
        sectionsAreaEl.style.display = 'block';
        welcomeScreenEl.style.display = 'none';
    } else if (welcomeScreenEl) {
        welcomeScreenEl.style.display = 'flex';
        sectionsAreaEl.style.display = 'none';
    }
    
    if (quillEditor) {
        quillEditor.root.innerHTML = '';
    }
    
    currentEditingTheorySection = null;
    originalTheoryText = '';
    hasUnsavedChanges = false;
}

function showUnsavedChangesDialog(title, message, onConfirm) {
    addUnsavedDialogStyles();
    
    const oldDialog = document.querySelector('.unsaved-dialog-overlay');
    if (oldDialog) oldDialog.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'unsaved-dialog-overlay';
    
    const dialog = document.createElement('div');
    dialog.className = 'unsaved-dialog';
    
    dialog.innerHTML = `
        <div class="unsaved-dialog-content">
            <div class="unsaved-dialog-title">${title}</div>
            <div class="unsaved-dialog-message">${message}</div>
            <div class="unsaved-dialog-buttons">
                <button class="unsaved-dialog-btn unsaved-dialog-btn-cancel">Отмена</button>
                <button class="unsaved-dialog-btn unsaved-dialog-btn-confirm">Выйти без сохранения</button>
            </div>
        </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" });
    gsap.fromTo(dialog, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "backOut" });
    
    const cancelBtn = dialog.querySelector('.unsaved-dialog-btn-cancel');
    const confirmBtn = dialog.querySelector('.unsaved-dialog-btn-confirm');
    
    cancelBtn.addEventListener('click', () => closeUnsavedDialog(overlay));
    confirmBtn.addEventListener('click', () => {
        closeUnsavedDialog(overlay);
        hasUnsavedChanges = false;
        hasExerciseUnsavedChanges = false;
        if (quillEditor) {
            quillEditor.root.innerHTML = '';
        }
        if (onConfirm) onConfirm();
    });
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeUnsavedDialog(overlay);
    });
    
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeUnsavedDialog(overlay);
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

function closeUnsavedDialog(overlay) {
    const dialog = overlay.querySelector('.unsaved-dialog');
    gsap.to(dialog, { scale: 0.9, opacity: 0, duration: 0.3, ease: "power2.in" });
    gsap.to(overlay, { opacity: 0, duration: 0.3, ease: "power2.in", onComplete: () => overlay.remove() });
}

function addUnsavedDialogStyles() {
    if (document.getElementById('unsaved-dialog-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'unsaved-dialog-styles';
    style.textContent = `
        .unsaved-dialog-overlay {
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
        .unsaved-dialog {
            background: white;
            border-radius: 24px;
            padding: 32px;
            max-width: 450px;
            width: 90%;
            box-shadow: 0 30px 60px rgba(0, 0, 0, 0.3);
            transform-origin: center;
        }
        .unsaved-dialog-content {
            text-align: center;
        }
        .unsaved-dialog-title {
            font-size: 28px;
            font-weight: 500;
            color: #1D1D1D;
            margin-bottom: 16px;
            font-family: 'Ysabeau', 'Inter', sans-serif;
        }
        .unsaved-dialog-message {
            font-size: 18px;
            color: #4C4C4C;
            margin-bottom: 32px;
            line-height: 1.5;
            font-family: 'Ysabeau', 'Inter', sans-serif;
        }
        .unsaved-dialog-buttons {
            display: flex;
            gap: 16px;
            justify-content: center;
        }
        .unsaved-dialog-btn {
            padding: 12px 24px;
            border-radius: 40px;
            font-size: 16px;
            font-weight: 500;
            font-family: 'Ysabeau', 'Inter', sans-serif;
            cursor: pointer;
            transition: all 0.3s ease;
            border: none;
        }
        .unsaved-dialog-btn-cancel {
            background-color: #f0f0f0;
            color: #4C4C4C;
        }
        .unsaved-dialog-btn-cancel:hover {
            background-color: #e0e0e0;
            transform: translateY(-2px);
        }
        .unsaved-dialog-btn-confirm {
            background-color: #7651BE;
            color: white;
        }
        .unsaved-dialog-btn-confirm:hover {
            background-color: #6947ac;
            transform: translateY(-2px);
        }
        @media (max-width: 576px) {
            .unsaved-dialog {
                padding: 24px;
                width: 95%;
            }
            .unsaved-dialog-title {
                font-size: 24px;
            }
            .unsaved-dialog-message {
                font-size: 16px;
                margin-bottom: 24px;
            }
            .unsaved-dialog-buttons {
                flex-direction: column;
                gap: 12px;
            }
            .unsaved-dialog-btn {
                width: 100%;
            }
        }
    `;
    document.head.appendChild(style);
}

// ===== ФУНКЦИИ ДЛЯ РЕДАКТОРА УПРАЖНЕНИЙ =====

// Загрузка раздела упражнения
async function loadExerciseSection(sectionId) {
    try {
        const token = getToken();
        const response = await fetch(`${apiBaseUrl}/sections/${sectionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const section = data.section;
            currentEditingExerciseSection = section;
            
            const exerciseTitleEl = document.getElementById('currentExerciseTitle');
            if (exerciseTitleEl) {
                exerciseTitleEl.textContent = section.title;
            }
            
            const blockIdFromSection = section.block_id;
            for (const theme of currentCourse.themes) {
                const foundBlock = theme.blocks?.find(b => b.id === blockIdFromSection);
                if (foundBlock) {
                    currentBlock = {
                        id: foundBlock.id,
                        title: foundBlock.title,
                        description: foundBlock.description || ''
                    };
                    currentSections = foundBlock.sections || [];
                    break;
                }
            }
            
            document.querySelectorAll('.block-item').forEach(el => el.classList.remove('active'));
            const activeBlock = document.querySelector(`.block-item[data-block-id="${blockIdFromSection}"]`);
            if (activeBlock) activeBlock.classList.add('active');
            
            currentBlockTitle.textContent = currentBlock.title;
            currentBlockDescription.textContent = currentBlock.description;
            
            const exerciseData = section.exercise || {};
            currentExerciseType = exerciseData.exercise_type || 'matching';
            
            updateSelectedExerciseType(currentExerciseType);
            
            if (currentExerciseType === 'matching') {
                matchingItems = exerciseData.left_column || [];
                matchingTargets = exerciseData.right_column || [];
                matchingPairs = exerciseData.matches || [];
                
                if (matchingItems.length > 0) {
                    nextItemId = Math.max(...matchingItems.map(i => parseInt(i.id) || 0)) + 1;
                } else {
                    nextItemId = 1;
                }
                if (matchingTargets.length > 0) {
                    nextTargetId = Math.max(...matchingTargets.map(t => parseInt(t.id) || 0)) + 1;
                } else {
                    nextTargetId = 1;
                }
                
                const taskText = document.getElementById('matchingTaskText');
                if (taskText) {
                    taskText.textContent = exerciseData.question_text || 'сопоставьте каждый элемент с его сопоставлением.';
                }
                
                renderMatchingItems();
                renderMatchingTargets();
                renderMatchingTable();
            }
            else if (currentExerciseType === 'choice') {
                choiceStatements = exerciseData.options || [];
                
                if (choiceStatements.length > 0) {
                    nextStatementId = Math.max(...choiceStatements.map(s => parseInt(s.id) || 0)) + 1;
                    const maxAnswerId = Math.max(...choiceStatements.flatMap(s => s.answers.map(a => parseInt(a.id) || 0)), 0);
                    nextAnswerId = maxAnswerId + 1;
                } else {
                    nextStatementId = 1;
                    nextAnswerId = 1;
                    choiceStatements = [{
                        id: nextStatementId++,
                        text: '',
                        answers: [{ id: nextAnswerId++, text: '', isCorrect: false }]
                    }];
                }
                
                const taskText = document.getElementById('choiceTaskText');
                if (taskText) {
                    taskText.textContent = exerciseData.question_text || 'Сопоставьте каждое утверждение с правильным ответом (правильных ответов может быть несколько).';
                }
                
                renderChoiceStatements();
            }
            else if (currentExerciseType === 'fill_blanks') {
                // TODO: реализовать позже
            }
            
            // Сохраняем исходное состояние
            if (currentExerciseType === 'matching') {
                originalExerciseState = {
                    type: 'matching',
                    items: JSON.parse(JSON.stringify(matchingItems)),
                    targets: JSON.parse(JSON.stringify(matchingTargets)),
                    pairs: JSON.parse(JSON.stringify(matchingPairs)),
                    taskText: document.getElementById('matchingTaskText')?.textContent || ''
                };
            } else if (currentExerciseType === 'choice') {
                originalExerciseState = {
                    type: 'choice',
                    statements: JSON.parse(JSON.stringify(choiceStatements)),
                    taskText: document.getElementById('choiceTaskText')?.textContent || ''
                };
            }
            hasExerciseUnsavedChanges = false;
            
            const exerciseEditorContainer = document.getElementById('exerciseEditorContainer');
            const sectionsAreaEl = document.getElementById('sectionsArea');
            const welcomeScreenEl = document.getElementById('welcomeScreen');
            const theoryEditorContainer = document.getElementById('theoryEditorContainer');
            
            if (theoryEditorContainer) theoryEditorContainer.style.display = 'none';
            if (exerciseEditorContainer) exerciseEditorContainer.style.display = 'block';
            if (sectionsAreaEl) sectionsAreaEl.style.display = 'none';
            if (welcomeScreenEl) welcomeScreenEl.style.display = 'none';
            
        } else {
            showNotification('Ошибка загрузки раздела', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка загрузки раздела', 'error');
    }
}

// Сохранение упражнения
async function saveExerciseSection() {
    if (!currentEditingExerciseSection) {
        showNotification('Раздел не выбран', 'error');
        return;
    }
    
    let exerciseData = {};
    let taskText = '';
    
    if (currentExerciseType === 'matching') {
        taskText = document.getElementById('matchingTaskText')?.textContent || 'сопоставьте каждый элемент с его сопоставлением.';
        
        if (matchingTargets.length === 0) {
            showNotification('Добавьте хотя бы один элемент сопоставления', 'warning');
            return;
        }
        
        const missingPairs = matchingTargets.filter(target => 
            !matchingPairs.some(p => p.targetId == target.id)
        );
        
        if (missingPairs.length > 0) {
            const missingLetters = missingPairs.map(t => t.letter).join(', ');
            showNotification(`Для элементов ${missingLetters} не выбрано сопоставление`, 'warning');
            return;
        }
        
        exerciseData = {
            title: currentEditingExerciseSection.title,
            exercise_type: 'matching',
            question_text: taskText,
            left_column: matchingItems,
            right_column: matchingTargets,
            matches: matchingPairs
        };
    }
    else if (currentExerciseType === 'choice') {
            taskText = document.getElementById('choiceTaskText')?.textContent || 'Сопоставьте каждое утверждение с правильным ответом (правильных ответов может быть несколько).';
            
            if (choiceStatements.length === 0) {
                showNotification('Добавьте хотя бы одно утверждение', 'warning');
                return;
            }
            
            // Сначала убираем все старые подсветки
            clearAllChoiceErrors();
            
            // Валидация каждого утверждения
            let hasError = false;
            let errorMessage = '';
            let errorFields = []; // для хранения полей с ошибками
            
            for (let i = 0; i < choiceStatements.length; i++) {
                const statement = choiceStatements[i];
                const statementNumber = i + 1;
                
                // Проверка на пустое утверждение
                if (!statement.text.trim()) {
                    errorMessage = `Утверждение ${statementNumber} не заполнено`;
                    hasError = true;
                    // Подсвечиваем поле утверждения
                    highlightChoiceError(`statement_${statement.id}`);
                    break;
                }
                
                // Проверка на пустые ответы
                for (let j = 0; j < statement.answers.length; j++) {
                    const answer = statement.answers[j];
                    if (!answer.text.trim()) {
                        const answerLetter = String.fromCharCode(65 + j);
                        errorMessage = `У утверждения ${statementNumber} ответ ${answerLetter} не заполнен`;
                        hasError = true;
                        // Подсвечиваем поле ответа
                        highlightChoiceError(`answer_${answer.id}`);
                        break;
                    }
                }
                if (hasError) break;
                
                // Проверка, что выбран хотя бы один правильный ответ
                const hasCorrectAnswer = statement.answers.some(a => a.isCorrect === true);
                if (!hasCorrectAnswer) {
                    errorMessage = `У утверждения ${statementNumber} не выбран правильный ответ`;
                    hasError = true;
                    // Подсвечиваем блок ответов
                    highlightChoiceError(`answers_section_${statement.id}`);
                    break;
                }
            }
            
            if (hasError) {
                showNotification(errorMessage, 'warning');
                // Убираем подсветку через 3 секунды
                setTimeout(() => {
                    clearAllChoiceErrors();
                }, 3000);
                return;
            }
            
            exerciseData = {
                title: currentEditingExerciseSection.title,
                exercise_type: 'choice',
                question_text: taskText,
                options: choiceStatements
            };
        }
    else if (currentExerciseType === 'fill_blanks') {
        showNotification('Редактор "Дополнение" будет реализован позже', 'info');
        return;
    }
    
    try {
        const token = getToken();
        const response = await fetch(`${apiBaseUrl}/sections/${currentEditingExerciseSection.id}/exercise`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(exerciseData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Упражнение успешно сохранено!', 'success');
            
            if (currentExerciseType === 'matching') {
                originalExerciseState = {
                    type: 'matching',
                    items: JSON.parse(JSON.stringify(matchingItems)),
                    targets: JSON.parse(JSON.stringify(matchingTargets)),
                    pairs: JSON.parse(JSON.stringify(matchingPairs)),
                    taskText: document.getElementById('matchingTaskText')?.textContent || ''
                };
            } else if (currentExerciseType === 'choice') {
                originalExerciseState = {
                    type: 'choice',
                    statements: JSON.parse(JSON.stringify(choiceStatements)),
                    taskText: document.getElementById('choiceTaskText')?.textContent || ''
                };
            }
            hasExerciseUnsavedChanges = false;
        } else {
            showNotification('Ошибка при сохранении: ' + (data.message || 'Неизвестная ошибка'), 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка при сохранении', 'error');
    }
}

// Возврат к разделам из редактора упражнений
function backToSectionsFromExercise() {
    checkExerciseUnsavedChanges();
    
    if (hasExerciseUnsavedChanges) {
        showUnsavedChangesDialog(
            'Несохраненные изменения',
            'У вас есть несохраненные изменения. Вернуться к разделам?',
            () => {
                performBackToSectionsFromExercise();
            }
        );
        return;
    }
    
    performBackToSectionsFromExercise();
}

function performBackToSectionsFromExercise() {
    const exerciseEditorContainer = document.getElementById('exerciseEditorContainer');
    const sectionsAreaEl = document.getElementById('sectionsArea');
    const welcomeScreenEl = document.getElementById('welcomeScreen');
    
    if (exerciseEditorContainer) exerciseEditorContainer.style.display = 'none';
    
    if (currentBlock && sectionsAreaEl) {
        sectionsAreaEl.style.display = 'block';
        welcomeScreenEl.style.display = 'none';
        
        currentBlockTitle.textContent = currentBlock.title;
        currentBlockDescription.textContent = currentBlock.description;
        
        renderSections(currentSections);
        
        document.querySelectorAll('.block-item').forEach(el => el.classList.remove('active'));
        const activeBlock = document.querySelector(`.block-item[data-block-id="${currentBlock.id}"]`);
        if (activeBlock) activeBlock.classList.add('active');
        
        const newUrl = `/teacher/course-constructor?courseId=${courseId}&blockId=${currentBlock.id}&themeId=${themeId}`;
        window.history.pushState({}, '', newUrl);
        
    } else if (welcomeScreenEl) {
        welcomeScreenEl.style.display = 'flex';
        sectionsAreaEl.style.display = 'none';
    }
    
    currentEditingExerciseSection = null;
    hasExerciseUnsavedChanges = false;
}

// Обновление выбранного типа упражнения в UI
function updateSelectedExerciseType(type) {
    const selectedBtn = document.getElementById('selectedTypeBtn');
    const typeOptions = document.querySelectorAll('.type-option');
    
    let typeText = '';
    switch (type) {
        case 'matching': typeText = 'Сопоставление'; break;
        case 'choice': typeText = 'Выбор правильного'; break;
        case 'fill_blanks': typeText = 'Дополнение'; break;
        default: typeText = 'Сопоставление';
    }
    
    if (selectedBtn) {
        selectedBtn.innerHTML = `<span class="selected-value">${typeText}</span> <img src="/images/taskCreationPage/chevronDown.svg" alt="toggle" class="dropdown-chevron">`;
    }
    
    typeOptions.forEach(opt => {
        opt.classList.remove('selected');
        if (opt.dataset.type === type) {
            opt.classList.add('selected');
        }
    });
    
    const matchingContainer = document.getElementById('matchingExerciseContainer');
    const choiceContainer = document.getElementById('choiceExerciseContainer');
    const fillBlanksContainer = document.getElementById('fillBlanksExerciseContainer');
    
    if (matchingContainer) matchingContainer.style.display = type === 'matching' ? 'block' : 'none';
    if (choiceContainer) choiceContainer.style.display = type === 'choice' ? 'block' : 'none';
    if (fillBlanksContainer) fillBlanksContainer.style.display = type === 'fill_blanks' ? 'block' : 'none';
    
    if (type === 'choice' && choiceStatements.length === 0) {
        choiceStatements = [{
            id: nextStatementId++,
            text: '',
            answers: [{ id: nextAnswerId++, text: '', isCorrect: false }]
        }];
        renderChoiceStatements();
    }
    
    currentExerciseType = type;
}

// ===== ФУНКЦИИ ДЛЯ СОПОСТАВЛЕНИЯ (MATCHING) =====

function getLetterByIndex(index) {
    return String.fromCharCode(65 + index);
}

function renderMatchingItems() {
    const itemsList = document.getElementById('itemsList');
    const itemsCounter = document.getElementById('itemsCounter');
    
    if (!itemsList) return;
    
    if (matchingItems.length === 0) {
        itemsList.innerHTML = '<div class="empty-message" style="padding: 20px; text-align: center;">Нет элементов. Добавьте первый элемент.</div>';
    } else {
        itemsList.innerHTML = matchingItems.map((item, index) => `
            <div class="item-row" data-item-id="${item.id}">
                <div class="item-number">${index + 1}.</div>
                <input type="text" class="item-input" value="${escapeHtml(item.text)}" placeholder="введите элемент">
                <button class="delete-item-btn" onclick="deleteMatchingItem('${item.id}')">
                    <img src="/images/taskCreationPage/delete.svg" alt="Удалить" class="delete-icon">
                </button>
            </div>
        `).join('');
        
        document.querySelectorAll('.item-input').forEach((input, idx) => {
            input.addEventListener('change', (e) => {
                matchingItems[idx].text = e.target.value;
                renderMatchingTable();
                checkExerciseUnsavedChanges();
            });
        });
    }
    
    if (itemsCounter) {
        itemsCounter.textContent = `${matchingItems.length}/17 элементов`;
    }
}

function renderMatchingTargets() {
    const targetsList = document.getElementById('targetsList');
    const targetsCounter = document.getElementById('targetsCounter');
    
    if (!targetsList) return;
    
    if (matchingTargets.length === 0) {
        targetsList.innerHTML = '<div class="empty-message" style="padding: 20px; text-align: center;">Нет элементов. Добавьте первый элемент.</div>';
    } else {
        targetsList.innerHTML = matchingTargets.map((target, index) => `
            <div class="target-row" data-target-id="${target.id}">
                <div class="target-letter">${getLetterByIndex(index)}.</div>
                <input type="text" class="target-input" value="${escapeHtml(target.text)}" placeholder="введите элемент сопоставления">
                <button class="delete-target-btn" onclick="deleteMatchingTarget('${target.id}')">
                    <img src="/images/taskCreationPage/delete.svg" alt="Удалить" class="delete-icon">
                </button>
            </div>
        `).join('');
        
        document.querySelectorAll('.target-input').forEach((input, idx) => {
            input.addEventListener('change', (e) => {
                matchingTargets[idx].text = e.target.value;
                renderMatchingTable();
                checkExerciseUnsavedChanges();
            });
        });
    }
    
    if (targetsCounter) {
        targetsCounter.textContent = `${matchingTargets.length}/15 элементов`;
    }
}

window.deleteMatchingItem = function(itemId) {
    const itemIndex = matchingItems.findIndex(i => i.id == itemId);
    if (itemIndex !== -1) {
        matchingItems.splice(itemIndex, 1);
        matchingPairs = matchingPairs.filter(p => p.itemId != itemId);
        renderMatchingItems();
        renderMatchingTable();
        checkExerciseUnsavedChanges();
    }
};

window.deleteMatchingTarget = function(targetId) {
    const targetIndex = matchingTargets.findIndex(t => t.id == targetId);
    if (targetIndex !== -1) {
        matchingTargets.splice(targetIndex, 1);
        matchingPairs = matchingPairs.filter(p => p.targetId != targetId);
        matchingTargets.forEach((target, idx) => {
            target.letter = getLetterByIndex(idx);
        });
        renderMatchingTargets();
        renderMatchingTable();
        checkExerciseUnsavedChanges();
    }
};

function addMatchingItem() {
    if (matchingItems.length >= 17) {
        showNotification('Максимум 17 элементов', 'warning');
        return;
    }
    
    matchingItems.push({
        id: nextItemId++,
        text: ''
    });
    
    renderMatchingItems();
    renderMatchingTable();
    checkExerciseUnsavedChanges();
}

function addMatchingTarget() {
    if (matchingTargets.length >= 15) {
        showNotification('Максимум 15 элементов сопоставления', 'warning');
        return;
    }
    
    matchingTargets.push({
        id: nextTargetId++,
        text: '',
        letter: getLetterByIndex(matchingTargets.length)
    });
    
    renderMatchingTargets();
    renderMatchingTable();
    checkExerciseUnsavedChanges();
}

function renderMatchingTable() {
    const matchingRows = document.getElementById('matchingRows');
    if (!matchingRows) return;
    
    if (matchingTargets.length === 0) {
        matchingRows.innerHTML = '<div class="empty-message" style="padding: 20px; text-align: center;">Добавьте элементы сопоставления</div>';
        return;
    }
    
    matchingRows.innerHTML = matchingTargets.map((target, idx) => {
        const currentPair = matchingPairs.find(p => p.targetId == target.id);
        const selectedItemId = currentPair ? currentPair.itemId : null;
        const selectedItem = matchingItems.find(i => i.id == selectedItemId);
        const selectedText = selectedItem ? `${matchingItems.findIndex(i => i.id == selectedItemId) + 1}. ${selectedItem.text || `Элемент`}` : '-- выберите элемент --';
        
        return `
            <div class="matching-row" data-target-id="${target.id}">
                <div class="matching-cell">
                    <div class="matching-select-wrapper" data-target-id="${target.id}">
                        <button class="matching-select-btn" data-target-id="${target.id}">
                            <span class="selected-text">${escapeHtml(selectedText)}</span>
                            <img src="/images/taskCreationPage/chevronDown.svg" alt="toggle" class="select-chevron">
                        </button>
                        <div class="matching-select-menu" style="display: none;">
                            <button class="matching-select-option" data-value="">-- выберите элемент --</button>
                            ${matchingItems.map((item, itemIdx) => `
                                <button class="matching-select-option ${selectedItemId == item.id ? 'selected' : ''}" data-value="${item.id}">
                                    ${itemIdx + 1}. ${escapeHtml(item.text || `Элемент ${itemIdx + 1}`)}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="matching-cell">
                    <div class="matching-target-text">
                        <strong>${target.letter}.</strong> ${escapeHtml(target.text || 'не заполнено')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.matching-select-btn').forEach(btn => {
        const wrapper = btn.closest('.matching-select-wrapper');
        const menu = wrapper.querySelector('.matching-select-menu');
        
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.matching-select-menu').forEach(m => {
                if (m !== menu) m.style.display = 'none';
            });
            document.querySelectorAll('.matching-select-btn').forEach(b => {
                if (b !== btn) b.classList.remove('active');
            });
            const isOpen = menu.style.display === 'block';
            menu.style.display = isOpen ? 'none' : 'block';
            btn.classList.toggle('active', !isOpen);
        });
        
        menu.querySelectorAll('.matching-select-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetId = wrapper.dataset.targetId;
                const itemId = option.dataset.value;
                const selectedText = option.textContent;
                
                btn.querySelector('.selected-text').textContent = selectedText;
                menu.style.display = 'none';
                btn.classList.remove('active');
                
                if (itemId) {
                    const existingIndex = matchingPairs.findIndex(p => p.targetId == targetId);
                    if (existingIndex !== -1) {
                        matchingPairs[existingIndex].itemId = itemId;
                    } else {
                        matchingPairs.push({ targetId: targetId, itemId: itemId });
                    }
                } else {
                    matchingPairs = matchingPairs.filter(p => p.targetId != targetId);
                }
                
                menu.querySelectorAll('.matching-select-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                option.classList.add('selected');
                
                checkExerciseUnsavedChanges();
            });
        });
    });
    
    document.addEventListener('click', () => {
        document.querySelectorAll('.matching-select-menu').forEach(menu => {
            menu.style.display = 'none';
        });
        document.querySelectorAll('.matching-select-btn').forEach(btn => {
            btn.classList.remove('active');
        });
    });
}

// ===== ФУНКЦИИ ДЛЯ ВЫБОРА ПРАВИЛЬНОГО (CHOICE) =====

function renderChoiceStatements() {
    const statementsList = document.getElementById('statementsList');
    if (!statementsList) return;
    
    if (choiceStatements.length === 0) {
        statementsList.innerHTML = '<div class="empty-message" style="padding: 20px; text-align: center;">Нет утверждений. Добавьте первое утверждение.</div>';
        return;
    }
    
    statementsList.innerHTML = choiceStatements.map((statement, stmtIdx) => {
        // Проверка на пустое утверждение
        const statementErrorClass = !statement.text.trim() ? 'error' : '';
        
        // Проверка, что выбран хотя бы один правильный ответ
        const hasCorrectAnswer = statement.answers.some(a => a.isCorrect === true);
        const answersErrorClass = !hasCorrectAnswer && statement.answers.length > 0 ? 'error-border' : '';
        
        return `
            <div class="statement-card" data-statement-id="${statement.id}">
                <div class="statement-header">
                    <div class="statement-number">${stmtIdx + 1}.</div>
                    <input type="text" class="statement-input ${statementErrorClass}" value="${escapeHtml(statement.text)}" placeholder="Введите утверждение">
                    <button class="delete-statement-btn" onclick="deleteChoiceStatement('${statement.id}')">
                        <img src="/images/taskCreationPage/delete.svg" alt="Удалить" class="delete-statement-icon">
                    </button>
                </div>
                <div class="answers-section ${answersErrorClass}">
                    <div class="answers-header">Ответы (правильных может быть несколько):</div>
                    <div class="answers-list">
                        ${statement.answers.map((answer, ansIdx) => {
                            // Проверка на пустой ответ
                            const answerErrorClass = !answer.text.trim() ? 'error' : '';
                            return `
                                <div class="answer-row" data-answer-id="${answer.id}">
                                    <div class="radio-btn ${answer.isCorrect ? 'selected' : ''}" data-correct="${answer.isCorrect}" onclick="toggleCorrectAnswer('${statement.id}', '${answer.id}')"></div>
                                    <div class="answer-number">${String.fromCharCode(65 + ansIdx)}.</div>
                                    <input type="text" class="answer-input ${answerErrorClass}" value="${escapeHtml(answer.text)}" placeholder="Введите ответ">
                                    <button class="delete-answer-btn" onclick="deleteChoiceAnswer('${statement.id}', '${answer.id}')">
                                        <img src="/images/taskCreationPage/delete.svg" alt="Удалить" class="delete-answer-icon">
                                    </button>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <button class="add-answer-btn" onclick="addChoiceAnswer('${statement.id}')">
                        <img src="/images/taskCreationPage/plus.svg" alt="+" class="plus-icon"> Добавить ответ
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Обработчики для полей утверждений
    document.querySelectorAll('.statement-input').forEach((input, idx) => {
        // Удаляем класс error при вводе
        input.addEventListener('input', (e) => {
            input.classList.remove('error');
        });
        
        input.addEventListener('change', (e) => {
            choiceStatements[idx].text = e.target.value;
            // Проверяем и обновляем класс error
            if (!choiceStatements[idx].text.trim()) {
                input.classList.add('error');
            } else {
                input.classList.remove('error');
            }
            // Обновляем подсветку блока ответов
            const statementCard = input.closest('.statement-card');
            const answersSection = statementCard.querySelector('.answers-section');
            const statement = choiceStatements[idx];
            const hasCorrectAnswer = statement.answers.some(a => a.isCorrect === true);
            if (!hasCorrectAnswer && statement.answers.length > 0) {
                answersSection.classList.add('error-border');
            } else {
                answersSection.classList.remove('error-border');
            }
            checkExerciseUnsavedChanges();
        });
    });
    
    // Обработчики для полей ответов
    document.querySelectorAll('.answer-input').forEach((input) => {
        const answerRow = input.closest('.answer-row');
        const statementCard = input.closest('.statement-card');
        const statementId = statementCard.dataset.statementId;
        const answerId = answerRow.dataset.answerId;
        
        // Удаляем класс error при вводе
        input.addEventListener('input', (e) => {
            input.classList.remove('error');
        });
        
        input.addEventListener('change', (e) => {
            const statement = choiceStatements.find(s => s.id == statementId);
            const answer = statement?.answers.find(a => a.id == answerId);
            if (answer) {
                answer.text = e.target.value;
                // Проверяем и обновляем класс error
                if (!answer.text.trim()) {
                    input.classList.add('error');
                } else {
                    input.classList.remove('error');
                }
                checkExerciseUnsavedChanges();
            }
        });
    });
}

function addChoiceStatement() {
    if (choiceStatements.length >= 20) {
        showNotification('Максимум 20 утверждений', 'warning');
        return;
    }
    
    choiceStatements.push({
        id: nextStatementId++,
        text: '',
        answers: [{ id: nextAnswerId++, text: '', isCorrect: false }]
    });
    renderChoiceStatements();
    checkExerciseUnsavedChanges();
}

window.deleteChoiceStatement = function(statementId) {
    const statementIndex = choiceStatements.findIndex(s => s.id == statementId);
    if (statementIndex !== -1) {
        choiceStatements.splice(statementIndex, 1);
        renderChoiceStatements();
        checkExerciseUnsavedChanges();
    }
};

window.addChoiceAnswer = function(statementId) {
    const statement = choiceStatements.find(s => s.id == statementId);
    if (statement && statement.answers.length < 5) {
        statement.answers.push({
            id: nextAnswerId++,
            text: '',
            isCorrect: false
        });
        renderChoiceStatements();
        checkExerciseUnsavedChanges();
    } else if (statement && statement.answers.length >= 5) {
        showNotification('Максимум 5 ответов на утверждение', 'warning');
    }
};

window.deleteChoiceAnswer = function(statementId, answerId) {
    const statement = choiceStatements.find(s => s.id == statementId);
    if (statement && statement.answers.length > 1) {
        const answerIndex = statement.answers.findIndex(a => a.id == answerId);
        if (answerIndex !== -1) {
            statement.answers.splice(answerIndex, 1);
            renderChoiceStatements();
            checkExerciseUnsavedChanges();
        }
    } else {
        showNotification('У утверждения должен быть хотя бы один ответ', 'warning');
    }
};

window.toggleCorrectAnswer = function(statementId, answerId) {
    const statement = choiceStatements.find(s => s.id == statementId);
    if (statement) {
        const answer = statement.answers.find(a => a.id == answerId);
        if (answer) {
            answer.isCorrect = !answer.isCorrect;
            renderChoiceStatements();
            checkExerciseUnsavedChanges();
        }
    }
};

// Загрузка файла для теории
async function uploadTheoryFile(file) {
    if (!currentEditingTheorySection) {
        showNotification('Сначала выберите раздел', 'warning');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const token = getToken();
        const response = await fetch(`${apiBaseUrl}/sections/${currentEditingTheorySection.id}/upload-file`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (quillEditor) {
                const currentText = quillEditor.root.innerHTML;
                quillEditor.root.innerHTML = currentText + (currentText ? '<br><br>' : '') + data.extractedText;
            }
            
            checkUnsavedChanges();
            showNotification('Файл успешно загружен и обработан', 'success');
        } else {
            showNotification(data.message || 'Ошибка при загрузке файла', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка при загрузке файла', 'error');
    }
}

function handleFileSelect() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.docx,.txt';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadTheoryFile(file);
        }
    };
    input.click();
}

// Подсветка поля с ошибкой
function highlightChoiceError(targetId) {
    const element = document.getElementById(targetId);
    if (element) {
        element.classList.add('error-highlight');
    } else {
        // Если элемент не найден по ID, ищем по data-атрибуту или классу
        if (targetId.startsWith('statement_')) {
            const statementId = targetId.replace('statement_', '');
            const statementCard = document.querySelector(`.statement-card[data-statement-id="${statementId}"]`);
            if (statementCard) {
                const input = statementCard.querySelector('.statement-input');
                if (input) input.classList.add('error-highlight');
            }
        } else if (targetId.startsWith('answer_')) {
            const answerId = targetId.replace('answer_', '');
            const answerRow = document.querySelector(`.answer-row[data-answer-id="${answerId}"]`);
            if (answerRow) {
                const input = answerRow.querySelector('.answer-input');
                if (input) input.classList.add('error-highlight');
            }
        } else if (targetId.startsWith('answers_section_')) {
            const statementId = targetId.replace('answers_section_', '');
            const statementCard = document.querySelector(`.statement-card[data-statement-id="${statementId}"]`);
            if (statementCard) {
                const answersSection = statementCard.querySelector('.answers-section');
                if (answersSection) answersSection.classList.add('error-highlight');
            }
        }
    }
}

// Очистка всех подсветок ошибок
function clearAllChoiceErrors() {
    // Убираем класс error-highlight со всех полей утверждений
    document.querySelectorAll('.statement-input.error-highlight').forEach(el => {
        el.classList.remove('error-highlight');
    });
    
    // Убираем класс error-highlight со всех полей ответов
    document.querySelectorAll('.answer-input.error-highlight').forEach(el => {
        el.classList.remove('error-highlight');
    });
    
    // Убираем класс error-highlight со всех блоков ответов
    document.querySelectorAll('.answers-section.error-highlight').forEach(el => {
        el.classList.remove('error-highlight');
    });
}

// Инициализация Quill
initQuillEditor();

// Обработчик для кнопки загрузки файла
const uploadFileBtn = document.getElementById('uploadFileBtn');
if (uploadFileBtn) {
    uploadFileBtn.addEventListener('click', handleFileSelect);
}

// Обработчики для редактора теории
const backBtn = document.getElementById('backToStructureBtn');
const saveBtn = document.getElementById('saveTheoryBtn');

if (backBtn) backBtn.addEventListener('click', backToCourseStructure);
if (saveBtn) saveBtn.addEventListener('click', saveTheorySection);

// Обработчики для редактора упражнений
const backFromExerciseBtn = document.getElementById('backToStructureFromExerciseBtn');
const saveExerciseBtn = document.getElementById('saveExerciseBtn');
const addItemBtn = document.getElementById('addItemBtn');
const addTargetBtn = document.getElementById('addTargetBtn');
const addStatementBtn = document.getElementById('addStatementBtn');
const typeDropdownBtn = document.getElementById('selectedTypeBtn');
const typeDropdownMenu = document.getElementById('typeDropdownMenu');

if (backFromExerciseBtn) {
    backFromExerciseBtn.addEventListener('click', backToSectionsFromExercise);
}
if (saveExerciseBtn) {
    saveExerciseBtn.addEventListener('click', saveExerciseSection);
}
if (addItemBtn) {
    addItemBtn.addEventListener('click', addMatchingItem);
}
if (addTargetBtn) {
    addTargetBtn.addEventListener('click', addMatchingTarget);
}
if (addStatementBtn) {
    addStatementBtn.addEventListener('click', addChoiceStatement);
}

if (typeDropdownBtn) {
    typeDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeDropdownMenu) {
            typeDropdownMenu.style.display = typeDropdownMenu.style.display === 'none' ? 'block' : 'none';
            typeDropdownBtn.classList.toggle('active');
        }
    });
}

document.addEventListener('click', () => {
    if (typeDropdownMenu) {
        typeDropdownMenu.style.display = 'none';
        if (typeDropdownBtn) typeDropdownBtn.classList.remove('active');
    }
});

document.querySelectorAll('.type-option').forEach(option => {
    option.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = option.dataset.type;
        currentExerciseType = type;
        updateSelectedExerciseType(type);
        if (typeDropdownMenu) typeDropdownMenu.style.display = 'none';
        if (typeDropdownBtn) typeDropdownBtn.classList.remove('active');
        showNotification(`Выбран тип: ${option.textContent}`, 'info');
    });
});

// Предупреждение при закрытии страницы
window.addEventListener('beforeunload', (e) => {
    checkUnsavedChanges();
    checkExerciseUnsavedChanges();
    if (hasUnsavedChanges || hasExerciseUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
    }
});

loadCourseData();