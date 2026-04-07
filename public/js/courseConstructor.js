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

// Данные для дополнения (fill_blanks)
let fillBlanksWords = [];
let fillBlanksSentences = [];
let nextSentenceId = 1;
let nextWordId = 1;

// Данные для итогового теста (test)
let currentTestData = {
    deadline: '',
    timeLimit: {
        enabled: true,
        days: 0,
        hours: 1,
        minutes: 0
    },
    exercises: []
};
let nextTestExerciseId = 1;
let isLoadingTest = false; // добавляем флаг загрузки

function getToken() {
    return localStorage.getItem('token');
}

// Сброс всех данных упражнения
function resetExerciseData() {
    console.log('resetExerciseData called, stack:', new Error().stack);
    
    if (currentExerciseType === 'test') return; // Не сбрасываем тест
    
    // Сброс matching данных
    matchingItems = [];
    matchingTargets = [];
    matchingPairs = [];
    nextItemId = 1;
    nextTargetId = 1;
    
    // Сброс choice данных
    choiceStatements = [];
    nextStatementId = 1;
    nextAnswerId = 1;
    
    // Сброс fill_blanks данных
    fillBlanksWords = [];
    fillBlanksSentences = [];
    nextSentenceId = 1;
    nextWordId = 1;
    
    // Сброс флагов
    hasExerciseUnsavedChanges = false;
    originalExerciseState = null;
    currentExerciseType = 'matching';
    
    // Обновляем UI
    updateSelectedExerciseType('matching');
    
    // Очищаем тексты задач
    const matchingTaskText = document.getElementById('matchingTaskText');
    if (matchingTaskText) {
        matchingTaskText.textContent = 'Сопоставьте каждый элемент с его сопоставлением.';
    }
    
    const choiceTaskText = document.getElementById('choiceTaskText');
    if (choiceTaskText) {
        choiceTaskText.textContent = 'Сопоставьте каждое утверждение с правильным ответом (правильных ответов может быть несколько).';
    }
    
    const fillBlanksTaskText = document.getElementById('fillBlanksTaskText');
    if (fillBlanksTaskText) {
        fillBlanksTaskText.textContent = 'Вставьте подходящее по смыслу слово в каждое предложение.';
    }
    
    // Перерендериваем пустые контейнеры
    renderMatchingItems();
    renderMatchingTargets();
    renderMatchingTable();
    renderChoiceStatements();
    renderFillBlanksWords();
    renderFillBlanksSentences();
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
    else if (currentExerciseType === 'fill_blanks') {
        const currentState = {
            words: JSON.parse(JSON.stringify(fillBlanksWords)),
            sentences: JSON.parse(JSON.stringify(fillBlanksSentences)),
            taskText: document.getElementById('fillBlanksTaskText')?.textContent || ''
        };
        
        if (!originalExerciseState || originalExerciseState.type !== 'fill_blanks') {
            hasExerciseUnsavedChanges = true;
            return true;
        }
        
        const hasChanges = 
            JSON.stringify(currentState.words) !== JSON.stringify(originalExerciseState.words) ||
            JSON.stringify(currentState.sentences) !== JSON.stringify(originalExerciseState.sentences) ||
            currentState.taskText !== originalExerciseState.taskText;
        
        hasExerciseUnsavedChanges = hasChanges;
        return hasChanges;
    }
    else if (currentExerciseType === 'test') {
    // Проверяем только изменения в упражнениях (контенте теста)
    // Игнорируем дедлайн и время прохождения
    
    if (!originalExerciseState || originalExerciseState.type !== 'test') {
        hasExerciseUnsavedChanges = false;
        return false;
    }
    
    // Сравниваем только exercises (содержимое теста)
    const currentExercises = JSON.parse(JSON.stringify(currentTestData.exercises));
    const savedExercises = JSON.parse(JSON.stringify(originalExerciseState.data?.exercises || []));
    
    const exercisesChanged = JSON.stringify(currentExercises) !== JSON.stringify(savedExercises);
    
    hasExerciseUnsavedChanges = exercisesChanged;
    return exercisesChanged;
}
}

// Подсветка поля с ошибкой для choice
function highlightChoiceError(targetId) {
    const element = document.getElementById(targetId);
    if (element) {
        element.classList.add('error-highlight');
    } else {
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
    document.querySelectorAll('.statement-input.error-highlight').forEach(el => {
        el.classList.remove('error-highlight');
    });
    document.querySelectorAll('.answer-input.error-highlight').forEach(el => {
        el.classList.remove('error-highlight');
    });
    document.querySelectorAll('.answers-section.error-highlight').forEach(el => {
        el.classList.remove('error-highlight');
    });
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
                    }  else if (section.type === 'test') {
                        loadTestSection(section.id);
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
                }   else if (section.type === 'test') {
                        // Очищаем предыдущие данные
                        currentTestData = {
                            deadline: '',
                            timeLimit: { enabled: true, days: 0, hours: 1, minutes: 0 },
                            exercises: []
                        };
                        nextTestExerciseId = 1;
                        loadTestSection(sectionId);
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
            resetExerciseData();
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
// ========== ДИАЛОГ ПОДТВЕРЖДЕНИЯ ==========
function showConfirmDialog(title, message, onConfirm, onCancel) {
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
                <button class="confirm-dialog-btn confirm-dialog-btn-confirm">Продолжить</button>
            </div>
        </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" });
    gsap.fromTo(dialog, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "backOut" });
    
    const cancelBtn = dialog.querySelector('.confirm-dialog-btn-cancel');
    const confirmBtn = dialog.querySelector('.confirm-dialog-btn-confirm');
    
    cancelBtn.addEventListener('click', () => {
        closeConfirmDialog(overlay);
        if (onCancel) onCancel();
    });
    
    confirmBtn.addEventListener('click', () => {
        closeConfirmDialog(overlay);
        if (onConfirm) onConfirm();
    });
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeConfirmDialog(overlay);
            if (onCancel) onCancel();
        }
    });
    
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeConfirmDialog(overlay);
            if (onCancel) onCancel();
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
            background-color: #379B34;
            color: white;
        }
        .confirm-dialog-btn-confirm:hover {
            background-color: #30842d;
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
            const testEditorContainer = document.getElementById('testEditorContainer');
            
            if (exerciseEditorContainer) exerciseEditorContainer.style.display = 'none';
            if (editorContainer) editorContainer.style.display = 'block';
            if (sectionsAreaEl) sectionsAreaEl.style.display = 'none';
            if (welcomeScreenEl) welcomeScreenEl.style.display = 'none';
            if (testEditorContainer) testEditorContainer.style.display = 'none';
            
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
                performBackToSections();  // ← ЭТА ФУНКЦИЯ НЕ ОПРЕДЕЛЕНА!
            }
        );
        return;
    }
    
    performBackToSections();  // ← И ЗДЕСЬ ТОЖЕ
}

function performBackToSections() {
    const editorContainer = document.getElementById('theoryEditorContainer');
    const sectionsAreaEl = document.getElementById('sectionsArea');
    const welcomeScreenEl = document.getElementById('welcomeScreen');
    
    if (editorContainer) editorContainer.style.display = 'none';
    
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
    
    currentEditingTheorySection = null;
    originalTheoryText = '';
    hasUnsavedChanges = false;
}

function performBackToSectionsFromTest() {
    const testEditorContainer = document.getElementById('testEditorContainer');
    const sectionsAreaEl = document.getElementById('sectionsArea');
    const welcomeScreenEl = document.getElementById('welcomeScreen');
    
    if (testEditorContainer) testEditorContainer.style.display = 'none';
    
    if (currentBlock && sectionsAreaEl) {
        sectionsAreaEl.style.display = 'block';
        welcomeScreenEl.style.display = 'none';
        
        currentBlockTitle.textContent = currentBlock.title;
        currentBlockDescription.textContent = currentBlock.description;
        
        // Перезагружаем разделы из currentCourse
        if (currentCourse) {
            for (const theme of currentCourse.themes) {
                const block = theme.blocks?.find(b => b.id === currentBlock.id);
                if (block && block.sections) {
                    currentSections = block.sections;
                    break;
                }
            }
        }
        
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
    // НЕ сбрасываем hasExerciseUnsavedChanges и originalExerciseState здесь!
    // hasExerciseUnsavedChanges = false; // ← удалить или закомментировать
    // originalExerciseState = null; // ← удалить или закомментировать
}

function performBlockSwitch(clickedBlockId, blockTitle, blockDescription) {
    hasUnsavedChanges = false;
    currentEditingTheorySection = null;
    originalTheoryText = '';
    
    // Скрываем все редакторы
    const theoryEditorContainer = document.getElementById('theoryEditorContainer');
    const exerciseEditorContainer = document.getElementById('exerciseEditorContainer');
    const testEditorContainer = document.getElementById('testEditorContainer');
    
    if (theoryEditorContainer) theoryEditorContainer.style.display = 'none';
    if (exerciseEditorContainer) exerciseEditorContainer.style.display = 'none';
    if (testEditorContainer) testEditorContainer.style.display = 'none';
    
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

// Переключение типа упражнения с проверкой на потерю данных
function switchExerciseType(newType) {
    let hasDataInCurrentType = false;
    
    if (currentExerciseType === 'matching') {
        hasDataInCurrentType = matchingItems.length > 0 || matchingTargets.length > 0 || matchingPairs.length > 0;
        if (hasExerciseUnsavedChanges) hasDataInCurrentType = true;
    } else if (currentExerciseType === 'choice') {
        hasDataInCurrentType = choiceStatements.length > 0 && choiceStatements.some(s => s.text.trim() !== '' || s.answers.some(a => a.text.trim() !== ''));
        if (hasExerciseUnsavedChanges) hasDataInCurrentType = true;
    } else if (currentExerciseType === 'fill_blanks') {
        hasDataInCurrentType = fillBlanksWords.length > 0 || fillBlanksSentences.length > 0;
        if (hasExerciseUnsavedChanges) hasDataInCurrentType = true;
    }
    
    if (hasDataInCurrentType && currentEditingExerciseSection) {
        showConfirmDialog(
            'Смена типа упражнения',
            'При переключении типа упражнения все данные текущего типа будут потеряны. Вы уверены, что хотите продолжить?',
            () => {
                if (currentExerciseType === 'matching') {
                    matchingItems = [];
                    matchingTargets = [];
                    matchingPairs = [];
                    renderMatchingItems();
                    renderMatchingTargets();
                    renderMatchingTable();
                } else if (currentExerciseType === 'choice') {
                    choiceStatements = [];
                    renderChoiceStatements();
                } else if (currentExerciseType === 'fill_blanks') {
                    fillBlanksWords = [];
                    fillBlanksSentences = [];
                    renderFillBlanksWords();
                    renderFillBlanksSentences();
                }
                
                updateSelectedExerciseType(newType);
                hasExerciseUnsavedChanges = false;
                
                if (newType === 'matching') {
                    originalExerciseState = {
                        type: 'matching',
                        items: [],
                        targets: [],
                        pairs: [],
                        taskText: document.getElementById('matchingTaskText')?.textContent || ''
                    };
                } else if (newType === 'choice') {
                    originalExerciseState = {
                        type: 'choice',
                        statements: [],
                        taskText: document.getElementById('choiceTaskText')?.textContent || ''
                    };
                    choiceStatements = [{
                        id: nextStatementId++,
                        text: '',
                        answers: [{ id: nextAnswerId++, text: '', isCorrect: false }]
                    }];
                    renderChoiceStatements();
                }  else if (newType === 'fill_blanks') {
                        // Не очищаем данные, просто обновляем отображение
                        if (fillBlanksWords.length === 0 && fillBlanksSentences.length === 0) {
                            // Только если нет данных, создаем пустые
                            fillBlanksWords = [];
                            fillBlanksSentences = [];
                        }
                        renderFillBlanksWords();
                        renderFillBlanksSentences();
                    }
                
                showNotification(`Тип упражнения изменен на "${newType === 'matching' ? 'Сопоставление' : newType === 'choice' ? 'Выбор правильного' : 'Дополнение'}"`, 'info');
            }
        );
    } else {
        updateSelectedExerciseType(newType);
        
        if (newType === 'choice' && choiceStatements.length === 0) {
            choiceStatements = [{
                id: nextStatementId++,
                text: '',
                answers: [{ id: nextAnswerId++, text: '', isCorrect: false }]
            }];
            renderChoiceStatements();
        }
    }
}

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
                    taskText.textContent = exerciseData.question_text || 'Сопоставьте каждый элемент с его сопоставлением.';
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
                }
                
                const taskText = document.getElementById('choiceTaskText');
                if (taskText) {
                    taskText.textContent = exerciseData.question_text || 'Сопоставьте каждое утверждение с правильным ответом (правильных ответов может быть несколько).';
                }
                
                renderChoiceStatements();
            }
            else if (currentExerciseType === 'fill_blanks') {
                const fillBlanksData = exerciseData.options || {};
                fillBlanksWords = fillBlanksData.words || [];
                fillBlanksSentences = fillBlanksData.sentences || [];
                
                if (fillBlanksWords.length > 0) {
                    nextWordId = Math.max(...fillBlanksWords.map(w => parseInt(w.id) || 0)) + 1;
                } else {
                    nextWordId = 1;
                }
                
                if (fillBlanksSentences.length > 0) {
                    nextSentenceId = Math.max(...fillBlanksSentences.map(s => parseInt(s.id) || 0)) + 1;
                } else {
                    nextSentenceId = 1;
                }
                
                const taskText = document.getElementById('fillBlanksTaskText');
                if (taskText) {
                    taskText.textContent = exerciseData.question_text || 'Вставьте подходящее по смыслу слово в каждое предложение.';
                }
                
                renderFillBlanksWords();
                renderFillBlanksSentences();
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
            } else if (currentExerciseType === 'fill_blanks') {
                originalExerciseState = {
                    type: 'fill_blanks',
                    words: JSON.parse(JSON.stringify(fillBlanksWords)),
                    sentences: JSON.parse(JSON.stringify(fillBlanksSentences)),
                    taskText: document.getElementById('fillBlanksTaskText')?.textContent || ''
                };
            }
            hasExerciseUnsavedChanges = false;
            
            const exerciseEditorContainer = document.getElementById('exerciseEditorContainer');
            const sectionsAreaEl = document.getElementById('sectionsArea');
            const welcomeScreenEl = document.getElementById('welcomeScreen');
            const theoryEditorContainer = document.getElementById('theoryEditorContainer');
            const testEditorContainer = document.getElementById('testEditorContainer');
            
            if (theoryEditorContainer) theoryEditorContainer.style.display = 'none';
            if (exerciseEditorContainer) exerciseEditorContainer.style.display = 'block';
            if (sectionsAreaEl) sectionsAreaEl.style.display = 'none';
            if (welcomeScreenEl) welcomeScreenEl.style.display = 'none';
            if (testEditorContainer) testEditorContainer.style.display = 'none'; 
            
        } else {
            showNotification('Ошибка загрузки раздела', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка загрузки раздела', 'error');
    }
}

// Сохранение упражнения
// Сохранение упражнения
async function saveExerciseSection() {
    if (!currentEditingExerciseSection) {
        showNotification('Раздел не выбран', 'error');
        return;
    }
    
    let exerciseData = {};
    let taskText = '';
    
    if (currentExerciseType === 'matching') {
        taskText = document.getElementById('matchingTaskText')?.textContent || 'Сопоставьте каждый элемент с его сопоставлением.';
        
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
        
        clearAllChoiceErrors();
        
        let hasError = false;
        let errorMessage = '';
        
        for (let i = 0; i < choiceStatements.length; i++) {
            const statement = choiceStatements[i];
            const statementNumber = i + 1;
            
            if (!statement.text.trim()) {
                errorMessage = `Утверждение ${statementNumber} не заполнено`;
                hasError = true;
                highlightChoiceError(`statement_${statement.id}`);
                break;
            }
            
            for (let j = 0; j < statement.answers.length; j++) {
                const answer = statement.answers[j];
                if (!answer.text.trim()) {
                    const answerLetter = String.fromCharCode(65 + j);
                    errorMessage = `У утверждения ${statementNumber} ответ ${answerLetter} не заполнен`;
                    hasError = true;
                    highlightChoiceError(`answer_${answer.id}`);
                    break;
                }
            }
            if (hasError) break;
            
            const hasCorrectAnswer = statement.answers.some(a => a.isCorrect === true);
            if (!hasCorrectAnswer) {
                errorMessage = `У утверждения ${statementNumber} не выбран правильный ответ`;
                hasError = true;
                highlightChoiceError(`answers_section_${statement.id}`);
                break;
            }
        }
        
        if (hasError) {
            showNotification(errorMessage, 'warning');
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
        taskText = document.getElementById('fillBlanksTaskText')?.textContent || 'Вставьте подходящее по смыслу слово в каждое предложение.';
        
        // Очищаем старые подсветки
        clearAllFillBlanksErrors();
        
        let hasError = false;
        let errorMessage = '';
        
        // Проверка 1: есть ли слова для справки
        if (fillBlanksWords.length === 0) {
            showNotification('Добавьте хотя бы одно слово для справки', 'warning');
            return;
        }
        
        // Проверка 2: есть ли хотя бы одно предложение
        if (fillBlanksSentences.length === 0) {
            showNotification('Добавьте хотя бы одно предложение', 'warning');
            return;
        }
        
        // Проверка 3: все ли слова заполнены (не пустые)
        for (let i = 0; i < fillBlanksWords.length; i++) {
            const word = fillBlanksWords[i];
            if (!word.text.trim()) {
                errorMessage = `Слово ${i + 1} не заполнено`;
                hasError = true;
                highlightFillBlanksError(`word_${word.id}`);
                break;
            }
        }
        if (hasError) {
            showNotification(errorMessage, 'warning');
            setTimeout(() => clearAllFillBlanksErrors(), 3000);
            return;
        }
        
        // Проверка 4: все ли предложения имеют текст
        for (let i = 0; i < fillBlanksSentences.length; i++) {
            const sentence = fillBlanksSentences[i];
            if (!sentence.text.trim()) {
                errorMessage = `Предложение ${i + 1} не заполнено`;
                hasError = true;
                highlightFillBlanksError(`sentence_textarea_${sentence.id}`);
                break;
            }
        }
        if (hasError) {
            showNotification(errorMessage, 'warning');
            setTimeout(() => clearAllFillBlanksErrors(), 3000);
            return;
        }
        
        // Проверка 5: в каждом предложении должен быть хотя бы один пропуск
        for (let i = 0; i < fillBlanksSentences.length; i++) {
            const sentence = fillBlanksSentences[i];
            const blankCountInText = (sentence.text.match(/_______/g) || []).length;
            
            if (blankCountInText === 0) {
                errorMessage = `В предложении ${i + 1} нет ни одного пропуска. Добавьте пропуск с помощью кнопки "Вставить пропуск"`;
                hasError = true;
                highlightFillBlanksError(`sentence_textarea_${sentence.id}`);
                break;
            }
        }
        if (hasError) {
            showNotification(errorMessage, 'warning');
            setTimeout(() => clearAllFillBlanksErrors(), 3000);
            return;
        }
        
        // Проверка 6: количество пропусков в тексте соответствует количеству ответов
        for (let i = 0; i < fillBlanksSentences.length; i++) {
            const sentence = fillBlanksSentences[i];
            const blanks = sentence.correctAnswers || [];
            const blankCountInText = (sentence.text.match(/_______/g) || []).length;
            
            if (blankCountInText !== blanks.length) {
                errorMessage = `В предложении ${i + 1} количество пропусков (${blankCountInText}) не соответствует количеству ответов (${blanks.length})`;
                hasError = true;
                highlightFillBlanksError(`sentence_textarea_${sentence.id}`);
                break;
            }
        }
        if (hasError) {
            showNotification(errorMessage, 'warning');
            setTimeout(() => clearAllFillBlanksErrors(), 3000);
            return;
        }
        
        // Проверка 7: все ли пропуски имеют выбранное слово
        for (let i = 0; i < fillBlanksSentences.length; i++) {
            const sentence = fillBlanksSentences[i];
            const blanks = sentence.correctAnswers || [];
            
            for (let j = 0; j < blanks.length; j++) {
                if (!blanks[j].trim()) {
                    errorMessage = `В предложении ${i + 1} пропуск ${j + 1} не выбран (выберите слово из списка)`;
                    hasError = true;
                    highlightFillBlanksError(`blank_select_${sentence.id}_${j}`);
                    break;
                }
            }
            if (hasError) break;
        }
        if (hasError) {
            showNotification(errorMessage, 'warning');
            setTimeout(() => clearAllFillBlanksErrors(), 3000);
            return;
        }
        
        // Проверка 8: выбранные слова должны существовать в списке слов для справки
        const wordTexts = fillBlanksWords.map(w => w.text);
        for (let i = 0; i < fillBlanksSentences.length; i++) {
            const sentence = fillBlanksSentences[i];
            const blanks = sentence.correctAnswers || [];
            
            for (let j = 0; j < blanks.length; j++) {
                const selectedWord = blanks[j];
                if (!wordTexts.includes(selectedWord)) {
                    errorMessage = `В предложении ${i + 1} пропуск ${j + 1} содержит слово "${selectedWord}", которого нет в списке слов для справки`;
                    hasError = true;
                    highlightFillBlanksError(`blank_select_${sentence.id}_${j}`);
                    break;
                }
            }
            if (hasError) break;
        }
        if (hasError) {
            showNotification(errorMessage, 'warning');
            setTimeout(() => clearAllFillBlanksErrors(), 3000);
            return;
        }
        
        exerciseData = {
            title: currentEditingExerciseSection.title,
            exercise_type: 'fill_blanks',
            question_text: taskText,
            options: {
                words: fillBlanksWords,
                sentences: fillBlanksSentences
            }
        };
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
            } else if (currentExerciseType === 'fill_blanks') {
                originalExerciseState = {
                    type: 'fill_blanks',
                    words: JSON.parse(JSON.stringify(fillBlanksWords)),
                    sentences: JSON.parse(JSON.stringify(fillBlanksSentences)),
                    taskText: document.getElementById('fillBlanksTaskText')?.textContent || ''
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

// Подсветка ошибок для fill_blanks
// Подсветка ошибок для fill_blanks
function highlightFillBlanksError(targetId) {
    if (targetId.startsWith('word_')) {
        const wordId = targetId.replace('word_', '');
        const wordChip = document.querySelector(`.word-chip[data-word-id="${wordId}"]`);
        if (wordChip) {
            wordChip.classList.add('error-highlight');
        }
    } else if (targetId.startsWith('sentence_textarea_')) {
        const sentenceId = targetId.replace('sentence_textarea_', '');
        const textarea = document.querySelector(`.sentence-textarea[data-sentence-id="${sentenceId}"]`);
        if (textarea) textarea.classList.add('error-highlight');
    } else if (targetId.startsWith('blank_select_')) {
        const [sentenceId, blankIndex] = targetId.replace('blank_select_', '').split('_');
        const blankSelect = document.querySelector(`.blank-select-wrapper[data-sentence-id="${sentenceId}"][data-blank-index="${blankIndex}"]`);
        if (blankSelect) {
            const btn = blankSelect.querySelector('.blank-select-btn');
            if (btn) btn.classList.add('error-highlight');
        }
    }
}

// Очистка подсветок ошибок для fill_blanks
function clearAllFillBlanksErrors() {
    document.querySelectorAll('.word-chip.error-highlight').forEach(el => {
        el.classList.remove('error-highlight');
    });
    document.querySelectorAll('.sentence-textarea.error-highlight').forEach(el => {
        el.classList.remove('error-highlight');
    });
    document.querySelectorAll('.blank-select-btn.error-highlight').forEach(el => {
        el.classList.remove('error-highlight');
    });
}

// Добавление слова
function addFillBlanksWord() {
    if (fillBlanksWords.length >= 30) {
        showNotification('Максимум 30 слов', 'warning');
        return;
    }
    
    fillBlanksWords.push({
        id: nextWordId++,
        text: ''
    });
    
    renderFillBlanksWords();
    // Фокус на новое поле
    setTimeout(() => {
        const lastInput = document.querySelector('.word-chip:last-child .word-input');
        if (lastInput) lastInput.focus();
    }, 50);
    checkExerciseUnsavedChanges();
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
    const testContainer = document.getElementById('testEditorContainer');
    
    if (matchingContainer) matchingContainer.style.display = type === 'matching' ? 'block' : 'none';
    if (choiceContainer) choiceContainer.style.display = type === 'choice' ? 'block' : 'none';
    if (fillBlanksContainer) fillBlanksContainer.style.display = type === 'fill_blanks' ? 'block' : 'none';
    if (testContainer) testContainer.style.display = type === 'test' ? 'block' : 'none';
    
    if (type === 'choice' && choiceStatements.length === 0 && currentEditingExerciseSection === null) {
        choiceStatements = [{
            id: nextStatementId++,
            text: '',
            answers: [{ id: nextAnswerId++, text: '', isCorrect: false }]
        }];
        renderChoiceStatements();
    }
    
    if (type === 'fill_blanks' && fillBlanksWords.length === 0 && fillBlanksSentences.length === 0 && currentEditingExerciseSection === null) {
        fillBlanksWords = [];
        fillBlanksSentences = [];
        renderFillBlanksWords();
        renderFillBlanksSentences();
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
        return `
            <div class="statement-card" data-statement-id="${statement.id}">
                <div class="statement-header">
                    <div class="statement-number">${stmtIdx + 1}.</div>
                    <input type="text" class="statement-input" value="${escapeHtml(statement.text)}" placeholder="Введите утверждение">
                    <button class="delete-statement-btn" onclick="deleteChoiceStatement('${statement.id}')">
                        <img src="/images/taskCreationPage/delete.svg" alt="Удалить" class="delete-statement-icon">
                    </button>
                </div>
                <div class="answers-section">
                    <div class="answers-header">Ответы (правильных может быть несколько):</div>
                    <div class="answers-list">
                        ${statement.answers.map((answer, ansIdx) => `
                            <div class="answer-row" data-answer-id="${answer.id}">
                                <div class="radio-btn ${answer.isCorrect ? 'selected' : ''}" data-correct="${answer.isCorrect}" onclick="toggleCorrectAnswer('${statement.id}', '${answer.id}')"></div>
                                <div class="answer-number">${String.fromCharCode(65 + ansIdx)}.</div>
                                <input type="text" class="answer-input" value="${escapeHtml(answer.text)}" placeholder="Введите ответ">
                                <button class="delete-answer-btn" onclick="deleteChoiceAnswer('${statement.id}', '${answer.id}')">
                                    <img src="/images/taskCreationPage/delete.svg" alt="Удалить" class="delete-answer-icon">
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    <button class="add-answer-btn" onclick="addChoiceAnswer('${statement.id}')">
                        <img src="/images/taskCreationPage/plus.svg" alt="+" class="plus-icon"> Добавить ответ
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.statement-input').forEach((input, idx) => {
        input.addEventListener('input', (e) => {
            input.classList.remove('error-highlight');
        });
        
        input.addEventListener('change', (e) => {
            choiceStatements[idx].text = e.target.value;
            checkExerciseUnsavedChanges();
        });
    });
    
    document.querySelectorAll('.answer-input').forEach((input) => {
        const answerRow = input.closest('.answer-row');
        const statementCard = input.closest('.statement-card');
        const statementId = statementCard.dataset.statementId;
        const answerId = answerRow.dataset.answerId;
        
        input.addEventListener('input', (e) => {
            input.classList.remove('error-highlight');
        });
        
        input.addEventListener('change', (e) => {
            const statement = choiceStatements.find(s => s.id == statementId);
            const answer = statement?.answers.find(a => a.id == answerId);
            if (answer) {
                answer.text = e.target.value;
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

// ===== ФУНКЦИИ ДЛЯ ДОПОЛНЕНИЯ (FILL BLANKS) =====

// Рендер слов для справки
function renderFillBlanksWords() {
    const wordsList = document.getElementById('fillBlanksWordsList');
    const wordsCounter = document.getElementById('wordsCounter');
    
    if (!wordsList) return;
    
    if (fillBlanksWords.length === 0) {
        wordsList.innerHTML = '<div class="empty-message" style="padding: 20px; text-align: center;">Нет слов. Добавьте первое слово.</div>';
        return;
    }
    
    wordsList.innerHTML = fillBlanksWords.map((word) => `
        <div class="word-chip" data-word-id="${word.id}">
            <input type="text" class="word-input" value="${escapeHtml(word.text)}" placeholder="Введите слово">
            <button class="delete-word-btn" onclick="deleteFillBlanksWord('${word.id}')">
                <img src="/images/taskCreationPage/delete.svg" alt="Удалить" class="delete-word-icon">
            </button>
        </div>
    `).join('');
    
    document.querySelectorAll('.word-input').forEach((input, idx) => {
        input.addEventListener('change', (e) => {
            const value = e.target.value.trim();
            if (value) {
                fillBlanksWords[idx].text = value;
                renderFillBlanksSentences();
                checkExerciseUnsavedChanges();
            } else {
                // Если поле пустое, восстанавливаем предыдущее значение или удаляем слово
                if (fillBlanksWords[idx].text) {
                    e.target.value = fillBlanksWords[idx].text;
                } else {
                    // Если слово было пустым и пользователь не ввел текст - удаляем его
                    if (fillBlanksWords.length > 1) {
                        fillBlanksWords.splice(idx, 1);
                        renderFillBlanksWords();
                        renderFillBlanksSentences();
                    } else {
                        showNotification('Должно быть хотя бы одно слово для справки', 'warning');
                        e.target.value = '';
                    }
                }
                checkExerciseUnsavedChanges();
            }
        });
        
        // Добавляем проверку при потере фокуса
        input.addEventListener('blur', (e) => {
            const value = e.target.value.trim();
            if (!value && fillBlanksWords.length > 1) {
                fillBlanksWords.splice(idx, 1);
                renderFillBlanksWords();
                renderFillBlanksSentences();
                checkExerciseUnsavedChanges();
            } else if (!value && fillBlanksWords.length === 1) {
                showNotification('Должно быть хотя бы одно слово для справки', 'warning');
                if (fillBlanksWords[idx].text) {
                    e.target.value = fillBlanksWords[idx].text;
                }
            }
        });
    });
    
    if (wordsCounter) {
        wordsCounter.textContent = `${fillBlanksWords.length}/30 слов`;
    }
}

// Добавление слова
function addFillBlanksWord() {
    if (fillBlanksWords.length >= 30) {
        showNotification('Максимум 30 слов', 'warning');
        return;
    }
    
    fillBlanksWords.push({
        id: nextWordId++,
        text: ''
    });
    
    renderFillBlanksWords();
    checkExerciseUnsavedChanges();
}

// Удаление слова (без подтверждения)
window.deleteFillBlanksWord = function(wordId) {
    const wordIndex = fillBlanksWords.findIndex(w => w.id == wordId);
    if (wordIndex === -1) return;
    
    const deletedWordText = fillBlanksWords[wordIndex].text;
    
    fillBlanksWords.splice(wordIndex, 1);
    
    for (const sentence of fillBlanksSentences) {
        if (sentence.correctAnswers) {
            for (let i = 0; i < sentence.correctAnswers.length; i++) {
                if (sentence.correctAnswers[i] === deletedWordText) {
                    sentence.correctAnswers[i] = '';
                }
            }
        }
    }
    
    renderFillBlanksWords();
    renderFillBlanksSentences();
    checkExerciseUnsavedChanges();
};

// Рендер списка пропусков для предложения
function renderBlanksList(sentence) {
    const blanks = sentence.correctAnswers || [];
    
    if (blanks.length === 0) {
        return '<div class="empty-message" style="padding: 10px; text-align: center; font-size: 13px;">Нет пропусков. Нажмите "Вставить пропуск" чтобы добавить.</div>';
    }
    
    return blanks.map((answer, idx) => {
        const selectedWord = answer || '';
        return `
            <div class="blank-row" data-blank-index="${idx}">
                <div class="blank-number">Пропуск ${idx + 1}:</div>
                <div class="blank-select-wrapper" data-sentence-id="${sentence.id}" data-blank-index="${idx}">
                    <button class="blank-select-btn" data-sentence-id="${sentence.id}" data-blank-index="${idx}">
                        <span class="selected-text">${selectedWord ? escapeHtml(selectedWord) : '-- выберите слово --'}</span>
                        <img src="/images/taskCreationPage/chevronDown.svg" alt="toggle" class="select-chevron">
                    </button>
                    <div class="blank-select-menu" style="display: none;">
                        <button class="blank-select-option" data-value="">-- выберите слово --</button>
                        ${fillBlanksWords.map(word => `
                            <button class="blank-select-option ${selectedWord === word.text ? 'selected' : ''}" data-value="${escapeHtml(word.text)}">
                                ${escapeHtml(word.text)}
                            </button>
                        `).join('')}
                    </div>
                </div>
                <button class="delete-blank-btn" onclick="deleteBlankInSentence('${sentence.id}', ${idx})">
                    <img src="/images/taskCreationPage/delete.svg" alt="Удалить" class="delete-blank-icon">
                </button>
            </div>
        `;
    }).join('');
}

// Рендер предложений
function renderFillBlanksSentences() {
    const sentencesList = document.getElementById('fillBlanksSentencesList');
    if (!sentencesList) return;
    
    if (fillBlanksSentences.length === 0) {
        sentencesList.innerHTML = '<div class="empty-message" style="padding: 40px; text-align: center;">Нет предложений. Добавьте первое предложение.</div>';
        return;
    }
    
    sentencesList.innerHTML = fillBlanksSentences.map((sentence, idx) => {
        return `
            <div class="sentence-card" data-sentence-id="${sentence.id}">
                <div class="sentence-header">
                    <div class="sentence-number">Предложение ${idx + 1}</div>
                    <button class="delete-sentence-icon-btn" onclick="deleteFillBlanksSentence('${sentence.id}')" title="Удалить предложение">
                        <img src="/images/taskCreationPage/delete.svg" alt="Удалить" class="delete-icon">
                    </button>
                </div>
                <div class="sentence-textarea-wrapper">
                    <textarea class="sentence-textarea" data-sentence-id="${sentence.id}" placeholder="Введите текст предложения...">${escapeHtml(sentence.text)}</textarea>
                    <button class="insert-blank-btn" onclick="insertBlankInSentence('${sentence.id}')">
                        <img src="/images/taskCreationPage/plus.svg" alt="+" class="plus-icon"> Вставить пропуск
                    </button>
                </div>
                <div class="blanks-section">
                    <div class="blanks-title">Выберите правильные слова для каждого пропуска:</div>
                    <div class="blanks-list" id="blanks-list-${sentence.id}">
                        ${renderBlanksList(sentence)}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.sentence-textarea').forEach(textarea => {
        const sentenceId = textarea.dataset.sentenceId;
        
        autoResizeTextarea(textarea);
        
        // Сохраняем исходный текст для проверки
        let lastValidText = fillBlanksSentences.find(s => s.id == sentenceId)?.text || '';
        
        textarea.addEventListener('input', (e) => {
            const sentence = fillBlanksSentences.find(s => s.id == sentenceId);
            if (!sentence) return;
            
            const newText = e.target.value;
            const oldText = sentence.text;
            
            // Проверяем, не были ли удалены пропуски
            const oldBlankCount = (oldText.match(/_______/g) || []).length;
            const newBlankCount = (newText.match(/_______/g) || []).length;
            
            if (newBlankCount < oldBlankCount) {
                // Попытка удалить пропуск - восстанавливаем старый текст
                e.target.value = oldText;
                showNotification('Пропуск можно удалить только через кнопку "Удалить"', 'warning');
                return;
            }
            
            // Проверяем, не изменились ли существующие пропуски
            const oldBlanks = [];
            const newBlanks = [];
            let match;
            const blankPattern = /_______/g;
            
            while ((match = blankPattern.exec(oldText)) !== null) {
                oldBlanks.push(match.index);
            }
            while ((match = blankPattern.exec(newText)) !== null) {
                newBlanks.push(match.index);
            }
            
            // Если количество пропусков совпадает, но позиции изменились - восстанавливаем
            if (oldBlankCount === newBlankCount && oldBlankCount > 0) {
                let positionsChanged = false;
                for (let i = 0; i < oldBlankCount; i++) {
                    if (Math.abs(oldBlanks[i] - newBlanks[i]) > 10) {
                        positionsChanged = true;
                        break;
                    }
                }
                if (positionsChanged) {
                    e.target.value = oldText;
                    showNotification('Нельзя перемещать или изменять пропуски. Используйте кнопку "Удалить" для удаления пропуска.', 'warning');
                    return;
                }
            }
            
            sentence.text = newText;
            lastValidText = newText;
            checkExerciseUnsavedChanges();
            autoResizeTextarea(textarea);
        });
        
        textarea.addEventListener('blur', (e) => {
            const sentence = fillBlanksSentences.find(s => s.id == sentenceId);
            if (sentence) {
                let text = sentence.text;
                let changed = false;
                
                text = text.replace(/([^\s])_______/g, '$1 _______');
                text = text.replace(/_______([^\s])/g, '_______ $1');
                text = text.replace(/\s+/g, ' ');
                
                if (text !== sentence.text) {
                    sentence.text = text;
                    e.target.value = text;
                    renderFillBlanksSentences();
                    checkExerciseUnsavedChanges();
                }
            }
            autoResizeTextarea(textarea);
        });
    });
    
    setTimeout(() => {
        initFillBlanksInputHandlers();
    }, 0);
}

// Добавление предложения
function addFillBlanksSentence() {
    if (fillBlanksSentences.length >= 10) {
        showNotification('Максимум 10 предложений', 'warning');
        return;
    }
    
    fillBlanksSentences.push({
        id: nextSentenceId++,
        text: '',
        correctAnswers: []
    });
    
    renderFillBlanksSentences();
    checkExerciseUnsavedChanges();
}

// Удаление предложения (без подтверждения)
window.deleteFillBlanksSentence = function(sentenceId) {
    const sentenceIndex = fillBlanksSentences.findIndex(s => s.id == sentenceId);
    if (sentenceIndex !== -1) {
        fillBlanksSentences.splice(sentenceIndex, 1);
        renderFillBlanksSentences();
        checkExerciseUnsavedChanges();
    }
};

// Автоматическое изменение высоты textarea
function autoResizeTextarea(textarea) {
    if (!textarea) return;
    
    // Сбрасываем высоту, чтобы получить правильную scrollHeight
    textarea.style.height = 'auto';
    // Устанавливаем новую высоту
    const newHeight = Math.max(44, textarea.scrollHeight);
    textarea.style.height = newHeight + 'px';
}

// Вставка пропуска в предложение
// Вставка пропуска в предложение
window.insertBlankInSentence = function(sentenceId) {
    const sentence = fillBlanksSentences.find(s => s.id == sentenceId);
    if (!sentence) return;
    
    const currentBlanks = sentence.correctAnswers || [];
    if (currentBlanks.length >= 3) {
        showNotification('Максимум 3 пропуска в одном предложении', 'warning');
        return;
    }
    
    const textarea = document.querySelector(`.sentence-textarea[data-sentence-id="${sentenceId}"]`);
    if (!textarea) return;
    
    const cursorPos = textarea.selectionStart;
    let textBefore = sentence.text.substring(0, cursorPos);
    let textAfter = sentence.text.substring(cursorPos);
    
    if (textBefore.length > 0 && textBefore[textBefore.length - 1] !== ' ') {
        textBefore += ' ';
    }
    
    if (textAfter.length > 0 && textAfter[0] !== ' ') {
        textAfter = ' ' + textAfter;
    }
    
    sentence.text = textBefore + '_______' + textAfter;
    
    if (!sentence.correctAnswers) sentence.correctAnswers = [];
    sentence.correctAnswers.push('');
    
    textarea.value = sentence.text;
    
    const newCursorPos = textBefore.length + 7;
    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        autoResizeTextarea(textarea);
    }, 10);
    
    renderFillBlanksSentences();
    checkExerciseUnsavedChanges();
};

// Проверка и исправление пробелов вокруг всех пропусков в предложении
function normalizeBlanksSpacing(sentenceId) {
    const sentence = fillBlanksSentences.find(s => s.id == sentenceId);
    if (!sentence) return;
    
    let text = sentence.text;
    let changed = false;
    
    // Проверяем каждый пропуск
    let searchPos = 0;
    let blankIndex = 0;
    const blankPattern = /_______/g;
    let match;
    const matches = [];
    
    while ((match = blankPattern.exec(text)) !== null) {
        matches.push({ index: match.index, length: 7 });
    }
    
    // Проходим с конца, чтобы не сбивать индексы
    for (let i = matches.length - 1; i >= 0; i--) {
        const pos = matches[i].index;
        const beforeChar = pos > 0 ? text[pos - 1] : null;
        const afterChar = pos + 7 < text.length ? text[pos + 7] : null;
        
        let newText = text;
        
        // Добавляем пробел слева если нужно
        if (beforeChar && beforeChar !== ' ') {
            newText = newText.substring(0, pos) + ' ' + newText.substring(pos);
            changed = true;
        }
        // Добавляем пробел справа если нужно
        if (afterChar && afterChar !== ' ') {
            const adjustedPos = pos + (changed ? 8 : 7);
            newText = newText.substring(0, adjustedPos) + ' ' + newText.substring(adjustedPos);
            changed = true;
        }
        
        text = newText;
    }
    
    // Удаляем двойные пробелы если появились
    text = text.replace(/\s+/g, ' ');
    
    if (changed) {
        sentence.text = text;
        const textarea = document.querySelector(`.sentence-textarea[data-sentence-id="${sentenceId}"]`);
        if (textarea) {
            textarea.value = text;
        }
        renderFillBlanksSentences();
        checkExerciseUnsavedChanges();
    }
}

// Удаление пропуска из предложения (без подтверждения)
window.deleteBlankInSentence = function(sentenceId, blankIndex) {
    const sentence = fillBlanksSentences.find(s => s.id == sentenceId);
    if (!sentence) return;
    
    const blanks = sentence.correctAnswers || [];
    if (blankIndex >= blanks.length) return;
    
    let blankCount = 0;
    let newText = sentence.text;
    let foundIndex = -1;
    
    for (let i = 0; i < newText.length; i++) {
        if (newText.substring(i, i + 7) === '_______') {
            if (blankCount === blankIndex) {
                foundIndex = i;
                break;
            }
            blankCount++;
            i += 6;
        }
    }
    
    if (foundIndex !== -1) {
        let before = newText.substring(0, foundIndex);
        let after = newText.substring(foundIndex + 7);
        
        if (before.endsWith(' ') && after.startsWith(' ')) {
            before = before.slice(0, -1);
        } else if (before.endsWith(' ')) {
            before = before.slice(0, -1);
        } else if (after.startsWith(' ')) {
            after = after.slice(1);
        }
        
        newText = before + after;
        sentence.text = newText;
    }
    
    blanks.splice(blankIndex, 1);
    sentence.correctAnswers = blanks;
    
    const textarea = document.querySelector(`.sentence-textarea[data-sentence-id="${sentenceId}"]`);
    if (textarea) {
        textarea.value = newText;
        autoResizeTextarea(textarea);
    }
    
    renderFillBlanksSentences();
    checkExerciseUnsavedChanges();
};

// Обновление обработчиков для blank-select
function initFillBlanksInputHandlers() {
    // Обработчики для кастомных select'ов
    document.querySelectorAll('.blank-select-btn').forEach(btn => {
        // Удаляем старые обработчики
        btn.removeEventListener('click', handleBlankSelectClick);
        btn.addEventListener('click', handleBlankSelectClick);
    });
    
    // Обработчики для опций
    document.querySelectorAll('.blank-select-option').forEach(option => {
        option.removeEventListener('click', handleBlankSelectOptionClick);
        option.addEventListener('click', handleBlankSelectOptionClick);
    });
}

function handleBlankSelectClick(e) {
    e.stopPropagation();
    const wrapper = this.closest('.blank-select-wrapper');
    const menu = wrapper.querySelector('.blank-select-menu');
    const isOpen = menu.style.display === 'block';
    
    // Закрываем все другие меню
    document.querySelectorAll('.blank-select-menu').forEach(m => {
        m.style.display = 'none';
    });
    document.querySelectorAll('.blank-select-btn').forEach(b => {
        b.classList.remove('active');
    });
    
    if (!isOpen) {
        menu.style.display = 'block';
        this.classList.add('active');
    }
}

function handleBlankSelectOptionClick(e) {
    e.stopPropagation();
    const option = this;
    const value = option.dataset.value;
    const text = option.textContent;
    const wrapper = option.closest('.blank-select-wrapper');
    const btn = wrapper.querySelector('.blank-select-btn');
    const menu = wrapper.querySelector('.blank-select-menu');
    const sentenceId = wrapper.dataset.sentenceId;
    const blankIndex = parseInt(wrapper.dataset.blankIndex);
    
    // Обновляем текст кнопки
    btn.querySelector('.selected-text').textContent = text;
    
    // Закрываем меню
    menu.style.display = 'none';
    btn.classList.remove('active');
    
    // Обновляем данные
    const sentence = fillBlanksSentences.find(s => s.id == sentenceId);
    if (sentence && sentence.correctAnswers) {
        sentence.correctAnswers[blankIndex] = value;
        checkExerciseUnsavedChanges();
    }
    
    // Обновляем класс selected для опций
    wrapper.querySelectorAll('.blank-select-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    option.classList.add('selected');
}

// Закрытие всех меню при клике вне
document.addEventListener('click', () => {
    document.querySelectorAll('.blank-select-menu').forEach(menu => {
        menu.style.display = 'none';
    });
    document.querySelectorAll('.blank-select-btn').forEach(btn => {
        btn.classList.remove('active');
    });
});

function handleBlankSelectChange(e) {
    const sentenceId = e.target.dataset.sentenceId;
    const blankIndex = parseInt(e.target.dataset.blankIndex);
    const sentence = fillBlanksSentences.find(s => s.id == sentenceId);
    if (sentence && sentence.correctAnswers) {
        sentence.correctAnswers[blankIndex] = e.target.value;
        checkExerciseUnsavedChanges();
    }
}

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

// ===== ФУНКЦИИ ДЛЯ ИТОГОВОГО ТЕСТА =====

// Загрузка раздела теста
async function loadTestSection(sectionId) {
    console.log('loadTestSection called, current originalExerciseState before:', originalExerciseState);
    isLoadingTest = true;
    try {
        // Сбрасываем данные перед загрузкой нового раздела
        currentTestData = {
            deadline: '',
            timeLimit: { enabled: true, days: 0, hours: 1, minutes: 0 },
            exercises: []
        };
        nextTestExerciseId = 1;
        
        const token = getToken();
        const response = await fetch(`${apiBaseUrl}/sections/${sectionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const section = data.section;
            currentEditingExerciseSection = section;
            currentExerciseType = 'test';
            
            // Обновляем заголовок
            const testTitleEl = document.getElementById('currentTestTitle');
            if (testTitleEl) {
                testTitleEl.textContent = section.title;
            }
            
            // Находим и обновляем текущий блок
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
            
            // Обновляем активный блок в сайдбаре
            document.querySelectorAll('.block-item').forEach(el => el.classList.remove('active'));
            const activeBlock = document.querySelector(`.block-item[data-block-id="${blockIdFromSection}"]`);
            if (activeBlock) activeBlock.classList.add('active');
            
            // Обновляем заголовок блока
            currentBlockTitle.textContent = currentBlock.title;
            currentBlockDescription.textContent = currentBlock.description;
            
            // Загружаем данные теста из БД
            const testData = section.test || {};
            
            // Получаем deadline - ИСПРАВЛЕНИЕ ЧАСОВОГО ПОЯСА
            const dbDeadline = testData.deadline || '';
            let formattedDeadline = '';
            if (dbDeadline) {
                const date = new Date(dbDeadline);
                if (!isNaN(date.getTime())) {
                    // Добавляем поправку на часовой пояс
                    const offset = date.getTimezoneOffset();
                    const localDate = new Date(date.getTime() - offset * 60000);
                    formattedDeadline = localDate.toISOString().slice(0, 16);
                }
            }
            
            // Получаем time_limit (в минутах) из БД
            const dbTimeLimit = testData.time_limit;
            
            // Определяем состояние чекбокса и полей времени
            let isNoTimeLimit = true; // true = без времени
            let days = 0, hours = 0, minutes = 0;
            
            if (dbTimeLimit !== null && dbTimeLimit !== undefined && dbTimeLimit > 0) {
                isNoTimeLimit = false;
                const totalMinutes = dbTimeLimit;
                days = Math.floor(totalMinutes / (24 * 60));
                hours = Math.floor((totalMinutes % (24 * 60)) / 60);
                minutes = totalMinutes % 60;
            }
            
            // Получаем exercises и восстанавливаем scoring (особенно subsequentAttempts)
            const exercises = (testData.exercises || []).map(ex => ({
                id: ex.id,
                type: ex.type,
                title: ex.title,
                data: ex.data || {},
                scoring: {
                    firstAttempt: ex.scoring?.firstAttempt ?? 100,
                    secondAttempt: ex.scoring?.secondAttempt ?? 80,
                    thirdAttempt: ex.scoring?.thirdAttempt ?? 60,
                    subsequentAttempts: ex.scoring?.subsequentAttempts ?? 40
                }
            }));
            
            // Обновляем currentTestData
            currentTestData = {
                deadline: formattedDeadline,
                timeLimit: {
                    enabled: isNoTimeLimit,
                    days: days,
                    hours: hours,
                    minutes: minutes
                },
                exercises: exercises
            };
            
            // Обновляем ID счетчик для упражнений
            if (currentTestData.exercises.length > 0) {
                nextTestExerciseId = Math.max(...currentTestData.exercises.map(e => parseInt(e.id) || 0)) + 1;
            } else {
                nextTestExerciseId = 1;
            }
            
            // Заполняем поля формы
            const deadlineInput = document.getElementById('testDeadline');
            if (deadlineInput) {
                if (window.customDateTimePicker && formattedDeadline) {
                    window.customDateTimePicker.hiddenInput.value = formattedDeadline;
                    // Обновляем отображение
                    const [datePart, timePart] = formattedDeadline.split('T');
                    const [year, month, day] = datePart.split('-');
                    const [hours, minutes] = timePart.split(':');
                    const dateStr = `${day}.${month}.${year} ${hours}:${minutes}`;
                    const span = document.querySelector('#datetimeTrigger span');
                    if (span) span.textContent = dateStr;
                    window.customDateTimePicker.selectedDate = new Date(year, month - 1, day);
                    window.customDateTimePicker.selectedHour = parseInt(hours);
                    window.customDateTimePicker.selectedMinute = parseInt(minutes);
                } else {
                    // Если нет кастомного пикера, используем обычный input
                    deadlineInput.value = formattedDeadline;
                }
            }
            
            const noTimeLimitCheckbox = document.getElementById('timelimitEnabled');
            const timelimitFields = document.getElementById('timelimitFields');
            const timelimitDaysInput = document.getElementById('timelimitDays');
            const timelimitHoursInput = document.getElementById('timelimitHours');
            const timelimitMinutesInput = document.getElementById('timelimitMinutes');
            
            if (noTimeLimitCheckbox) {
                noTimeLimitCheckbox.checked = isNoTimeLimit;
                if (timelimitFields) {
                    timelimitFields.style.display = !isNoTimeLimit ? 'flex' : 'none';
                }
            }
            if (timelimitDaysInput) timelimitDaysInput.value = days;
            if (timelimitHoursInput) timelimitHoursInput.value = hours;
            if (timelimitMinutesInput) timelimitMinutesInput.value = minutes;
            
            // Рендерим список упражнений
            renderTestExercises();
            
            // Показываем редактор теста
            const testEditorContainer = document.getElementById('testEditorContainer');
            const sectionsAreaEl = document.getElementById('sectionsArea');
            const welcomeScreenEl = document.getElementById('welcomeScreen');
            const theoryEditorContainer = document.getElementById('theoryEditorContainer');
            const exerciseEditorContainer = document.getElementById('exerciseEditorContainer');

            if (theoryEditorContainer) theoryEditorContainer.style.display = 'none';
            if (exerciseEditorContainer) exerciseEditorContainer.style.display = 'none';
            if (testEditorContainer) testEditorContainer.style.display = 'block';
            if (sectionsAreaEl) sectionsAreaEl.style.display = 'none';
            if (welcomeScreenEl) welcomeScreenEl.style.display = 'none';
            
            // Сохраняем исходное состояние для проверки изменений
            originalExerciseState = {
                type: 'test',
                data: {
                    deadline: formattedDeadline,
                    timeLimit: {
                        enabled: isNoTimeLimit,
                        days: days,
                        hours: hours,
                        minutes: minutes
                    },
                    exercises: JSON.parse(JSON.stringify(exercises))
                }
            };
            hasExerciseUnsavedChanges = false;
            
            console.log('Loaded - original state:', originalExerciseState.data);
            console.log('Loaded - form values:', {
                deadline: formattedDeadline,
                isNoTimeLimit,
                days, hours, minutes
            });
            console.log('loadTestSection finished, originalExerciseState after:', originalExerciseState);
        } else {
            showNotification('Ошибка загрузки раздела', 'error');
        }
        isLoadingTest = false;
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка загрузки раздела', 'error');
        isLoadingTest = false;
    }
}

// Рендер списка упражнений в тесте
function renderTestExercises() {
    const exercisesList = document.getElementById('testExercisesList');
    const exercisesCounter = document.getElementById('exercisesCounter');
    
    if (!exercisesList) return;
    
    if (currentTestData.exercises.length === 0) {
        exercisesList.innerHTML = '<div class="empty-message" style="padding: 40px; text-align: center;">Нет тестирований. Нажмите "Добавить тестирование".</div>';
    } else {
        exercisesList.innerHTML = currentTestData.exercises.map((exercise, idx) => {
            let typeText = '';
            switch (exercise.type) {
                case 'matching': typeText = 'Сопоставление'; break;
                case 'choice': typeText = 'Выбор правильного'; break;
                case 'fill_blanks': typeText = 'Дополнение'; break;
                default: typeText = 'Сопоставление';
            }
            
            return `
                <div class="test-exercise-card" data-exercise-id="${exercise.id}" data-exercise-index="${idx}">
                    <div class="test-exercise-header">
                        <div class="exercise-number">${idx + 1}.</div>
                        <input type="text" class="exercise-title-input" value="${escapeHtml(exercise.title)}" placeholder="Название упражнения" data-exercise-id="${exercise.id}">
                        <div class="test-type-dropdown" data-exercise-id="${exercise.id}">
                            <button class="test-type-dropdown-btn" data-exercise-id="${exercise.id}">
                                <span class="selected-type-value">${typeText}</span>
                                <img src="/images/taskCreationPage/chevronDown.svg" alt="toggle" class="dropdown-chevron">
                            </button>
                            <div class="test-type-dropdown-menu" style="display: none;">
                                <button class="test-type-option" data-type="matching" data-exercise-id="${exercise.id}">Сопоставление</button>
                                <button class="test-type-option" data-type="choice" data-exercise-id="${exercise.id}">Выбор правильного</button>
                                <button class="test-type-option" data-type="fill_blanks" data-exercise-id="${exercise.id}">Дополнение</button>
                            </div>
                        </div>
                        <div class="move-buttons">
                            <button class="move-up-btn" data-exercise-id="${exercise.id}" ${idx === 0 ? 'disabled' : ''} title="Переместить вверх">
                                ↑
                            </button>
                            <button class="move-down-btn" data-exercise-id="${exercise.id}" ${idx === currentTestData.exercises.length - 1 ? 'disabled' : ''} title="Переместить вниз">
                                ↓
                            </button>
                        </div>
                        <button class="delete-exercise-btn" onclick="deleteTestExercise('${exercise.id}')">
                            <img src="/images/taskCreationPage/delete.svg" alt="Удалить" class="delete-exercise-icon">
                        </button>
                    </div>
                    <div class="test-exercise-editor" id="test-exercise-editor-${exercise.id}">
                        ${getExerciseEditorHTML(exercise)}
                    </div>
                    <div class="test-scoring-section">
                        <div class="scoring-title">Баллы за попытки</div>
                        <div class="scoring-row">
                            <div class="scoring-field">
                                <label>1 попытка:</label>
                                <input type="number" class="scoring-input" data-exercise-id="${exercise.id}" data-attempt="1" value="${exercise.scoring?.firstAttempt ?? 100}" min="0" max="100">
                                <span>баллов</span>
                            </div>
                            <div class="scoring-field">
                                <label>2 попытка:</label>
                                <input type="number" class="scoring-input" data-exercise-id="${exercise.id}" data-attempt="2" value="${exercise.scoring?.secondAttempt ?? 50}" min="0" max="100">
                                <span>баллов</span>
                            </div>
                            <div class="scoring-field">
                                <label>3 попытка:</label>
                                <input type="number" class="scoring-input" data-exercise-id="${exercise.id}" data-attempt="3" value="${exercise.scoring?.thirdAttempt ?? 25}" min="0" max="100">
                                <span>баллов</span>
                            </div>
                            <div class="scoring-field">
                                <label>последующие попытки:</label>
                                <input type="number" class="scoring-input" data-exercise-id="${exercise.id}" data-attempt="4" value="${exercise.scoring?.subsequentAttempts ?? 0}" min="0" max="100">
                                <span>баллов</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    if (exercisesCounter) {
        exercisesCounter.textContent = `${currentTestData.exercises.length}/9 тестирований`;
    }
    
    // Добавляем обработчики
    document.querySelectorAll('.exercise-title-input').forEach(input => {
        input.removeEventListener('change', handleExerciseTitleChange);
        input.addEventListener('change', handleExerciseTitleChange);
    });
    
    // Обработчики для кастомных dropdown
    document.querySelectorAll('.test-type-dropdown-btn').forEach(btn => {
        btn.removeEventListener('click', handleTestTypeDropdownClick);
        btn.addEventListener('click', handleTestTypeDropdownClick);
    });
    
    document.querySelectorAll('.test-type-option').forEach(option => {
        option.removeEventListener('click', handleTestTypeOptionClick);
        option.addEventListener('click', handleTestTypeOptionClick);
    });
    
    document.querySelectorAll('.scoring-input').forEach(input => {
        input.removeEventListener('change', handleScoringInputChange);
        input.addEventListener('change', handleScoringInputChange);
    });

    document.querySelectorAll('.move-up-btn').forEach(btn => {
        btn.removeEventListener('click', handleMoveUp);
        btn.addEventListener('click', handleMoveUp);
    });

    document.querySelectorAll('.move-down-btn').forEach(btn => {
        btn.removeEventListener('click', handleMoveDown);
        btn.addEventListener('click', handleMoveDown);
    });

    // В renderTestExercises, после innerHTML, замените блок с обработчиками dropdown на это:

    // Обработчики для кастомных dropdown (ВАЖНО: использовать правильные селекторы)
    document.querySelectorAll('.test-type-dropdown-btn').forEach(btn => {
        btn.removeEventListener('click', handleTestTypeDropdownClick);
        btn.addEventListener('click', handleTestTypeDropdownClick);
    });

    document.querySelectorAll('.test-type-option').forEach(option => {
        option.removeEventListener('click', handleTestTypeOptionClick);
        option.addEventListener('click', handleTestTypeOptionClick);
    });
    
    // Рендерим редакторы для каждого упражнения
    currentTestData.exercises.forEach(exercise => {
        if (exercise.type === 'matching') {
            renderTestMatching(exercise.id);
        } else if (exercise.type === 'choice') {
            renderTestChoice(exercise.id);
        } else if (exercise.type === 'fill_blanks') {
            renderTestFillBlanks(exercise.id);
        }
    });
}

// Глобальные обработчики для dropdown (добавьте в конец файла, перед loadCourseData)

window.handleTestTypeDropdownClick = function(e) {
    e.stopPropagation();
    const btn = e.currentTarget;
    const dropdown = btn.closest('.test-type-dropdown');
    const menu = dropdown.querySelector('.test-type-dropdown-menu');
    const isOpen = menu.style.display === 'block';
    
    // Закрыть все другие
    document.querySelectorAll('.test-type-dropdown-menu').forEach(m => {
        m.style.display = 'none';
    });
    document.querySelectorAll('.test-type-dropdown-btn').forEach(b => {
        b.classList.remove('active');
    });
    
    if (!isOpen) {
        menu.style.display = 'block';
        btn.classList.add('active');
    }
};

function handleTestTypeOptionClick(e) {
    e.stopPropagation();
    const option = e.currentTarget;
    const newType = option.dataset.type;
    const exerciseId = option.dataset.exerciseId;
    const dropdown = option.closest('.test-type-dropdown');
    const btn = dropdown.querySelector('.test-type-dropdown-btn');
    const selectedSpan = btn.querySelector('.selected-type-value');
    
    let typeText = '';
    switch (newType) {
        case 'matching': typeText = 'Сопоставление'; break;
        case 'choice': typeText = 'Выбор правильного'; break;
        case 'fill_blanks': typeText = 'Дополнение'; break;
    }
    
    selectedSpan.textContent = typeText;
    
    // Закрыть меню
    dropdown.querySelector('.test-type-dropdown-menu').style.display = 'none';
    btn.classList.remove('active');
    
    // Обновить данные
    const exercise = currentTestData.exercises.find(e => e.id === exerciseId);
    if (exercise) {
        exercise.type = newType;
        
        // Инициализировать данные для нового типа
        if (newType === 'matching' && !exercise.items) {
            exercise.items = [{ id: 'item1', text: '' }];
            exercise.targets = [{ id: 'target1', text: '' }];
            exercise.matches = {};
        } else if (newType === 'choice' && !exercise.statements) {
            exercise.statements = [{
                id: 'stmt1',
                text: '',
                answers: [{ id: 'ans1', text: '', isCorrect: true }]
            }];
        } else if (newType === 'fill_blanks' && !exercise.words) {
            exercise.words = [{ id: 'word1', text: '' }];
            exercise.sentences = [{
                id: 'sent1',
                text: '',
                blanks: [{ id: 'blank1', correctWordId: '' }]
            }];
        }
        
        // Перерендерить редактор
        const editorContainer = document.getElementById(`test-exercise-editor-${exerciseId}`);
        if (editorContainer) {
            editorContainer.innerHTML = getExerciseEditorHTML(exercise);
            
            if (newType === 'matching') {
                renderTestMatching(exerciseId);
            } else if (newType === 'choice') {
                renderTestChoice(exerciseId);
            } else if (newType === 'fill_blanks') {
                renderTestFillBlanks(exerciseId);
            }
        }
        
        // Обновить счетчик
        const exercisesCounter = document.getElementById('exercisesCounter');
        if (exercisesCounter) {
            exercisesCounter.textContent = `${currentTestData.exercises.length}/9 тестирований`;
        }
    }
}

// Закрытие dropdown при клике вне
document.addEventListener('click', function() {
    document.querySelectorAll('.test-type-dropdown-menu').forEach(menu => {
        menu.style.display = 'none';
    });
    document.querySelectorAll('.test-type-dropdown-btn').forEach(btn => {
        btn.classList.remove('active');
    });
});

// Перемещение тестирования вверх
function moveTestExerciseUp(exerciseId) {
    const index = currentTestData.exercises.findIndex(ex => ex.id == exerciseId);
    if (index <= 0) return;
    
    // Меняем местами
    [currentTestData.exercises[index - 1], currentTestData.exercises[index]] = 
    [currentTestData.exercises[index], currentTestData.exercises[index - 1]];
    
    renderTestExercises();
    showNotification('Порядок изменен', 'info');
    checkExerciseUnsavedChanges();
}

// Перемещение тестирования вниз
function moveTestExerciseDown(exerciseId) {
    const index = currentTestData.exercises.findIndex(ex => ex.id == exerciseId);
    if (index === -1 || index >= currentTestData.exercises.length - 1) return;
    
    // Меняем местами
    [currentTestData.exercises[index], currentTestData.exercises[index + 1]] = 
    [currentTestData.exercises[index + 1], currentTestData.exercises[index]];
    
    renderTestExercises();
    showNotification('Порядок изменен', 'info');
    checkExerciseUnsavedChanges();
}

// Обработчики вынесены в отдельные функции
function handleExerciseTitleChange(e) {
    const exerciseId = e.target.dataset.exerciseId;
    const exercise = currentTestData.exercises.find(ex => ex.id == exerciseId);
    if (exercise) {
        exercise.title = e.target.value;
        checkExerciseUnsavedChanges();
    }
}

function handleExerciseTypeChange(e) {
    const exerciseId = e.target.dataset.exerciseId;
    const exercise = currentTestData.exercises.find(ex => ex.id == exerciseId);
    if (exercise && exercise.type !== e.target.value) {
        
        // Проверяем, есть ли реальные данные в текущем типе
        let hasData = false;
        
        if (exercise.type === 'matching') {
            const items = exercise.data?.items || [];
            const targets = exercise.data?.targets || [];
            hasData = items.length > 0 || targets.length > 0;
            if (!hasData && items.length > 0) {
                hasData = items.some(item => item.text && item.text.trim() !== '');
            }
            if (!hasData && targets.length > 0) {
                hasData = targets.some(target => target.text && target.text.trim() !== '');
            }
        } 
        else if (exercise.type === 'choice') {
            const statements = exercise.data?.statements || [];
            hasData = statements.length > 0;
            if (!hasData && statements.length > 0) {
                hasData = statements.some(s => 
                    (s.text && s.text.trim() !== '') || 
                    (s.answers && s.answers.some(a => a.text && a.text.trim() !== ''))
                );
            }
        } 
        else if (exercise.type === 'fill_blanks') {
            const words = exercise.data?.words || [];
            const sentences = exercise.data?.sentences || [];
            hasData = words.length > 0 || sentences.length > 0;
            if (!hasData && words.length > 0) {
                hasData = words.some(w => w.text && w.text.trim() !== '');
            }
            if (!hasData && sentences.length > 0) {
                hasData = sentences.some(s => s.text && s.text.trim() !== '');
            }
        }
        
        const newTypeValue = e.target.value;
        
        // Показываем подтверждение только если есть данные
        if (hasData) {
            showConfirmDialog(
                'Смена типа упражнения',
                'При смене типа упражнения все данные текущего типа будут потеряны. Вы уверены, что хотите продолжить?',
                () => {
                    performExerciseTypeChange(exercise, newTypeValue);
                },
                () => {
                    // Отмена - возвращаем старый тип в select
                    e.target.value = exercise.type;
                }
            );
        } else {
            // Нет данных - меняем тип без подтверждения
            performExerciseTypeChange(exercise, newTypeValue);
        }
    }
}

// Выносим логику смены типа в отдельную функцию
function performExerciseTypeChange(exercise, newType) {
    const oldType = exercise.type;
    exercise.type = newType;
    
    // Создаем правильную структуру данных для нового типа
    if (newType === 'matching') {
        if (!exercise.data) exercise.data = {};
        exercise.data.items = exercise.data.items || [];
        exercise.data.targets = exercise.data.targets || [];
        exercise.data.pairs = exercise.data.pairs || [];
        
        // Если были данные в старом формате, переносим
        if (oldType === 'matching' && exercise.items) {
            exercise.data.items = exercise.items;
            exercise.data.targets = exercise.targets;
            exercise.data.pairs = exercise.matches || [];
            delete exercise.items;
            delete exercise.targets;
            delete exercise.matches;
        }
        
        if (exercise.data.items.length === 0) {
            exercise.data.items = [{ id: Date.now() + Math.random(), text: '' }];
        }
        if (exercise.data.targets.length === 0) {
            exercise.data.targets = [{ id: Date.now() + Math.random(), text: '' }];
        }
    } 
    else if (newType === 'choice') {
        if (!exercise.data) exercise.data = {};
        exercise.data.statements = exercise.data.statements || [];
        
        if (oldType === 'choice' && exercise.statements) {
            exercise.data.statements = exercise.statements;
            delete exercise.statements;
        }
        
        if (exercise.data.statements.length === 0) {
            exercise.data.statements = [{
                id: Date.now() + Math.random(),
                text: '',
                answers: [{ id: Date.now() + Math.random(), text: '', isCorrect: false }]
            }];
        }
    } 
    else if (newType === 'fill_blanks') {
        if (!exercise.data) exercise.data = {};
        exercise.data.words = exercise.data.words || [];
        exercise.data.sentences = exercise.data.sentences || [];
        
        if (oldType === 'fill_blanks' && exercise.words) {
            exercise.data.words = exercise.words;
            exercise.data.sentences = exercise.sentences;
            delete exercise.words;
            delete exercise.sentences;
        }
        
        if (exercise.data.words.length === 0) {
            exercise.data.words = [{ id: Date.now() + Math.random(), text: '' }];
        }
        if (exercise.data.sentences.length === 0) {
            exercise.data.sentences = [{
                id: Date.now() + Math.random(),
                text: '',
                correctAnswers: []
            }];
        }
    }
    
    // Перерендериваем редактор
    const editorContainer = document.getElementById(`test-exercise-editor-${exercise.id}`);
    if (editorContainer) {
        editorContainer.innerHTML = getExerciseEditorHTML(exercise);
        
        if (newType === 'matching') {
            renderTestMatching(exercise.id);
        } else if (newType === 'choice') {
            renderTestChoice(exercise.id);
        } else if (newType === 'fill_blanks') {
            renderTestFillBlanks(exercise.id);
        }
    }
    
    checkExerciseUnsavedChanges();
}

function handleTestTypeOptionClick(e) {
    e.stopPropagation();
    const option = e.currentTarget;
    const newType = option.dataset.type;
    const exerciseId = option.dataset.exerciseId;
    const dropdown = option.closest('.test-type-dropdown');
    const btn = dropdown.querySelector('.test-type-dropdown-btn');
    const selectedSpan = btn.querySelector('.selected-type-value');
    
    // Найти упражнение
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    if (!exercise) return;
    
    // Закрыть меню
    const menu = dropdown.querySelector('.test-type-dropdown-menu');
    if (menu) menu.style.display = 'none';
    btn.classList.remove('active');
    
    // Если тип не изменился, ничего не делаем
    if (exercise.type === newType) return;
    
    // Проверяем, есть ли данные в текущем упражнении
    let hasData = false;
    
    if (exercise.type === 'matching') {
        const items = exercise.data?.items || [];
        const targets = exercise.data?.targets || [];
        hasData = items.length > 0 || targets.length > 0;
        if (items.length > 0) {
            hasData = items.some(item => item.text && item.text.trim() !== '');
        }
        if (targets.length > 0 && !hasData) {
            hasData = targets.some(target => target.text && target.text.trim() !== '');
        }
    } 
    else if (exercise.type === 'choice') {
        const statements = exercise.data?.statements || [];
        hasData = statements.length > 0;
        if (statements.length > 0) {
            hasData = statements.some(s => 
                (s.text && s.text.trim() !== '') || 
                (s.answers && s.answers.some(a => a.text && a.text.trim() !== ''))
            );
        }
    } 
    else if (exercise.type === 'fill_blanks') {
        const words = exercise.data?.words || [];
        const sentences = exercise.data?.sentences || [];
        hasData = words.length > 0 || sentences.length > 0;
        if (words.length > 0) {
            hasData = words.some(w => w.text && w.text.trim() !== '');
        }
        if (sentences.length > 0 && !hasData) {
            hasData = sentences.some(s => s.text && s.text.trim() !== '');
        }
    }
    
    const typeText = {
        'matching': 'Сопоставление',
        'choice': 'Выбор правильного',
        'fill_blanks': 'Дополнение'
    };
    
    // Функция для выполнения смены типа
    const doChange = () => {
        selectedSpan.textContent = typeText[newType];
        performExerciseTypeChange(exercise, newType);
    };
    
    // Функция для отмены (возвращаем старый текст)
    const doCancel = () => {
        selectedSpan.textContent = typeText[exercise.type];
    };
    
    if (hasData) {
        showConfirmDialog(
            'Смена типа упражнения',
            'При переключении типа упражнения все данные текущего типа будут потеряны. Вы уверены, что хотите продолжить?',
            doChange,
            doCancel
        );
    } else {
        doChange();
    }
}

function handleScoringInputChange(e) {
    const exerciseId = e.target.dataset.exerciseId;
    const attempt = e.target.dataset.attempt;
    const value = parseInt(e.target.value) || 0;
    const exercise = currentTestData.exercises.find(ex => ex.id == exerciseId);
    if (exercise) {
        if (!exercise.scoring) exercise.scoring = {};
        if (attempt === '1') exercise.scoring.firstAttempt = Math.min(100, Math.max(0, value));
        if (attempt === '2') exercise.scoring.secondAttempt = Math.min(100, Math.max(0, value));
        if (attempt === '3') exercise.scoring.thirdAttempt = Math.min(100, Math.max(0, value));
        if (attempt === '4') exercise.scoring.subsequentAttempts = Math.min(100, Math.max(0, value));
        checkExerciseUnsavedChanges();
    }
}

// Получение HTML редактора упражнения по типу
function getExerciseEditorHTML(exercise) {
    if (exercise.type === 'matching') {
        return `
            <div class="matching-exercise-container">
                <div class="task-description">
                    <label>Задача:</label>
                    <div class="task-text">Сопоставьте каждый элемент с его сопоставлением.</div>
                </div>
                <div class="two-columns">
                    <div class="left-column">
                        <div class="column-header">Элементы (макс. 17)</div>
                        <div id="test-items-list-${exercise.id}" class="items-list"></div>
                        <button class="add-item-btn" onclick="addTestItem('${exercise.id}')">+ Добавить элемент</button>
                        <div class="items-counter" id="test-items-counter-${exercise.id}">0/17 элементов</div>
                    </div>
                    <div class="right-column">
                        <div class="column-header">Элементы сопоставления (макс. 15)</div>
                        <div id="test-targets-list-${exercise.id}" class="targets-list"></div>
                        <button class="add-target-btn" onclick="addTestTarget('${exercise.id}')">+ Добавить элемент сопоставления</button>
                        <div class="targets-counter" id="test-targets-counter-${exercise.id}">0/15 элементов</div>
                    </div>
                </div>
                <div class="matching-table-section">
                    <div class="table-label">Таблица сопоставления</div>
                    <div class="matching-table">
                        <div class="table-header">
                            <div class="table-header-cell">Элемент</div>
                            <div class="table-header-cell">Сопоставление</div>
                        </div>
                        <div id="test-matching-rows-${exercise.id}" class="matching-rows"></div>
                    </div>
                </div>
            </div>
        `;
    } else if (exercise.type === 'choice') {
        return `
            <div class="choice-exercise-container">
                <div class="task-description">
                    <label>Задача:</label>
                    <div class="task-text">Выберите правильный ответ для каждого утверждения.</div>
                </div>
                <div class="statements-section">
                    <div class="section-header">Утверждения</div>
                    <div id="test-statements-list-${exercise.id}" class="statements-list"></div>
                    <button class="add-statement-btn" onclick="addTestStatement('${exercise.id}')">+ Добавить утверждение</button>
                </div>
            </div>
        `;
    } else if (exercise.type === 'fill_blanks') {
        return `
            <div class="fillblanks-exercise-container">
                <div class="task-description">
                    <label>Задача:</label>
                    <div class="task-text">Вставьте подходящее по смыслу слово в каждое предложение.</div>
                </div>
                <div class="words-section">
                    <div class="section-header">Слова для справки:</div>
                    <div id="test-words-list-${exercise.id}" class="words-list"></div>
                    <button class="add-word-btn" onclick="addTestWord('${exercise.id}')">+ Добавить слово</button>
                    <div class="words-counter" id="test-words-counter-${exercise.id}">0/30 слов</div>
                </div>
                <div class="sentences-section">
                    <div id="test-sentences-list-${exercise.id}" class="sentences-list"></div>
                    <button class="add-sentence-btn" onclick="addTestSentence('${exercise.id}')">+ Добавить предложение</button>
                </div>
            </div>
        `;
    }
    return '<div class="empty-message">Выберите тип упражнения</div>';
}

function addTestExercise() {
    if (currentTestData.exercises.length >= 9) {
        showNotification('Максимум 9 тестирований', 'warning');
        return;
    }
    
    currentTestData.exercises.push({
        id: nextTestExerciseId++,
        type: 'matching',
        title: 'Новое тестирование',
        data: {
            items: [{ id: Date.now() + Math.random(), text: '' }],
            targets: [{ id: Date.now() + Math.random(), text: '' }],
            pairs: []
        },
        scoring: {
            firstAttempt: 100,
            secondAttempt: 50,
            thirdAttempt: 25,
            subsequentAttempts: 0
        }
    });
    
    renderTestExercises();
    
    if (originalExerciseState && originalExerciseState.type === 'test') {
        originalExerciseState.data.exercises = JSON.parse(JSON.stringify(currentTestData.exercises));
    }
}

// Удаление тестирования
window.deleteTestExercise = function(exerciseId) {
    const exerciseIndex = currentTestData.exercises.findIndex(ex => ex.id == exerciseId);
    if (exerciseIndex !== -1) {
        currentTestData.exercises.splice(exerciseIndex, 1);
        renderTestExercises();
        
        // Обновляем исходное состояние
        if (originalExerciseState && originalExerciseState.type === 'test') {
            originalExerciseState.data.exercises = JSON.parse(JSON.stringify(currentTestData.exercises));
        }
        
        checkExerciseUnsavedChanges();
    }
};

// Упрощенная версия Drag & Drop
function initTestDragDrop() {
    const container = document.getElementById('testExercisesList');
    if (!container) return;
    
    let draggedItem = null;
    
    const handleDragStart = (e) => {
        draggedItem = e.target.closest('.test-exercise-card');
        if (!draggedItem) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('text/plain', '');
        e.dataTransfer.effectAllowed = 'move';
        draggedItem.classList.add('dragging');
    };
    
    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const targetItem = e.target.closest('.test-exercise-card');
        if (targetItem && targetItem !== draggedItem) {
            const rect = targetItem.getBoundingClientRect();
            const mouseY = e.clientY;
            const isAfter = mouseY > rect.top + rect.height / 2;
            
            if (isAfter) {
                targetItem.parentNode.insertBefore(draggedItem, targetItem.nextSibling);
            } else {
                targetItem.parentNode.insertBefore(draggedItem, targetItem);
            }
        }
    };
    
    const handleDrop = (e) => {
        e.preventDefault();
        
        if (!draggedItem) return;
        
        // Получаем новый порядок из DOM
        const items = Array.from(container.querySelectorAll('.test-exercise-card'));
        const newOrder = items.map(item => {
            const id = item.getAttribute('data-exercise-id');
            return currentTestData.exercises.find(ex => ex.id == id);
        }).filter(ex => ex);
        
        if (newOrder.length === currentTestData.exercises.length) {
            currentTestData.exercises = newOrder;
            renderTestExercises();
            showNotification('Порядок тестирований изменен', 'info');
            checkExerciseUnsavedChanges();
            
            setTimeout(() => {
                initTestDragDrop();
            }, 100);
        }
        
        draggedItem.classList.remove('dragging');
        draggedItem = null;
    };
    
    const handleDragEnd = (e) => {
        if (draggedItem) {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
        }
    };
    
    container.addEventListener('dragstart', handleDragStart);
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);
    container.addEventListener('dragend', handleDragEnd);
    
    addDragDropStyles();
}

function addDragDropStyles() {
    if (document.getElementById('drag-drop-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'drag-drop-styles';
    style.textContent = `
        .test-exercise-card.dragging {
            opacity: 0.4;
            background: #f0f0f0;
        }
        
        .test-exercise-card.drag-over-top {
            border-top: 3px solid #379B34 !important;
            margin-top: -2px;
        }
        
        .test-exercise-card.drag-over-bottom {
            border-bottom: 3px solid #379B34 !important;
            margin-bottom: -2px;
        }
        
        .drag-handle {
            cursor: grab;
            user-select: none;
            font-size: 20px;
            color: #9ca3af;
            padding: 0 8px;
        }
        
        .drag-handle:active {
            cursor: grabbing;
        }
    `;
    document.head.appendChild(style);
}

// В функции backToSectionsFromTest, перед проверкой изменений, синхронизируйте состояние
function backToSectionsFromTest() {
    // Синхронизируем текущие данные из формы перед проверкой
    const currentDeadline = document.getElementById('testDeadline')?.value || '';
    const currentNoTimeLimit = document.getElementById('timelimitEnabled')?.checked || true;
    const currentDays = parseInt(document.getElementById('timelimitDays')?.value) || 0;
    const currentHours = parseInt(document.getElementById('timelimitHours')?.value) || 0;
    const currentMinutes = parseInt(document.getElementById('timelimitMinutes')?.value) || 0;
    
    currentTestData.deadline = currentDeadline;
    currentTestData.timeLimit = {
        enabled: currentNoTimeLimit,
        days: currentDays,
        hours: currentHours,
        minutes: currentMinutes
    };
    
    checkExerciseUnsavedChanges();
    
    if (hasExerciseUnsavedChanges) {
        showUnsavedChangesDialog(
            'Несохраненные изменения',
            'У вас есть несохраненные изменения. Вернуться к разделам?',
            () => {
                performBackToSectionsFromTest();
            }
        );
        return;
    }
    
    performBackToSectionsFromTest();
}

function performBackToSectionsFromTest() {
    const testEditorContainer = document.getElementById('testEditorContainer');
    const sectionsAreaEl = document.getElementById('sectionsArea');
    const welcomeScreenEl = document.getElementById('welcomeScreen');
    
    if (testEditorContainer) testEditorContainer.style.display = 'none';
    
    if (currentBlock && sectionsAreaEl) {
        sectionsAreaEl.style.display = 'block';
        welcomeScreenEl.style.display = 'none';
        
        currentBlockTitle.textContent = currentBlock.title;
        currentBlockDescription.textContent = currentBlock.description;
        
        // Перезагружаем разделы из currentCourse, чтобы отобразить актуальные данные
        if (currentCourse) {
            // Находим актуальные разделы для текущего блока
            for (const theme of currentCourse.themes) {
                const block = theme.blocks?.find(b => b.id === currentBlock.id);
                if (block && block.sections) {
                    currentSections = block.sections;
                    break;
                }
            }
        }
        
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

// Получение HTML редактора упражнения по типу
function getExerciseEditorHTML(exercise) {
    if (exercise.type === 'matching') {
        return `
            <div class="matching-exercise-container" data-exercise-id="${exercise.id}">
                <div class="task-description">
                    <label>Задача:</label>
                    <div class="task-text" id="test-matching-task-${exercise.id}">Сопоставьте каждый элемент с его сопоставлением.</div>
                </div>
                
                <div class="two-columns">
                    <div class="left-column">
                        <div class="column-header">
                            <span>Элементы (макс. 17)</span>
                        </div>
                        <div id="test-matching-items-${exercise.id}" class="items-list">
                            <!-- Динамические поля ввода -->
                        </div>
                        <button class="add-item-btn" onclick="addTestMatchingItem('${exercise.id}')">+ Добавить элемент</button>
                        <div class="items-counter" id="test-matching-items-counter-${exercise.id}">0/17 элементов</div>
                    </div>
                    
                    <div class="right-column">
                        <div class="column-header">
                            <span>Элементы сопоставления (макс. 15)</span>
                        </div>
                        <div id="test-matching-targets-${exercise.id}" class="targets-list">
                            <!-- Динамические поля ввода -->
                        </div>
                        <button class="add-target-btn" onclick="addTestMatchingTarget('${exercise.id}')">+ Добавить элемент сопоставления</button>
                        <div class="targets-counter" id="test-matching-targets-counter-${exercise.id}">0/15 элементов</div>
                    </div>
                </div>
                
                <div class="matching-table-section">
                    <div class="table-label">Таблица сопоставления</div>
                    <div class="matching-table">
                        <div class="table-header">
                            <div class="table-header-cell">Элемент</div>
                            <div class="table-header-cell">Сопоставление</div>
                        </div>
                        <div id="test-matching-rows-${exercise.id}" class="matching-rows">
                            <!-- Строки сопоставления будут здесь -->
                        </div>
                    </div>
                </div>
            </div>
        `;
    } 
    else if (exercise.type === 'choice') {
        return `
            <div class="choice-exercise-container" data-exercise-id="${exercise.id}">
                <div class="task-description">
                    <label>Задача:</label>
                    <div class="task-text" id="test-choice-task-${exercise.id}">Сопоставьте каждое утверждение с правильным ответом (правильных ответов может быть несколько).</div>
                </div>
                <div class="statements-section">
                    <div class="section-header">
                        <span>Утверждения</span>
                    </div>
                    <div id="test-choice-statements-${exercise.id}" class="statements-list">
                        <!-- Динамические утверждения -->
                    </div>
                    <button class="add-statement-btn" onclick="addTestChoiceStatement('${exercise.id}')">+ Добавить утверждение</button>
                </div>
            </div>
        `;
    }
    else if (exercise.type === 'fill_blanks') {
        return `
            <div class="fillblanks-exercise-container" data-exercise-id="${exercise.id}">
                <div class="task-description">
                    <label>Задача:</label>
                    <div class="task-text" id="test-fillblanks-task-${exercise.id}">Вставьте подходящее по смыслу слово в каждое предложение.</div>
                </div>
                
                <div class="words-section">
                    <div class="section-header">
                        <span>Слова для справки:</span>
                    </div>
                    <div id="test-fillblanks-words-${exercise.id}" class="words-list">
                        <!-- Динамические чипсы слов -->
                    </div>
                    <div class="add-word-wrapper">
                        <button class="add-word-btn" onclick="addTestFillBlanksWord('${exercise.id}')">
                            <img src="/images/taskCreationPage/plus.svg" alt="+" class="plus-icon"> Добавить слово
                        </button>
                    </div>
                    <div class="words-counter" id="test-fillblanks-words-counter-${exercise.id}">0/30 слов</div>
                </div>
                
                <div class="sentences-section">
                    <div class="sentences-list" id="test-fillblanks-sentences-${exercise.id}">
                        <!-- Динамические карточки предложений -->
                    </div>
                    <button class="add-sentence-btn" onclick="addTestFillBlanksSentence('${exercise.id}')">+ Добавить предложение</button>
                </div>
            </div>
        `;
    }
    
    return '<div class="exercise-editor-placeholder" style="padding: 20px; text-align: center; color: #9ca3af;">Выберите тип упражнения</div>';
}

// ===== ФУНКЦИИ ДЛЯ MATCHING ВНУТРИ ТЕСТА =====

// Рендер matching упражнения внутри теста
function renderTestMatching(exerciseId) {
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    if (!exercise) return;
    
    // Инициализируем данные, если их нет
    if (!exercise.data) {
        exercise.data = {
            items: [],
            targets: [],
            pairs: []
        };
    }
    // НЕ ПЕРЕЗАПИСЫВАЙТЕ existing свойства!
    if (!exercise.data.items) exercise.data.items = [];
    if (!exercise.data.targets) exercise.data.targets = [];
    if (!exercise.data.pairs) exercise.data.pairs = [];
    
    const items = exercise.data.items;
    const targets = exercise.data.targets;
    const pairs = exercise.data.pairs;
    
    // Рендер элементов
    const itemsContainer = document.getElementById(`test-matching-items-${exerciseId}`);
    const itemsCounter = document.getElementById(`test-matching-items-counter-${exerciseId}`);
    
    if (itemsContainer) {
        if (items.length === 0) {
            itemsContainer.innerHTML = '<div class="empty-message" style="padding: 20px; text-align: center;">Нет элементов. Добавьте первый элемент.</div>';
        } else {
            itemsContainer.innerHTML = items.map((item, idx) => `
                <div class="item-row" data-item-id="${item.id}">
                    <div class="item-number">${idx + 1}.</div>
                    <input type="text" class="item-input" value="${escapeHtml(item.text)}" placeholder="введите элемент">
                    <button class="delete-item-btn" onclick="deleteTestMatchingItem('${exerciseId}', '${item.id}')">
                        <img src="/images/taskCreationPage/delete.svg" alt="Удалить" class="delete-icon">
                    </button>
                </div>
            `).join('');
            
            itemsContainer.querySelectorAll('.item-input').forEach((input, idx) => {
                input.removeEventListener('change', (e) => {});
                input.addEventListener('change', (e) => {
                    items[idx].text = e.target.value;
                    renderTestMatchingTable(exerciseId);
                    checkExerciseUnsavedChanges();
                });
            });
        }
    }
    
    if (itemsCounter) {
        itemsCounter.textContent = `${items.length}/17 элементов`;
    }
    
    // Рендер элементов сопоставления
    const targetsContainer = document.getElementById(`test-matching-targets-${exerciseId}`);
    const targetsCounter = document.getElementById(`test-matching-targets-counter-${exerciseId}`);
    
    if (targetsContainer) {
        if (targets.length === 0) {
            targetsContainer.innerHTML = '<div class="empty-message" style="padding: 20px; text-align: center;">Нет элементов. Добавьте первый элемент.</div>';
        } else {
            targetsContainer.innerHTML = targets.map((target, idx) => `
                <div class="target-row" data-target-id="${target.id}">
                    <div class="target-letter">${String.fromCharCode(65 + idx)}.</div>
                    <input type="text" class="target-input" value="${escapeHtml(target.text)}" placeholder="введите элемент сопоставления">
                    <button class="delete-target-btn" onclick="deleteTestMatchingTarget('${exerciseId}', '${target.id}')">
                        <img src="/images/taskCreationPage/delete.svg" alt="Удалить" class="delete-icon">
                    </button>
                </div>
            `).join('');
            
            targetsContainer.querySelectorAll('.target-input').forEach((input, idx) => {
                input.removeEventListener('change', (e) => {});
                input.addEventListener('change', (e) => {
                    targets[idx].text = e.target.value;
                    renderTestMatchingTable(exerciseId);
                    checkExerciseUnsavedChanges();
                });
            });
        }
    }
    
    if (targetsCounter) {
        targetsCounter.textContent = `${targets.length}/15 элементов`;
    }
    
    renderTestMatchingTable(exerciseId);
}

function renderTestMatchingTable(exerciseId) {
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    if (!exercise || !exercise.data) return;
    
    const items = exercise.data.items || [];
    const targets = exercise.data.targets || [];
    const pairs = exercise.data.pairs || [];
    
    const rowsContainer = document.getElementById(`test-matching-rows-${exerciseId}`);
    if (!rowsContainer) return;
    
    if (targets.length === 0) {
        rowsContainer.innerHTML = '<div class="empty-message" style="padding: 20px; text-align: center;">Добавьте элементы сопоставления</div>';
        return;
    }
    
    rowsContainer.innerHTML = targets.map((target, idx) => {
        const currentPair = pairs.find(p => p.targetId == target.id);
        const selectedItemId = currentPair ? currentPair.itemId : null;
        const selectedItem = items.find(i => i.id == selectedItemId);
        const selectedText = selectedItem ? `${items.findIndex(i => i.id == selectedItemId) + 1}. ${selectedItem.text || 'Элемент'}` : '-- выберите элемент --';
        
        return `
            <div class="matching-row" data-target-id="${target.id}">
                <div class="matching-cell">
                    <div class="matching-select-wrapper" data-target-id="${target.id}">
                        <button class="matching-select-btn" data-target-id="${target.id}" data-exercise-id="${exerciseId}">
                            <span class="selected-text">${escapeHtml(selectedText)}</span>
                            <img src="/images/taskCreationPage/chevronDown.svg" alt="toggle" class="select-chevron">
                        </button>
                        <div class="matching-select-menu" style="display: none;">
                            <button class="matching-select-option" data-value="">-- выберите элемент --</button>
                            ${items.map((item, itemIdx) => `
                                <button class="matching-select-option ${selectedItemId == item.id ? 'selected' : ''}" data-value="${item.id}">
                                    ${itemIdx + 1}. ${escapeHtml(item.text || `Элемент ${itemIdx + 1}`)}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="matching-cell">
                    <div class="matching-target-text">
                        <strong>${String.fromCharCode(65 + idx)}.</strong> ${escapeHtml(target.text || 'не заполнено')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Добавляем обработчики для кастомных select'ов
    document.querySelectorAll(`.matching-select-btn[data-exercise-id="${exerciseId}"]`).forEach(btn => {
        btn.removeEventListener('click', handleTestMatchingSelectClick);
        btn.addEventListener('click', handleTestMatchingSelectClick);
    });
    
    document.querySelectorAll(`.matching-select-option`).forEach(option => {
        option.removeEventListener('click', handleTestMatchingSelectOptionClick);
        option.addEventListener('click', handleTestMatchingSelectOptionClick);
    });
}

function handleTestMatchingSelectClick(e) {
    e.stopPropagation();
    const wrapper = this.closest('.matching-select-wrapper');
    const menu = wrapper.querySelector('.matching-select-menu');
    const isOpen = menu.style.display === 'block';
    
    document.querySelectorAll('.matching-select-menu').forEach(m => {
        m.style.display = 'none';
    });
    document.querySelectorAll('.matching-select-btn').forEach(b => {
        b.classList.remove('active');
    });
    
    if (!isOpen) {
        menu.style.display = 'block';
        this.classList.add('active');
    }
}

function handleTestMatchingSelectOptionClick(e) {
    e.stopPropagation();
    const option = this;
    const value = option.dataset.value;
    const text = option.textContent;
    const wrapper = option.closest('.matching-select-wrapper');
    const btn = wrapper.querySelector('.matching-select-btn');
    const menu = wrapper.querySelector('.matching-select-menu');
    const targetId = btn.dataset.targetId;
    const exerciseId = btn.dataset.exerciseId;
    
    btn.querySelector('.selected-text').textContent = text;
    menu.style.display = 'none';
    btn.classList.remove('active');
    
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    if (exercise && exercise.data) {
        if (!exercise.data.pairs) exercise.data.pairs = [];
        const pairs = exercise.data.pairs;
        
        if (value) {
            const existingIndex = pairs.findIndex(p => p.targetId == targetId);
            if (existingIndex !== -1) {
                pairs[existingIndex].itemId = value;
            } else {
                pairs.push({ targetId: targetId, itemId: value });
            }
        } else {
            exercise.data.pairs = pairs.filter(p => p.targetId != targetId);
        }
        checkExerciseUnsavedChanges();
    }
    
    wrapper.querySelectorAll('.matching-select-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    option.classList.add('selected');
}

function addTestMatchingItem(exerciseId) {
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    if (!exercise) return;
    
    if (!exercise.data) exercise.data = { items: [], targets: [], pairs: [] };
    if (!exercise.data.items) exercise.data.items = [];
    
    if (exercise.data.items.length >= 17) {
        showNotification('Максимум 17 элементов', 'warning');
        return;
    }
    
    const newId = Date.now() + Math.random();
    exercise.data.items.push({ id: newId, text: '' });
    renderTestMatching(exerciseId);
    checkExerciseUnsavedChanges();
}

function deleteTestMatchingItem(exerciseId, itemId) {
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    if (!exercise || !exercise.data) {
        console.error('Exercise not found:', exerciseId);
        return;
    }
    
    if (!exercise.data.items) exercise.data.items = [];
    if (!exercise.data.pairs) exercise.data.pairs = [];
    
    exercise.data.items = exercise.data.items.filter(i => i.id != itemId);
    exercise.data.pairs = exercise.data.pairs.filter(p => p.itemId != itemId);
    renderTestMatching(exerciseId);
    checkExerciseUnsavedChanges();
}

function addTestMatchingTarget(exerciseId) {
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    if (!exercise) return;
    
    if (!exercise.data) exercise.data = { items: [], targets: [], pairs: [] };
    if (!exercise.data.targets) exercise.data.targets = [];
    
    if (exercise.data.targets.length >= 15) {
        showNotification('Максимум 15 элементов сопоставления', 'warning');
        return;
    }
    
    const newId = Date.now() + Math.random();
    exercise.data.targets.push({ id: newId, text: '' });
    renderTestMatching(exerciseId);
    checkExerciseUnsavedChanges();
}

function deleteTestMatchingTarget(exerciseId, targetId) {
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    if (!exercise || !exercise.data) {
        console.error('Exercise not found:', exerciseId);
        return;
    }
    
    if (!exercise.data.targets) exercise.data.targets = [];
    if (!exercise.data.pairs) exercise.data.pairs = [];
    
    exercise.data.targets = exercise.data.targets.filter(t => t.id != targetId);
    exercise.data.pairs = exercise.data.pairs.filter(p => p.targetId != targetId);
    renderTestMatching(exerciseId);
    checkExerciseUnsavedChanges();
}

// ===== ФУНКЦИИ ДЛЯ CHOICE ВНУТРИ ТЕСТА =====


function renderTestChoice(exerciseId) {
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    if (!exercise) return;
    
    if (!exercise.data) {
        exercise.data = { statements: [] };
    }
    if (!exercise.data.statements) exercise.data.statements = [];
    
    const statements = exercise.data.statements;
    
    const statementsContainer = document.getElementById(`test-choice-statements-${exerciseId}`);
    if (!statementsContainer) return;
    
    if (statements.length === 0) {
        statementsContainer.innerHTML = '<div class="empty-message" style="padding: 20px; text-align: center;">Нет утверждений. Добавьте первое утверждение.</div>';
        return;
    }
    
    statementsContainer.innerHTML = statements.map((statement, stmtIdx) => {
        return `
            <div class="statement-card" data-statement-id="${statement.id}">
                <div class="statement-header">
                    <div class="statement-number">${stmtIdx + 1}.</div>
                    <input type="text" class="statement-input" value="${escapeHtml(statement.text)}" placeholder="Введите утверждение" data-exercise-id="${exerciseId}" data-statement-id="${statement.id}">
                    <button class="delete-statement-btn" onclick="deleteTestChoiceStatement('${exerciseId}', '${statement.id}')">
                        <img src="/images/taskCreationPage/delete.svg" alt="Удалить" class="delete-statement-icon">
                    </button>
                </div>
                <div class="answers-section">
                    <div class="answers-header">Ответы (правильных может быть несколько):</div>
                    <div class="answers-list" id="test-choice-answers-${exerciseId}-${statement.id}">
                        ${renderTestChoiceAnswers(exerciseId, statement)}
                    </div>
                    <button class="add-answer-btn" onclick="addTestChoiceAnswer('${exerciseId}', '${statement.id}')">
                        <img src="/images/taskCreationPage/plus.svg" alt="+" class="plus-icon"> Добавить ответ
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Добавляем обработчики для полей утверждений
    document.querySelectorAll(`.statement-input[data-exercise-id="${exerciseId}"]`).forEach(input => {
        input.removeEventListener('change', handleTestChoiceStatementChange);
        input.addEventListener('change', handleTestChoiceStatementChange);
    });
    
    // Добавляем обработчики для полей ответов
    document.querySelectorAll(`.answer-input[data-exercise-id="${exerciseId}"]`).forEach(input => {
        input.removeEventListener('change', handleTestChoiceAnswerChange);
        input.addEventListener('change', handleTestChoiceAnswerChange);
    });
}

function renderTestChoiceAnswers(exerciseId, statement) {
    const answers = statement.answers || [];
    
    if (answers.length === 0) {
        return '<div class="empty-message" style="padding: 10px; text-align: center;">Нет ответов. Добавьте первый ответ.</div>';
    }
    
    return answers.map((answer, ansIdx) => `
        <div class="answer-row" data-answer-id="${answer.id}">
            <div class="radio-btn ${answer.isCorrect ? 'selected' : ''}" onclick="toggleTestChoiceAnswer('${exerciseId}', '${statement.id}', '${answer.id}')"></div>
            <div class="answer-number">${String.fromCharCode(65 + ansIdx)}.</div>
            <input type="text" class="answer-input" value="${escapeHtml(answer.text)}" placeholder="Введите ответ" data-exercise-id="${exerciseId}" data-statement-id="${statement.id}" data-answer-id="${answer.id}">
            <button class="delete-answer-btn" onclick="deleteTestChoiceAnswer('${exerciseId}', '${statement.id}', '${answer.id}')">
                <img src="/images/taskCreationPage/delete.svg" alt="Удалить" class="delete-answer-icon">
            </button>
        </div>
    `).join('');
}

function handleTestChoiceStatementChange(e) {
    const exerciseId = e.target.dataset.exerciseId;
    const statementId = e.target.dataset.statementId;
    const exercise = currentTestData.exercises.find(ex => ex.id == exerciseId);
    if (exercise && exercise.data) {
        const statement = exercise.data.statements.find(s => s.id == statementId);
        if (statement) {
            statement.text = e.target.value;
            checkExerciseUnsavedChanges();
        }
    }
}

function handleTestChoiceAnswerChange(e) {
    const exerciseId = e.target.dataset.exerciseId;
    const statementId = e.target.dataset.statementId;
    const answerId = e.target.dataset.answerId;
    
    const exercise = currentTestData.exercises.find(ex => ex.id == exerciseId);
    if (exercise && exercise.data) {
        const statement = exercise.data.statements.find(s => s.id == statementId);
        if (statement && statement.answers) {
            const answer = statement.answers.find(a => a.id == answerId);
            if (answer) {
                answer.text = e.target.value;
                checkExerciseUnsavedChanges();
            }
        }
    }
}

function addTestChoiceStatement(exerciseId) {
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    if (!exercise) return;
    
    if (!exercise.data) exercise.data = { statements: [] };
    if (!exercise.data.statements) exercise.data.statements = [];
    
    if (exercise.data.statements.length >= 20) {
        showNotification('Максимум 20 утверждений', 'warning');
        return;
    }
    
    const newId = Date.now() + Math.random();
    exercise.data.statements.push({
        id: newId,
        text: '',
        answers: [{ id: Date.now() + Math.random() + 1, text: '', isCorrect: false }]
    });
    
    renderTestChoice(exerciseId);
    checkExerciseUnsavedChanges();
}

function deleteTestChoiceStatement(exerciseId, statementId) {
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    if (!exercise || !exercise.data) return;
    
    exercise.data.statements = exercise.data.statements.filter(s => s.id != statementId);
    renderTestChoice(exerciseId);
    checkExerciseUnsavedChanges();
}

function addTestChoiceAnswer(exerciseId, statementId) {
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    if (!exercise || !exercise.data) return;
    
    const statement = exercise.data.statements.find(s => s.id == statementId);
    if (!statement) return;
    
    if (!statement.answers) statement.answers = [];
    if (statement.answers.length >= 5) {
        showNotification('Максимум 5 ответов на утверждение', 'warning');
        return;
    }
    
    statement.answers.push({
        id: Date.now() + Math.random(),
        text: '',
        isCorrect: false
    });
    
    renderTestChoice(exerciseId);
    checkExerciseUnsavedChanges();
}

function deleteTestChoiceAnswer(exerciseId, statementId, answerId) {
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    if (!exercise || !exercise.data) return;
    
    const statement = exercise.data.statements.find(s => s.id == statementId);
    if (!statement || !statement.answers) return;
    
    if (statement.answers.length <= 1) {
        showNotification('У утверждения должен быть хотя бы один ответ', 'warning');
        return;
    }
    
    statement.answers = statement.answers.filter(a => a.id != answerId);
    renderTestChoice(exerciseId);
    checkExerciseUnsavedChanges();
}

function toggleTestChoiceAnswer(exerciseId, statementId, answerId) {
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    if (!exercise || !exercise.data) return;
    
    const statement = exercise.data.statements.find(s => s.id == statementId);
    if (!statement || !statement.answers) return;
    
    const answer = statement.answers.find(a => a.id == answerId);
    if (answer) {
        answer.isCorrect = !answer.isCorrect;
        renderTestChoice(exerciseId);
        checkExerciseUnsavedChanges();
    }
}

// ===== ФУНКЦИИ ДЛЯ FILL BLANKS ВНУТРИ ТЕСТА =====

function renderTestFillBlanks(exerciseId) {
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    if (!exercise) return;
    
    if (!exercise.data) {
        exercise.data = { words: [], sentences: [] };
    }
    if (!exercise.data.words) exercise.data.words = [];
    if (!exercise.data.sentences) exercise.data.sentences = [];
    
    const words = exercise.data.words;
    const sentences = exercise.data.sentences;
    
    // Рендер слов для справки
    const wordsList = document.getElementById(`test-fillblanks-words-${exerciseId}`);
    const wordsCounter = document.getElementById(`test-fillblanks-words-counter-${exerciseId}`);
    
    if (wordsList) {
        if (words.length === 0) {
            wordsList.innerHTML = '<div class="empty-message" style="padding: 20px; text-align: center;">Нет слов. Добавьте первое слово.</div>';
        } else {
            wordsList.innerHTML = words.map((word) => `
                <div class="word-chip" data-word-id="${word.id}">
                    <input type="text" class="word-input" value="${escapeHtml(word.text)}" placeholder="Введите слово" data-exercise-id="${exerciseId}" data-word-id="${word.id}">
                    <button class="delete-word-btn" onclick="deleteTestFillBlanksWord('${exerciseId}', '${word.id}')">
                        <img src="/images/taskCreationPage/delete.svg" alt="Удалить" class="delete-word-icon">
                    </button>
                </div>
            `).join('');
            
            wordsList.querySelectorAll('.word-input').forEach((input) => {
                input.removeEventListener('change', handleTestFillBlanksWordChange);
                input.addEventListener('change', handleTestFillBlanksWordChange);
            });
        }
    }
    
    if (wordsCounter) {
        wordsCounter.textContent = `${words.length}/30 слов`;
    }
    
    // Рендер предложений
    const sentencesList = document.getElementById(`test-fillblanks-sentences-${exerciseId}`);
    if (!sentencesList) return;
    
    if (sentences.length === 0) {
        sentencesList.innerHTML = '<div class="empty-message" style="padding: 40px; text-align: center;">Нет предложений. Добавьте первое предложение.</div>';
        return;
    }
    
    sentencesList.innerHTML = sentences.map((sentence, idx) => {
        const blanks = sentence.correctAnswers || [];
        
        return `
            <div class="sentence-card" data-sentence-id="${sentence.id}">
                <div class="sentence-header">
                    <div class="sentence-number">Предложение ${idx + 1}</div>
                    <button class="delete-sentence-icon-btn" onclick="deleteTestFillBlanksSentence('${exerciseId}', '${sentence.id}')" title="Удалить предложение">
                        <img src="/images/taskCreationPage/delete.svg" alt="Удалить" class="delete-icon">
                    </button>
                </div>
                <div class="sentence-textarea-wrapper">
                    <textarea class="sentence-textarea" data-sentence-id="${sentence.id}" data-exercise-id="${exerciseId}" placeholder="Введите текст предложения...">${escapeHtml(sentence.text)}</textarea>
                    <button class="insert-blank-btn" onclick="insertTestFillBlanksBlank('${exerciseId}', '${sentence.id}')">
                        <img src="/images/taskCreationPage/plus.svg" alt="+" class="plus-icon"> Вставить пропуск
                    </button>
                </div>
                <div class="blanks-section">
                    <div class="blanks-title">Выберите правильные слова для каждого пропуска:</div>
                    <div class="blanks-list" id="test-fillblanks-blanks-${exerciseId}-${sentence.id}">
                        ${renderTestFillBlanksBlanks(exerciseId, sentence)}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Добавляем обработчики для textarea
    document.querySelectorAll(`.sentence-textarea[data-exercise-id="${exerciseId}"]`).forEach(textarea => {
        textarea.removeEventListener('input', handleTestFillBlanksTextareaInput);
        textarea.addEventListener('input', handleTestFillBlanksTextareaInput);
        textarea.removeEventListener('blur', handleTestFillBlanksTextareaBlur);
        textarea.addEventListener('blur', handleTestFillBlanksTextareaBlur);
        autoResizeTestTextarea(textarea);
    });
    
    // Добавляем обработчики для кастомных select'ов
    initTestFillBlanksSelectHandlers(exerciseId);
}

function renderTestFillBlanksBlanks(exerciseId, sentence) {
    const blanks = sentence.correctAnswers || [];
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    const words = exercise?.data?.words || [];
    
    if (blanks.length === 0) {
        return '<div class="empty-message" style="padding: 10px; text-align: center; font-size: 13px;">Нет пропусков. Нажмите "Вставить пропуск" чтобы добавить.</div>';
    }
    
    return blanks.map((answer, idx) => `
        <div class="blank-row" data-blank-index="${idx}">
            <div class="blank-number">Пропуск ${idx + 1}:</div>
            <div class="blank-select-wrapper" data-sentence-id="${sentence.id}" data-blank-index="${idx}" data-exercise-id="${exerciseId}">
                <button class="blank-select-btn" data-sentence-id="${sentence.id}" data-blank-index="${idx}" data-exercise-id="${exerciseId}">
                    <span class="selected-text">${answer ? escapeHtml(answer) : '-- выберите слово --'}</span>
                    <img src="/images/taskCreationPage/chevronDown.svg" alt="toggle" class="select-chevron">
                </button>
                <div class="blank-select-menu" style="display: none;">
                    <button class="blank-select-option" data-value="">-- выберите слово --</button>
                    ${words.map(word => `
                        <button class="blank-select-option ${answer === word.text ? 'selected' : ''}" data-value="${escapeHtml(word.text)}">
                            ${escapeHtml(word.text)}
                        </button>
                    `).join('')}
                </div>
            </div>
            <button class="delete-blank-btn" onclick="deleteTestFillBlanksBlank('${exerciseId}', '${sentence.id}', ${idx})">
                <img src="/images/taskCreationPage/delete.svg" alt="Удалить" class="delete-blank-icon">
            </button>
        </div>
    `).join('');
}

function initTestFillBlanksSelectHandlers(exerciseId) {
    // Обработчики для кнопок выбора
    document.querySelectorAll(`.blank-select-btn[data-exercise-id="${exerciseId}"]`).forEach(btn => {
        btn.removeEventListener('click', handleTestFillBlanksSelectClick);
        btn.addEventListener('click', handleTestFillBlanksSelectClick);
    });
    
    // Обработчики для опций
    document.querySelectorAll(`.blank-select-option`).forEach(option => {
        option.removeEventListener('click', handleTestFillBlanksSelectOptionClick);
        option.addEventListener('click', handleTestFillBlanksSelectOptionClick);
    });
}

function handleTestFillBlanksSelectClick(e) {
    e.stopPropagation();
    const btn = this;
    const wrapper = btn.closest('.blank-select-wrapper');
    const menu = wrapper.querySelector('.blank-select-menu');
    const isOpen = menu.style.display === 'block';
    
    // Закрываем все другие меню
    document.querySelectorAll('.blank-select-menu').forEach(m => {
        m.style.display = 'none';
    });
    document.querySelectorAll('.blank-select-btn').forEach(b => {
        b.classList.remove('active');
    });
    
    if (!isOpen) {
        menu.style.display = 'block';
        btn.classList.add('active');
    }
}

function handleTestFillBlanksSelectOptionClick(e) {
    e.stopPropagation();
    const option = this;
    const value = option.dataset.value;
    const text = option.textContent;
    const wrapper = option.closest('.blank-select-wrapper');
    const btn = wrapper.querySelector('.blank-select-btn');
    const menu = wrapper.querySelector('.blank-select-menu');
    const exerciseId = wrapper.dataset.exerciseId;
    const sentenceId = wrapper.dataset.sentenceId;
    const blankIndex = parseInt(wrapper.dataset.blankIndex);
    
    // Обновляем текст кнопки
    btn.querySelector('.selected-text').textContent = text;
    
    // Закрываем меню
    menu.style.display = 'none';
    btn.classList.remove('active');
    
    // Обновляем данные
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    if (exercise && exercise.data) {
        const sentence = exercise.data.sentences.find(s => s.id == sentenceId);
        if (sentence && sentence.correctAnswers) {
            sentence.correctAnswers[blankIndex] = value;
            checkExerciseUnsavedChanges();
        }
    }
    
    // Обновляем класс selected для опций
    wrapper.querySelectorAll('.blank-select-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    option.classList.add('selected');
}

function handleTestFillBlanksWordChange(e) {
    const exerciseId = e.target.dataset.exerciseId;
    const wordId = e.target.dataset.wordId;
    const exercise = currentTestData.exercises.find(ex => ex.id == exerciseId);
    if (exercise && exercise.data && exercise.data.words) {
        const word = exercise.data.words.find(w => w.id == wordId);
        if (word) {
            word.text = e.target.value;
            // Обновляем все select'ы с этим словом
            renderTestFillBlanks(exerciseId);
            checkExerciseUnsavedChanges();
        }
    }
}

function handleTestFillBlanksTextareaInput(e) {
    const exerciseId = e.target.dataset.exerciseId;
    const sentenceId = e.target.dataset.sentenceId;
    const exercise = currentTestData.exercises.find(ex => ex.id == exerciseId);
    if (exercise && exercise.data) {
        const sentence = exercise.data.sentences.find(s => s.id == sentenceId);
        if (sentence) {
            sentence.text = e.target.value;
            checkExerciseUnsavedChanges();
        }
    }
    autoResizeTestTextarea(e.target);
}

function handleTestFillBlanksTextareaBlur(e) {
    const exerciseId = e.target.dataset.exerciseId;
    const sentenceId = e.target.dataset.sentenceId;
    const exercise = currentTestData.exercises.find(ex => ex.id == exerciseId);
    if (exercise && exercise.data) {
        const sentence = exercise.data.sentences.find(s => s.id == sentenceId);
        if (sentence) {
            let text = sentence.text;
            text = text.replace(/([^\s])_______/g, '$1 _______');
            text = text.replace(/_______([^\s])/g, '_______ $1');
            text = text.replace(/\s+/g, ' ');
            if (text !== sentence.text) {
                sentence.text = text;
                e.target.value = text;
                renderTestFillBlanks(exerciseId);
                checkExerciseUnsavedChanges();
            }
        }
    }
}

function autoResizeTestTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.max(44, textarea.scrollHeight);
    textarea.style.height = newHeight + 'px';
}

function addTestFillBlanksWord(exerciseId) {
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    if (!exercise) return;
    
    if (!exercise.data) exercise.data = { words: [], sentences: [] };
    if (!exercise.data.words) exercise.data.words = [];
    
    if (exercise.data.words.length >= 30) {
        showNotification('Максимум 30 слов', 'warning');
        return;
    }
    
    const newId = Date.now() + Math.random();
    exercise.data.words.push({ id: newId, text: '' });
    renderTestFillBlanks(exerciseId);
    checkExerciseUnsavedChanges();
}

function deleteTestFillBlanksWord(exerciseId, wordId) {
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    if (!exercise || !exercise.data) return;
    
    const deletedWordText = exercise.data.words.find(w => w.id == wordId)?.text;
    exercise.data.words = exercise.data.words.filter(w => w.id != wordId);
    
    if (exercise.data.sentences) {
        for (const sentence of exercise.data.sentences) {
            if (sentence.correctAnswers) {
                for (let i = 0; i < sentence.correctAnswers.length; i++) {
                    if (sentence.correctAnswers[i] === deletedWordText) {
                        sentence.correctAnswers[i] = '';
                    }
                }
            }
        }
    }
    
    renderTestFillBlanks(exerciseId);
    checkExerciseUnsavedChanges();
}

function addTestFillBlanksSentence(exerciseId) {
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    if (!exercise) return;
    
    if (!exercise.data) exercise.data = { words: [], sentences: [] };
    if (!exercise.data.sentences) exercise.data.sentences = [];
    
    if (exercise.data.sentences.length >= 10) {
        showNotification('Максимум 10 предложений', 'warning');
        return;
    }
    
    const newId = Date.now() + Math.random();
    exercise.data.sentences.push({
        id: newId,
        text: '',
        correctAnswers: []
    });
    
    renderTestFillBlanks(exerciseId);
    checkExerciseUnsavedChanges();
}

function deleteTestFillBlanksSentence(exerciseId, sentenceId) {
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    if (!exercise || !exercise.data) return;
    
    exercise.data.sentences = exercise.data.sentences.filter(s => s.id != sentenceId);
    renderTestFillBlanks(exerciseId);
    checkExerciseUnsavedChanges();
}

function insertTestFillBlanksBlank(exerciseId, sentenceId) {
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    if (!exercise || !exercise.data) return;
    
    const sentence = exercise.data.sentences.find(s => s.id == sentenceId);
    if (!sentence) return;
    
    const currentBlanks = sentence.correctAnswers || [];
    if (currentBlanks.length >= 3) {
        showNotification('Максимум 3 пропуска в одном предложении', 'warning');
        return;
    }
    
    const textarea = document.querySelector(`.sentence-textarea[data-sentence-id="${sentenceId}"]`);
    if (!textarea) return;
    
    const cursorPos = textarea.selectionStart;
    let textBefore = sentence.text.substring(0, cursorPos);
    let textAfter = sentence.text.substring(cursorPos);
    
    if (textBefore.length > 0 && textBefore[textBefore.length - 1] !== ' ') {
        textBefore += ' ';
    }
    if (textAfter.length > 0 && textAfter[0] !== ' ') {
        textAfter = ' ' + textAfter;
    }
    
    sentence.text = textBefore + '_______' + textAfter;
    if (!sentence.correctAnswers) sentence.correctAnswers = [];
    sentence.correctAnswers.push('');
    
    textarea.value = sentence.text;
    
    const newCursorPos = textBefore.length + 7;
    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        autoResizeTestTextarea(textarea);
    }, 10);
    
    renderTestFillBlanks(exerciseId);
    checkExerciseUnsavedChanges();
}

function deleteTestFillBlanksBlank(exerciseId, sentenceId, blankIndex) {
    const exercise = currentTestData.exercises.find(e => e.id == exerciseId);
    if (!exercise || !exercise.data) return;
    
    const sentence = exercise.data.sentences.find(s => s.id == sentenceId);
    if (!sentence) return;
    
    const blanks = sentence.correctAnswers || [];
    if (blankIndex >= blanks.length) return;
    
    let blankCount = 0;
    let newText = sentence.text;
    let foundIndex = -1;
    
    for (let i = 0; i < newText.length; i++) {
        if (newText.substring(i, i + 7) === '_______') {
            if (blankCount === blankIndex) {
                foundIndex = i;
                break;
            }
            blankCount++;
            i += 6;
        }
    }
    
    if (foundIndex !== -1) {
        let before = newText.substring(0, foundIndex);
        let after = newText.substring(foundIndex + 7);
        if (before.endsWith(' ') && after.startsWith(' ')) {
            before = before.slice(0, -1);
        } else if (before.endsWith(' ')) {
            before = before.slice(0, -1);
        } else if (after.startsWith(' ')) {
            after = after.slice(1);
        }
        newText = before + after;
        sentence.text = newText;
    }
    
    blanks.splice(blankIndex, 1);
    sentence.correctAnswers = blanks;
    
    const textarea = document.querySelector(`.sentence-textarea[data-sentence-id="${sentenceId}"]`);
    if (textarea) {
        textarea.value = newText;
        autoResizeTestTextarea(textarea);
    }
    
    renderTestFillBlanks(exerciseId);
    checkExerciseUnsavedChanges();
}

// Сохранение итогового теста
async function saveTestSection() {
    if (!currentEditingExerciseSection) {
        showNotification('Раздел не выбран', 'error');
        return;
    }
    
    // Получаем данные из формы
    const deadline = window.customDateTimePicker ? 
    window.customDateTimePicker.getValue() : 
    document.getElementById('testDeadline')?.value || '';
    const noTimeLimitCheckbox = document.getElementById('timelimitEnabled');
    const timelimitDays = parseInt(document.getElementById('timelimitDays')?.value) || 0;
    const timelimitHours = parseInt(document.getElementById('timelimitHours')?.value) || 0;
    const timelimitMinutes = parseInt(document.getElementById('timelimitMinutes')?.value) || 0;
    const noTimeLimitChecked = noTimeLimitCheckbox ? noTimeLimitCheckbox.checked : true;
    
    // Обновляем currentTestData
    currentTestData.deadline = deadline;
    currentTestData.timeLimit = {
        enabled: noTimeLimitChecked,
        days: timelimitDays,
        hours: timelimitHours,
        minutes: timelimitMinutes
    };
    
    // === ВАЛИДАЦИЯ ===
    if (currentTestData.exercises.length === 0) {
        showNotification('Добавьте хотя бы одно тестирование', 'warning');
        return;
    }
    
    for (let i = 0; i < currentTestData.exercises.length; i++) {
        const exercise = currentTestData.exercises[i];
        
        if (!exercise.title || !exercise.title.trim()) {
            showNotification(`В тестировании ${i + 1} не указано название`, 'warning');
            return;
        }
        
        // Matching
        if (exercise.type === 'matching') {
            const items = exercise.data?.items || [];
            const targets = exercise.data?.targets || [];
            const pairs = exercise.data?.pairs || [];
            
            if (items.length === 0) {
                showNotification(`В тестировании ${i + 1} (Сопоставление) нет элементов`, 'warning');
                return;
            }
            if (targets.length === 0) {
                showNotification(`В тестировании ${i + 1} (Сопоставление) нет элементов сопоставления`, 'warning');
                return;
            }
            const missingPairs = targets.filter(target => !pairs.some(p => p.targetId == target.id));
            if (missingPairs.length > 0) {
                showNotification(`В тестировании ${i + 1} (Сопоставление) не все элементы сопоставления имеют пару`, 'warning');
                return;
            }
        }
        // Choice
        else if (exercise.type === 'choice') {
            const statements = exercise.data?.statements || [];
            if (statements.length === 0) {
                showNotification(`В тестировании ${i + 1} (Выбор правильного) нет утверждений`, 'warning');
                return;
            }
            for (let j = 0; j < statements.length; j++) {
                const statement = statements[j];
                if (!statement.text || !statement.text.trim()) {
                    showNotification(`В тестировании ${i + 1} утверждение ${j + 1} не заполнено`, 'warning');
                    return;
                }
                const answers = statement.answers || [];
                if (answers.length === 0) {
                    showNotification(`В тестировании ${i + 1} у утверждения ${j + 1} нет ответов`, 'warning');
                    return;
                }
                for (let k = 0; k < answers.length; k++) {
                    if (!answers[k].text || !answers[k].text.trim()) {
                        showNotification(`В тестировании ${i + 1} у утверждения ${j + 1} ответ ${String.fromCharCode(65 + k)} не заполнен`, 'warning');
                        return;
                    }
                }
                const hasCorrect = answers.some(a => a.isCorrect === true);
                if (!hasCorrect) {
                    showNotification(`В тестировании ${i + 1} у утверждения ${j + 1} не выбран правильный ответ`, 'warning');
                    return;
                }
            }
        }
        // Fill blanks
        else if (exercise.type === 'fill_blanks') {
            const words = exercise.data?.words || [];
            const sentences = exercise.data?.sentences || [];
            if (words.length === 0) {
                showNotification(`В тестировании ${i + 1} (Дополнение) нет слов для справки`, 'warning');
                return;
            }
            if (sentences.length === 0) {
                showNotification(`В тестировании ${i + 1} (Дополнение) нет предложений`, 'warning');
                return;
            }
            for (let j = 0; j < words.length; j++) {
                if (!words[j].text || !words[j].text.trim()) {
                    showNotification(`В тестировании ${i + 1} слово ${j + 1} не заполнено`, 'warning');
                    return;
                }
            }
            for (let j = 0; j < sentences.length; j++) {
                const sentence = sentences[j];
                if (!sentence.text || !sentence.text.trim()) {
                    showNotification(`В тестировании ${i + 1} предложение ${j + 1} не заполнено`, 'warning');
                    return;
                }
                const blankCount = (sentence.text.match(/_______/g) || []).length;
                const blanks = sentence.correctAnswers || [];
                if (blankCount === 0) {
                    showNotification(`В тестировании ${i + 1} предложение ${j + 1} не содержит пропусков`, 'warning');
                    return;
                }
                if (blankCount !== blanks.length) {
                    showNotification(`В тестировании ${i + 1} предложение ${j + 1}: количество пропусков (${blankCount}) не соответствует количеству ответов (${blanks.length})`, 'warning');
                    return;
                }
                for (let k = 0; k < blanks.length; k++) {
                    if (!blanks[k] || !blanks[k].trim()) {
                        showNotification(`В тестировании ${i + 1} предложение ${j + 1} пропуск ${k + 1} не выбран`, 'warning');
                        return;
                    }
                }
            }
        }
    }
    // === КОНЕЦ ВАЛИДАЦИИ ===
    
    // Вычисляем time_limit в минутах
    let timeLimitMinutes = null;
    if (!noTimeLimitChecked) {
        timeLimitMinutes = (timelimitDays * 24 * 60) + (timelimitHours * 60) + timelimitMinutes;
        if (timeLimitMinutes === 0) timeLimitMinutes = null;
    }
    
    const testData = {
        title: currentEditingExerciseSection.title,
        deadline: deadline || null,
        time_limit: timeLimitMinutes,
        exercises: currentTestData.exercises.map(ex => ({
            id: ex.id,
            type: ex.type,
            title: ex.title,
            data: ex.data,
            scoring: ex.scoring
        }))
    };
    
    try {
        const response = await fetch(`${apiBaseUrl}/sections/${currentEditingExerciseSection.id}/test`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify(testData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Итоговый тест успешно сохранен!', 'success');
            // Обновляем исходное состояние для проверки изменений
            originalExerciseState = {
                type: 'test',
                data: {
                    deadline: deadline,
                    timeLimit: {
                        enabled: noTimeLimitChecked,
                        days: timelimitDays,
                        hours: timelimitHours,
                        minutes: timelimitMinutes
                    },
                    exercises: JSON.parse(JSON.stringify(currentTestData.exercises))
                }
            };
            hasExerciseUnsavedChanges = false;
        } else {
            showNotification('Ошибка при сохранении: ' + (data.message || 'Неизвестная ошибка'), 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка при сохранении', 'error');
    }
}

// ===== КАСТОМНЫЙ DATETIME PICKER =====
class CustomDateTimePicker {
    constructor(triggerId, hiddenInputId, popupId) {
        this.trigger = document.getElementById(triggerId);
        this.hiddenInput = document.getElementById(hiddenInputId);
        this.popup = document.getElementById(popupId);
        
        this.currentDate = new Date();
        this.selectedDate = null;
        this.selectedHour = 12;
        this.selectedMinute = 0;
        
        this.init();
    }
    
    init() {
        if (!this.trigger || !this.popup) return;
        
        // Открытие/закрытие попапа
        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePopup();
        });
        
        // Закрытие при клике вне
        document.addEventListener('click', (e) => {
            if (!this.popup.contains(e.target) && e.target !== this.trigger) {
                this.popup.style.display = 'none';
                this.trigger.classList.remove('active');
            }
        });
        
        // Инициализация календаря
        this.renderCalendar();
        
        // Обработчики навигации
        document.getElementById('prevMonth')?.addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.renderCalendar();
        });
        
        document.getElementById('nextMonth')?.addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.renderCalendar();
        });
        
        // Обработчики времени
        const hourInput = document.getElementById('hourInput');
        const minuteInput = document.getElementById('minuteInput');
        
        hourInput?.addEventListener('change', (e) => {
            this.selectedHour = parseInt(e.target.value) || 0;
        });
        
        minuteInput?.addEventListener('change', (e) => {
            this.selectedMinute = parseInt(e.target.value) || 0;
        });
        
        // Очистка
        document.getElementById('clearDatetime')?.addEventListener('click', () => {
            this.clear();
        });
        
        // Отмена
        document.getElementById('cancelDatetime')?.addEventListener('click', () => {
            this.popup.style.display = 'none';
            this.trigger.classList.remove('active');
        });
        
        // Применение
        document.getElementById('confirmDatetime')?.addEventListener('click', () => {
            this.apply();
        });
        
        // Загрузка сохраненного значения
        this.loadSavedValue();
    }
    
    togglePopup() {
        const isVisible = this.popup.style.display === 'block';
        this.popup.style.display = isVisible ? 'none' : 'block';
        this.trigger.classList.toggle('active', !isVisible);
        
        if (!isVisible) {
            this.renderCalendar();
        }
    }
    
    renderCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // Обновляем заголовок
        const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                           'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;
        
        // Получаем первый день месяца и количество дней
        const firstDay = new Date(year, month, 1);
        const startDay = firstDay.getDay() || 7; // Преобразуем воскресенье (0) в 7
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Дни предыдущего месяца
        const prevMonthDays = new Date(year, month, 0).getDate();
        
        const daysContainer = document.getElementById('calendarDays');
        daysContainer.innerHTML = '';
        
        // Заполняем дни предыдущего месяца
        for (let i = startDay - 1; i > 0; i--) {
            const day = prevMonthDays - i + 1;
            const dayBtn = this.createDayButton(day, true);
            daysContainer.appendChild(dayBtn);
        }
        
        // Заполняем дни текущего месяца
        for (let day = 1; day <= daysInMonth; day++) {
            const dayBtn = this.createDayButton(day, false);
            daysContainer.appendChild(dayBtn);
        }
        
        // Заполняем дни следующего месяца (чтобы было 6 строк)
        const totalCells = Math.ceil((startDay - 1 + daysInMonth) / 7) * 7;
        const remainingCells = totalCells - (startDay - 1 + daysInMonth);
        
        for (let day = 1; day <= remainingCells; day++) {
            const dayBtn = this.createDayButton(day, true);
            daysContainer.appendChild(dayBtn);
        }
    }
    
    createDayButton(day, isOtherMonth) {
        const btn = document.createElement('button');
        btn.className = 'calendar-day';
        if (isOtherMonth) btn.classList.add('other-month');
        btn.textContent = day;
        
        // Проверка, выбран ли этот день
        if (this.selectedDate && !isOtherMonth && 
            this.selectedDate.getDate() === day && 
            this.selectedDate.getMonth() === this.currentDate.getMonth() &&
            this.selectedDate.getFullYear() === this.currentDate.getFullYear()) {
            btn.classList.add('selected');
        }
        
        // Проверка, сегодняшний ли день
        const today = new Date();
        if (!isOtherMonth && 
            today.getDate() === day && 
            today.getMonth() === this.currentDate.getMonth() &&
            today.getFullYear() === this.currentDate.getFullYear()) {
            btn.classList.add('today');
        }
        
        btn.addEventListener('click', () => {
            if (!isOtherMonth) {
                // Убираем выделение с других дней
                document.querySelectorAll('.calendar-day.selected').forEach(el => {
                    el.classList.remove('selected');
                });
                btn.classList.add('selected');
                
                this.selectedDate = new Date(this.currentDate.getFullYear(), 
                                            this.currentDate.getMonth(), day);
            }
        });
        
        return btn;
    }
    
    apply() {
        if (this.selectedDate) {
            // Устанавливаем время
            this.selectedDate.setHours(this.selectedHour, this.selectedMinute);
            
            // Форматируем для datetime-local
            const year = this.selectedDate.getFullYear();
            const month = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
            const day = String(this.selectedDate.getDate()).padStart(2, '0');
            const hours = String(this.selectedDate.getHours()).padStart(2, '0');
            const minutes = String(this.selectedDate.getMinutes()).padStart(2, '0');
            
            const formattedValue = `${year}-${month}-${day}T${hours}:${minutes}`;
            this.hiddenInput.value = formattedValue;
            
            // Обновляем текст на кнопке
            const dateStr = `${day}.${month}.${year} ${hours}:${minutes}`;
            const span = this.trigger.querySelector('span');
            if (span) span.textContent = dateStr;
        }
        
        this.popup.style.display = 'none';
        this.trigger.classList.remove('active');
        
        // Триггерим событие change для совместимости
        this.hiddenInput.dispatchEvent(new Event('change'));
    }
    
    clear() {
        this.selectedDate = null;
        this.selectedHour = 12;
        this.selectedMinute = 0;
        this.hiddenInput.value = '';
        
        const span = this.trigger.querySelector('span');
        if (span) span.textContent = 'Выберите дату и время';
        
        document.getElementById('hourInput').value = 12;
        document.getElementById('minuteInput').value = 0;
        
        this.renderCalendar();
    }
    
    loadSavedValue() {
        const savedValue = this.hiddenInput.value;
        if (savedValue) {
            const [datePart, timePart] = savedValue.split('T');
            const [year, month, day] = datePart.split('-');
            const [hours, minutes] = timePart.split(':');
            
            this.selectedDate = new Date(year, month - 1, day);
            this.selectedHour = parseInt(hours);
            this.selectedMinute = parseInt(minutes);
            
            // Обновляем отображение
            const dateStr = `${day}.${month}.${year} ${hours}:${minutes}`;
            const span = this.trigger.querySelector('span');
            if (span) span.textContent = dateStr;
            
            document.getElementById('hourInput').value = this.selectedHour;
            document.getElementById('minuteInput').value = this.selectedMinute;
        }
    }
    
    getValue() {
        return this.hiddenInput.value;
    }
}

// Инициализация после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    // Инициализируем кастомный datetime picker
    if (document.getElementById('datetimeTrigger')) {
        window.customDateTimePicker = new CustomDateTimePicker(
            'datetimeTrigger', 
            'testDeadline', 
            'datetimePopup'
        );
    }
});

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
const addFillBlanksWordBtn = document.getElementById('addFillBlanksWordBtn');
const addFillBlanksSentenceBtn = document.getElementById('addFillBlanksSentenceBtn');
const typeDropdownBtn = document.getElementById('selectedTypeBtn');
const typeDropdownMenu = document.getElementById('typeDropdownMenu');
// Обработчики для редактора тестов
const backFromTestBtn = document.getElementById('backToStructureFromTestBtn');
const saveTestBtn = document.getElementById('saveTestBtn');
const addTestExerciseBtn = document.getElementById('addTestExerciseBtn');
const timelimitEnabled = document.getElementById('timelimitEnabled');
const timelimitFields = document.getElementById('timelimitFields');

// Добавьте эти обработчики после загрузки страницы (в конец файла, где другие обработчики)

// Обработчик изменения дедлайна
const testDeadlineInput = document.getElementById('testDeadline');
if (testDeadlineInput) {
    testDeadlineInput.addEventListener('change', () => {
        checkExerciseUnsavedChanges();
    });
}

// Обработчики изменения полей времени
const timelimitDaysInput = document.getElementById('timelimitDays');
const timelimitHoursInput = document.getElementById('timelimitHours');
const timelimitMinutesInput = document.getElementById('timelimitMinutes');

if (timelimitDaysInput) {
    timelimitDaysInput.addEventListener('change', () => {
        checkExerciseUnsavedChanges();
    });
}
if (timelimitHoursInput) {
    timelimitHoursInput.addEventListener('change', () => {
        checkExerciseUnsavedChanges();
    });
}
if (timelimitMinutesInput) {
    timelimitMinutesInput.addEventListener('change', () => {
        checkExerciseUnsavedChanges();
    });
}

if (backFromTestBtn) {
    backFromTestBtn.addEventListener('click', backToSectionsFromTest);
}
if (saveTestBtn) {
    saveTestBtn.addEventListener('click', saveTestSection);
}
if (addTestExerciseBtn) {
    addTestExerciseBtn.addEventListener('click', addTestExercise);
}
if (timelimitEnabled && timelimitFields) {
    timelimitEnabled.addEventListener('change', (e) => {
        timelimitFields.style.display = !e.target.checked ? 'flex' : 'none';
        currentTestData.timeLimit.enabled = e.target.checked;
        checkExerciseUnsavedChanges();  // ← уже есть
    });
}
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
if (addFillBlanksWordBtn) {
    addFillBlanksWordBtn.addEventListener('click', addFillBlanksWord);
}
if (addFillBlanksSentenceBtn) {
    addFillBlanksSentenceBtn.addEventListener('click', addFillBlanksSentence);
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
        const newType = option.dataset.type;
        
        if (newType === currentExerciseType) {
            if (typeDropdownMenu) typeDropdownMenu.style.display = 'none';
            if (typeDropdownBtn) typeDropdownBtn.classList.remove('active');
            return;
        }
        
        switchExerciseType(newType);
        
        if (typeDropdownMenu) typeDropdownMenu.style.display = 'none';
        if (typeDropdownBtn) typeDropdownBtn.classList.remove('active');
    });
});

// Закрытие меню при клике вне (глобально)
document.addEventListener('click', function() {
    document.querySelectorAll('.matching-select-menu').forEach(menu => {
        menu.style.display = 'none';
    });
    document.querySelectorAll('.matching-select-btn').forEach(btn => {
        btn.classList.remove('active');
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

// Добавьте в конец файла, перед loadCourseData()
setInterval(() => {
    if (currentExerciseType === 'test' && originalExerciseState === null && currentEditingExerciseSection) {
        console.trace('originalExerciseState стал null!');
    }
}, 500);

function handleMoveUp(e) {
    e.stopPropagation();
    const exerciseId = e.currentTarget.dataset.exerciseId;
    moveTestExerciseUp(exerciseId);
}

function handleMoveDown(e) {
    e.stopPropagation();
    const exerciseId = e.currentTarget.dataset.exerciseId;
    moveTestExerciseDown(exerciseId);
}

loadCourseData();
