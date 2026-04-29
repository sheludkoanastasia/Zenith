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

// Добавляем переменные для отслеживания попыток теста
let currentTestId = null;
let testAttemptsCount = 0;
const MAX_TEST_ATTEMPTS = 4;

// Хранилище для баллов за попытки
let testAttemptsScores = []; // Массив для хранения результатов каждой попытки

function getToken() {
    return localStorage.getItem('token');
}

function getStorageKey(testId) {
    const role = currentUserRole === 'student' ? 'student' : 'teacher';
    return `test_state_${testId}_${role}`;
}

// ===== ФУНКЦИИ ДЛЯ РАБОТЫ С ТЕСТАМИ (СЕРВЕР) =====


// Загрузка состояния теста с сервера
async function loadTestStateFromServer(testId) {
    if (currentUserRole !== 'student') return null;
    
    try {
        const token = getToken();
        console.log('Загружаем попытки с сервера для testId:', testId);
        
        const response = await fetch(`${apiBaseUrl}/student/test/${testId}/attempts`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            console.error('Ошибка загрузки попыток с сервера, статус:', response.status);
            return null;
        }
        
        const data = await response.json();
        console.log('Загружены попытки с сервера:', data);
        
        if (data.success && data.attempts && data.attempts.length > 0) {
            return {
                attemptsCount: data.attempts.length,
                attempts: data.attempts,
                maxAttempts: data.maxAttempts || 4
            };
        }
        
        return { attemptsCount: 0, attempts: [], maxAttempts: 4 };
    } catch (error) {
        console.error('Ошибка загрузки состояния теста с сервера:', error);
        return null;
    }
}

function getExerciseAnswers(exerciseId, card, typeText) {
    const answers = {};
    
    // Проверяем, является ли упражнение полностью правильным
    const testId = card.dataset.sectionId;
    const isFullyCorrect = localStorage.getItem(`exercise_fully_correct_${testId}_${exerciseId}`) === 'true';
    
    console.log(`getExerciseAnswers для упражнения ${exerciseId}, тип: ${typeText}, isFullyCorrect: ${isFullyCorrect}`);
    
    if (typeText === 'Сопоставление') {
        const selectWrappers = card.querySelectorAll('.matching-select-wrapper');
        let hasSelected = false;
        
        selectWrappers.forEach(wrapper => {
            const targetId = wrapper.dataset.targetId;
            const selectedOption = wrapper.querySelector('.matching-select-option.selected');
            if (selectedOption && selectedOption.dataset.value) {
                answers[targetId] = selectedOption.dataset.value;
                hasSelected = true;
                console.log(`Собран ответ matching: targetId=${targetId}, value=${selectedOption.dataset.value}`);
            }
        });
        
        // Если нет выбранных ответов, но упражнение полностью правильное – берём из data-атрибутов правильные ответы
        if (!hasSelected && isFullyCorrect) {
            const rows = card.querySelectorAll('.matching-row-preview');
            rows.forEach(row => {
                const targetId = row.dataset.targetId;
                const correctItemNumber = row.dataset.correctItemNumber;
                if (correctItemNumber && correctItemNumber !== '0') {
                    const wrapper = row.querySelector(`.matching-select-wrapper[data-target-id="${targetId}"]`);
                    if (wrapper) {
                        const correctOption = wrapper.querySelector(`.matching-select-option[data-item-number="${correctItemNumber}"]`);
                        if (correctOption && correctOption.dataset.value) {
                            answers[targetId] = correctOption.dataset.value;
                            console.log(`Восстановлен правильный ответ matching: targetId=${targetId}, value=${correctOption.dataset.value}`);
                        }
                    }
                }
            });
        }
    } 
    else if (typeText === 'Выбор правильного') {
        const statementCards = card.querySelectorAll('.preview-statement-card');
        let hasSelected = false;
        
        statementCards.forEach(statementCard => {
            const statementId = statementCard.dataset.statementId;
            const selectedCheckboxes = statementCard.querySelectorAll('.checkbox-student.selected');
            const answerIds = [];
            selectedCheckboxes.forEach(checkbox => {
                answerIds.push(checkbox.dataset.answerId);
                hasSelected = true;
            });
            if (answerIds.length > 0) {
                answers[statementId] = answerIds;
                console.log(`Собран ответ choice: statementId=${statementId}, answers=${answerIds.join(',')}`);
            }
        });
        
        // Если нет выбранных ответов, но упражнение полностью правильное – берём из data-атрибутов
        if (!hasSelected && isFullyCorrect) {
            statementCards.forEach(statementCard => {
                const statementId = statementCard.dataset.statementId;
                let correctAnswers = [];
                try {
                    const correctAnswersAttr = statementCard.getAttribute('data-correct-answers');
                    if (correctAnswersAttr) {
                        correctAnswers = JSON.parse(correctAnswersAttr);
                        correctAnswers = correctAnswers.map(id => String(id));
                        answers[statementId] = correctAnswers;
                        console.log(`Восстановлен правильный ответ choice: statementId=${statementId}, answers=${correctAnswers.join(',')}`);
                    }
                } catch(e) {}
            });
        }
    } 
    else if (typeText === 'Дополнение') {
        const sentenceCards = card.querySelectorAll('.preview-sentence-card');
        let hasSelected = false;
        
        sentenceCards.forEach(sentenceCard => {
            const sentenceId = sentenceCard.dataset.sentenceId;
            const selectWrappers = sentenceCard.querySelectorAll('.fillblanks-select-wrapper');
            const selectedWords = [];
            selectWrappers.forEach(wrapper => {
                const selectedOption = wrapper.querySelector('.fillblanks-select-option.selected');
                if (selectedOption && selectedOption.dataset.value) {
                    selectedWords.push(selectedOption.dataset.value);
                    hasSelected = true;
                } else {
                    selectedWords.push('');
                }
            });
            if (selectedWords.some(w => w !== '')) {
                answers[sentenceId] = selectedWords;
                console.log(`Собран ответ fill_blanks: sentenceId=${sentenceId}, words=${selectedWords.join(',')}`);
            }
        });
        
        // Если нет выбранных слов, но упражнение полностью правильное – берём из data-атрибутов правильные ответы
        if (!hasSelected && isFullyCorrect) {
            sentenceCards.forEach(sentenceCard => {
                const sentenceId = sentenceCard.dataset.sentenceId;
                let correctAnswers = [];
                try {
                    correctAnswers = JSON.parse(sentenceCard.dataset.correctAnswers || '[]');
                    if (correctAnswers.length > 0) {
                        answers[sentenceId] = correctAnswers;
                        console.log(`Восстановлен правильный ответ fill_blanks: sentenceId=${sentenceId}, words=${correctAnswers.join(',')}`);
                    }
                } catch(e) {}
            });
        }
    }
    
    console.log(`getExerciseAnswers результат для ${exerciseId}:`, answers);
    return answers;
}

async function restoreTestFromServer(testId) {
  // ВАЖНО: проверяем, что восстанавливаем именно текущий тест
  if (currentTestId !== testId) {
    console.log(`[restoreTestFromServer] Skipping - testId mismatch: ${testId} vs current ${currentTestId}`);
    return false;
  }
  
  const serverState = await loadTestStateFromServer(testId);
  if (!serverState || serverState.attemptsCount === 0) {
    console.log('Нет сохранённых попыток на сервере');
    return false;
  }
  
  console.log('Восстанавливаем состояние теста с сервера, попыток:', serverState.attemptsCount);
  
  const lastAttempt = serverState.attempts[serverState.attempts.length - 1];
  if (!lastAttempt) return false;
  
  // Проверяем, что восстанавливаемые данные относятся к текущему тесту
  // (можно добавить проверку по timestamp или ID)
  
  testAttemptsCount = serverState.attemptsCount;
  updateTestAttemptsDisplay();
  
  // Ждём появления карточек
  let retries = 0;
  let exerciseCards = document.querySelectorAll('#previewTestExercisesList .preview-test-exercise-card');
  while (exerciseCards.length === 0 && retries < 10) {
    await new Promise(resolve => setTimeout(resolve, 100));
    exerciseCards = document.querySelectorAll('#previewTestExercisesList .preview-test-exercise-card');
    retries++;
  }
  
  if (lastAttempt.exerciseResults) {
    let totalRestoredScore = 0;
    
    for (const card of exerciseCards) {
      const exerciseId = card.dataset.exerciseId;
      const exerciseResult = lastAttempt.exerciseResults[exerciseId];
      
      if (exerciseResult) {
        // Восстанавливаем баллы
        const scoreSpan = card.querySelector('.exercise-score-value');
        if (scoreSpan) {
          scoreSpan.textContent = exerciseResult.score || 0;
          totalRestoredScore += exerciseResult.score || 0;
        }
        
        // Восстанавливаем ответы
        const typeText = card.querySelector('.exercise-type-preview')?.textContent || '';
        if (exerciseResult.answers && Object.keys(exerciseResult.answers).length > 0) {
          restoreExerciseAnswers(card, exerciseResult.answers, typeText);
        }
        
        // Блокируем полностью правильные упражнения
        if (exerciseResult.isFullyCorrect) {
          localStorage.setItem(`exercise_fully_correct_${testId}_${exerciseId}`, 'true');
          let exerciseType = '';
          if (typeText === 'Сопоставление') exerciseType = 'matching';
          else if (typeText === 'Выбор правильного') exerciseType = 'choice';
          else if (typeText === 'Дополнение') exerciseType = 'fill_blanks';
          if (exerciseType) lockExercise(card, exerciseType);
        }
      }
    }
    
    // Обновляем общие баллы
    const totalScoreElement = document.getElementById('totalTestScore');
    if (totalScoreElement) totalScoreElement.textContent = totalRestoredScore;
    
    console.log('Состояние теста успешно восстановлено с сервера');
    return true;
  }
  
  return false;
}

async function saveTestStateToServer(testId, attemptNumber, totalScore, maxScore, exerciseResults) {
     if (currentUserRole !== 'student') return false;
    // Не сохраняем нулевую попытку
    if (attemptNumber === 0) {
        console.log('Попытка с номером 0 не сохраняется на сервер');
        return false;
    }
    
    try {
        const token = getToken();
        console.log('=== saveTestStateToServer ===');
        console.log('testId:', testId);
        console.log('attemptNumber:', attemptNumber);
        console.log('totalScore:', totalScore);
        console.log('maxScore:', maxScore);
        console.log('exerciseResults:', JSON.stringify(exerciseResults, null, 2));
        
        const response = await fetch(`${apiBaseUrl}/student/test/${testId}/attempt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                attemptNumber,
                totalScore,
                maxScore,
                exerciseResults
            })
        });
        
        const data = await response.json();
        console.log('Ответ сервера при сохранении:', data);
        
        if (data.success) {
            console.log(`Попытка ${attemptNumber} сохранена на сервере`);
            return true;
        } else {
            console.error('Ошибка сохранения попытки:', data.message);
            return false;
        }
    } catch (error) {
        console.error('Ошибка при сохранении попытки на сервер:', error);
        return false;
    }
}

function collectExerciseResultsForSave() {
    const exerciseCards = document.querySelectorAll('#previewTestExercisesList .preview-test-exercise-card');
    const exerciseResults = {};
    let totalScore = 0;
    let totalMaxScore = 0;
    
    console.log('=== collectExerciseResultsForSave ===');
    console.log('Найдено карточек упражнений:', exerciseCards.length);
    
    for (const card of exerciseCards) {
        const exerciseId = card.dataset.exerciseId;
        const testId = card.dataset.sectionId;
        
        const scoreSpan = card.querySelector('.exercise-score-value');
        const maxScoreSpan = card.querySelector('.exercise-score-max');
        
        const score = parseInt(scoreSpan?.textContent || '0');
        const maxScoreText = maxScoreSpan?.textContent || '/ 100';
        const maxScore = parseInt(maxScoreText.replace('/', '').trim());
        
        console.log(`Упражнение ${exerciseId}: score=${score}, maxScore=${maxScore}`);
        
        totalScore += score;
        totalMaxScore += maxScore;
        
        const typeText = card.querySelector('.exercise-type-preview')?.textContent || '';
        
        // ВАЖНО: вызываем getExerciseAnswers для сбора ответов
        const answers = getExerciseAnswers(exerciseId, card, typeText);
        console.log(`Собранные answers для упражнения ${exerciseId}:`, answers);
        
        const isFullyCorrect = localStorage.getItem(`exercise_fully_correct_${testId}_${exerciseId}`) === 'true';
        
        exerciseResults[exerciseId] = {
            score: score,
            maxScore: maxScore,
            isFullyCorrect: isFullyCorrect,
            answers: answers,
            type: typeText === 'Сопоставление' ? 'matching' : 
                   typeText === 'Выбор правильного' ? 'choice' : 'fill_blanks'
        };
    }
    
    console.log('Итоговый totalScore:', totalScore);
    console.log('Итоговый totalMaxScore:', totalMaxScore);
    console.log('exerciseResults:', exerciseResults);
    
    return { exerciseResults, totalScore, totalMaxScore };
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
    currentTestId = null;
    testAttemptsCount = 0;
    testAttemptsScores = [];
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
            if (currentUserRole) {
                document.body.setAttribute('data-user-role', currentUserRole);
            }
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
      
      // === НОВАЯ ЛОГИКА СБРОСА ===
      if (section.needsReset === true) {
        console.log('[Version Reset] Theory section needs reset');
        clearSectionLocalStorage(sectionId);
        showVersionResetNotification();
        
        if (currentUserRole === 'student') {
          // Обновляем состояние кнопки теории (сбрасываем на "не пройдено")
          updateTheoryButtonState(sectionId, false);
        }
      }
      // ===========================
      
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
      
      // === НОВАЯ ЛОГИКА СБРОСА ===
      if (section.needsReset === true) {
        console.log('[Version Reset] Exercise section needs reset');
        clearSectionLocalStorage(sectionId);
        showVersionResetNotification();
        
        if (currentUserRole === 'student') {
          // Обновляем состояние кнопки упражнения (сбрасываем на "не пройдено")
          updateExerciseButtonState(sectionId, false);
        }
      }
      // ===========================
      
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
          
          const isCompleted = await checkExerciseStatus(sectionId);
          
          const savedAnswers = localStorage.getItem(`matching_answers_${sectionId}`);
          if (savedAnswers && !section.needsReset) {
            const userPairs = JSON.parse(savedAnswers);
            setTimeout(() => {
              const selectWrappers = document.querySelectorAll('#matchingExercisePreview .matching-select-wrapper');
              selectWrappers.forEach(wrapper => {
                const targetId = wrapper.dataset.targetId;
                const savedItemId = userPairs[targetId];
                if (savedItemId) {
                  const option = wrapper.querySelector(`.matching-select-option[data-value="${savedItemId}"]`);
                  if (option) {
                    const text = option.textContent;
                    const btn = wrapper.querySelector('.matching-select-btn');
                    btn.querySelector('.selected-text').textContent = text;
                    option.classList.add('selected');
                  }
                }
              });
            }, 100);
          }
          
          if (isCompleted) {
            setTimeout(() => {
              const selectWrappers = document.querySelectorAll('#matchingExercisePreview .matching-select-wrapper');
              selectWrappers.forEach(wrapper => {
                const btn = wrapper.querySelector('.matching-select-btn');
                btn.classList.add('success-highlight-permanent');
                btn.disabled = true;
                btn.style.cursor = 'default';
                btn.style.opacity = '0.8';
                const chevron = btn.querySelector('.select-chevron');
                if (chevron) chevron.style.display = 'none';
              });
            }, 100);
          }
          updateExerciseButtonState(sectionId, isCompleted);
          
        } else if (exerciseType === 'choice') {
          console.log('Загружаем choice упражнение, section.id:', section.id);
          document.getElementById('choiceExercisePreview').style.display = 'block';
          renderStudentChoice(exerciseData, 'choiceExercisePreview');
          
          const isCompleted = await checkExerciseStatus(sectionId);
          
          const savedAnswers = localStorage.getItem(`choice_answers_${sectionId}`);
          if (savedAnswers && !section.needsReset) {
            const userAnswers = JSON.parse(savedAnswers);
            setTimeout(() => {
              for (const [statementId, answerIds] of Object.entries(userAnswers)) {
                for (const answerId of answerIds) {
                  const checkbox = document.querySelector(`#choiceExercisePreview .checkbox-student[data-statement-id="${statementId}"][data-answer-id="${answerId}"]`);
                  if (checkbox) {
                    checkbox.classList.add('selected');
                  }
                }
              }
            }, 100);
          }
          
          if (isCompleted) {
            setTimeout(() => {
              const statementCards = document.querySelectorAll('#choiceExercisePreview .preview-statement-card');
              statementCards.forEach(card => {
                const checkboxes = card.querySelectorAll('.checkbox-student');
                checkboxes.forEach(checkbox => {
                  checkbox.style.pointerEvents = 'none';
                  checkbox.style.opacity = '0.8';
                  if (checkbox.classList.contains('selected')) {
                    checkbox.classList.add('success-highlight-permanent');
                  }
                });
              });
            }, 100);
          }
          updateExerciseButtonState(sectionId, isCompleted);
        } else if (exerciseType === 'fill_blanks') {
          document.getElementById('fillBlanksExercisePreview').style.display = 'block';
          renderStudentFillBlanks(exerciseData, 'fillBlanksExercisePreview');
          
          const isCompleted = await checkExerciseStatus(sectionId);
          
          const savedAnswers = localStorage.getItem(`fillblanks_answers_${sectionId}`);
          if (savedAnswers && !section.needsReset) {
            const userAnswers = JSON.parse(savedAnswers);
            setTimeout(() => {
              for (const [sentenceId, words] of Object.entries(userAnswers)) {
                const sentenceCard = document.querySelector(`#fillBlanksExercisePreview .preview-sentence-card[data-sentence-id="${sentenceId}"]`);
                if (sentenceCard) {
                  const blankWrappers = sentenceCard.querySelectorAll('.fillblanks-select-wrapper');
                  blankWrappers.forEach((wrapper, idx) => {
                    const selectedWord = words[idx];
                    if (selectedWord) {
                      const option = wrapper.querySelector(`.fillblanks-select-option[data-value="${selectedWord}"]`);
                      if (option) {
                        const btn = wrapper.querySelector('.fillblanks-select-btn');
                        btn.querySelector('.selected-text').textContent = selectedWord;
                        option.classList.add('selected');
                      }
                    }
                  });
                }
              }
            }, 100);
          }
          
          if (isCompleted) {
            setTimeout(() => {
              const allSelectWrappers = document.querySelectorAll('#fillBlanksExercisePreview .fillblanks-select-wrapper');
              allSelectWrappers.forEach(wrapper => {
                const btn = wrapper.querySelector('.fillblanks-select-btn');
                btn.classList.add('success-highlight-permanent');
                btn.disabled = true;
                btn.style.cursor = 'default';
                btn.style.opacity = '0.8';
                const chevron = btn.querySelector('.select-chevron');
                if (chevron) chevron.style.display = 'none';
              });
            }, 100);
          }
          updateExerciseButtonState(sectionId, isCompleted);
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
      
      // Обновляем кнопку "Следующий шаг" для учителя
      if (currentUserRole === 'teacher') {
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

// Сброс состояния теста (при загрузке новой страницы)
function resetTestState(testId) {
    // Проверяем, нужно ли сбрасывать (по времени или по флагу)
    const resetKey = `test_state_reset_${testId}`;
    const lastReset = localStorage.getItem(resetKey);
    const now = Date.now();
    
    // Если сброс был более часа назад или никогда, сбрасываем
    if (!lastReset || (now - parseInt(lastReset)) > 3600000) {
        console.log('Сброс состояния теста (прошло более часа)');
        localStorage.removeItem(`test_state_${testId}`);
        localStorage.setItem(resetKey, now.toString());
    }
}

async function loadTestSection(sectionId) {
  try {
    console.log(`[loadTestSection] Loading section ${sectionId}`);
    
    const sectionsAreaEl = document.getElementById('sectionsArea');
    const welcomeScreenEl = document.getElementById('welcomeScreen');
    if (sectionsAreaEl) sectionsAreaEl.style.display = 'none';
    if (welcomeScreenEl) welcomeScreenEl.style.display = 'none';
    
    const token = getToken();
    const response = await fetch(`${apiBaseUrl}/sections/${sectionId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    console.log(`[loadTestSection] Response:`, data);
    
    if (data.success) {
      const section = data.section;
      
      console.log(`[loadTestSection] Section loaded: id=${section.id}, type=${section.type}, version=${section.version}, needsReset=${section.needsReset}`);
      
      currentEditingExerciseSection = section;
      currentEditingTheorySection = null;
      
      // === ПРОВЕРКА: загружаем новый тест, а не тот же самый ===
      const isNewTest = currentTestId !== sectionId;
      
      if (isNewTest) {
        console.log(`[loadTestSection] Switching from test ${currentTestId} to ${sectionId}`);
        // ПЕРЕД загрузкой нового теста - ПОЛНАЯ ОЧИСТКА
        fullResetTestState(sectionId);
      }
      
      // === НОВАЯ ЛОГИКА СБРОСА (если версия изменилась) ===
      const needsReset = section.needsReset === true;
      
      console.log('[loadTestSection] needsReset:', needsReset, 'section.version:', section.version, 'currentSectionId:', sectionId);
      
      if (needsReset) {
        console.log('[Version Reset] Test section needs reset - FULL RESET');
        
        // Очищаем localStorage для этого теста
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes(sectionId) || 
                      key.includes(`test_state_${sectionId}`) || 
                      key.includes(`exercise_fully_correct_${sectionId}`))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => {
          console.log('[Version Reset] Removing localStorage key:', key);
          localStorage.removeItem(key);
        });
        
        // ПОКАЗЫВАЕМ УВЕДОМЛЕНИЕ
        showVersionResetNotification();
        
        if (currentUserRole === 'student') {
          testAttemptsCount = 0;
          testAttemptsScores = [];
          updateTestAttemptsDisplay();
          
          // ⚠️ ИСПРАВЛЕНИЕ: НЕ вызываем resetTestUIWithScores() здесь,
          // потому что renderPreviewTestExercises создаст чистые карточки
          // А если нужно сбросить UI, то делаем это после рендера через флаг,
          // но не через setTimeout, который перезапишет максимальные баллы.
          // Вместо этого просто отметим, что нужно сбросить UI после рендера
        }
      }
      
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
      
      exercises.forEach(exercise => {
        if (!exercise.sectionId) {
          exercise.sectionId = sectionId;
        }
      });
      
      // Рендерим упражнения
      renderPreviewTestExercises(exercises);
      
      // Даём время для рендера карточек
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // === ВОССТАНОВЛЕНИЕ С СОХРАНЕНИЕМ ПОРЯДКА ===
      if (currentUserRole === 'student') {
        console.log('Загрузка теста для студента, section.id:', sectionId);
        
        // Получаем количество попыток с сервера ТОЛЬКО для текущего теста
        const serverAttempts = await getTestAttempts(sectionId);
        
        // НЕ используем локальные данные, только серверные
        testAttemptsCount = serverAttempts;
        console.log('Попытки с сервера:', testAttemptsCount);
        updateTestAttemptsDisplay();
        
        // Восстанавливаем состояние с сервера ТОЛЬКО если не было сброса И есть попытки
        if (!needsReset && testAttemptsCount > 0) {
          console.log('Восстанавливаем состояние теста с сервера');
          await restoreTestFromServer(sectionId);
          updateTotalTestScore();
        } else if (needsReset) {
          console.log('Был сброс версии, не восстанавливаем состояние');
          // ⚠️ ИСПРАВЛЕНИЕ: используем resetTestUI (без сброса баллов),
          // а не resetTestUIWithScores
          resetTestUI();
          updateTotalTestScore();  // Обновляем отображение баллов (максимальные уже установлены)
        } else if (testAttemptsCount === 0) {
          console.log('Нет сохранённых попыток, сбрасываем UI');
          resetTestUI();
          updateTotalTestScore();
        }
      }
      
      const previewContainer = document.getElementById('testPreviewContainer');
      const theoryPreviewContainer = document.getElementById('theoryPreviewContainer');
      const exercisePreviewContainer = document.getElementById('exercisePreviewContainer');
      
      if (theoryPreviewContainer) theoryPreviewContainer.style.display = 'none';
      if (exercisePreviewContainer) exercisePreviewContainer.style.display = 'none';
      if (previewContainer) previewContainer.style.display = 'block';
      
      // Настройка кнопок в зависимости от роли
      if (currentUserRole === 'student') {
        setTimeout(() => {
          updateTestButtons();
        }, 200);
      } else {
        setTimeout(() => {
          updateNextStepButton(sectionId);
        }, 100);
      }
      
      updateNextStepButton(sectionId);
      
    } else {
      showNotification('Ошибка загрузки раздела', 'error');
    }
  } catch (error) {
    console.error('Ошибка:', error);
    showNotification('Ошибка загрузки раздела', 'error');
  }
}

function resetTestScoresDisplay() {
    if (currentUserRole !== 'student') return;
    
    // НЕ сбрасываем общий балл, если он уже установлен
    // const totalScoreElement = document.getElementById('totalTestScore');
    // const totalMaxScoreElement = document.getElementById('totalTestMaxScore');
    // if (totalScoreElement) totalScoreElement.textContent = '0';
    
    // Сбрасываем баллы каждого упражнения ТОЛЬКО если они не были восстановлены
    const exerciseCards = document.querySelectorAll('#previewTestExercisesList .preview-test-exercise-card');
    exerciseCards.forEach(card => {
        const testId = card.dataset.sectionId;
        const exerciseId = card.dataset.exerciseId;
        
        // Проверяем, не было ли упражнение уже полностью выполнено
        const isFullyCorrect = localStorage.getItem(`exercise_fully_correct_${testId}_${exerciseId}`) === 'true';
        
        // Проверяем, есть ли уже сохранённый балл
        const scoreSpan = card.querySelector('.exercise-score-value');
        const currentScore = scoreSpan ? parseInt(scoreSpan.textContent) : 0;
        
        // Сбрасываем только если нет сохранённых данных и упражнение не выполнено
        if (!isFullyCorrect && currentScore === 0) {
            if (scoreSpan) {
                scoreSpan.textContent = '0';
            }
        }
        
        // Удаляем атрибут блокировки только если упражнение не было выполнено
        if (!isFullyCorrect) {
            card.removeAttribute('data-locked');
        }
        
        // Убираем классы блокировки (только если не выполнено)
        if (!isFullyCorrect) {
            const matchingBtns = card.querySelectorAll('.matching-select-btn');
            matchingBtns.forEach(btn => {
                btn.classList.remove('success-highlight-permanent');
                btn.disabled = false;
                btn.style.pointerEvents = '';
                btn.style.cursor = '';
                btn.style.opacity = '';
                const chevron = btn.querySelector('.select-chevron');
                if (chevron) chevron.style.display = '';
            });
            
            const fillBlanksBtns = card.querySelectorAll('.fillblanks-select-btn');
            fillBlanksBtns.forEach(btn => {
                btn.classList.remove('success-highlight-permanent');
                btn.disabled = false;
                btn.style.pointerEvents = '';
                btn.style.cursor = '';
                btn.style.opacity = '';
                const chevron = btn.querySelector('.select-chevron');
                if (chevron) chevron.style.display = '';
            });
            
            const checkboxes = card.querySelectorAll('.checkbox-student');
            checkboxes.forEach(checkbox => {
                checkbox.style.pointerEvents = '';
                checkbox.style.opacity = '';
                checkbox.classList.remove('success-highlight-permanent');
            });
        }
    });
}

function renderPreviewTestExercises(exercises) {
  const container = document.getElementById('previewTestExercisesList');
  if (!container) return;
  
  // ПЕРЕД рендером - сбрасываем отображение итоговых баллов
  const totalScoreElement = document.getElementById('totalTestScore');
  const totalMaxScoreElement = document.getElementById('totalTestMaxScore');
  if (totalScoreElement) totalScoreElement.textContent = '0';
  
  if (exercises.length === 0) {
    container.innerHTML = '<div class="empty-message">Нет тестирований</div>';
    if (totalMaxScoreElement) totalMaxScoreElement.textContent = '0';
    return;
  }
  
  container.innerHTML = '';
  
  // Суммируем максимальные баллы за все упражнения
  let totalMaxScore = 0;
  exercises.forEach(exercise => {
    const maxScore = exercise.scoring?.firstAttempt ?? 100;
    totalMaxScore += maxScore;
  });
  
  // Обновляем отображение итогового максимального балла
  if (totalMaxScoreElement) {
    totalMaxScoreElement.textContent = totalMaxScore;
  }
  
  exercises.forEach((exercise, idx) => {
    let typeText = '';
    switch (exercise.type) {
      case 'matching': typeText = 'Сопоставление'; break;
      case 'choice': typeText = 'Выбор правильного'; break;
      case 'fill_blanks': typeText = 'Дополнение'; break;
      default: typeText = 'Сопоставление';
    }
    
    const exerciseContainerId = `test-exercise-${exercise.id}-${Date.now()}-${idx}`;
    const maxScore = exercise.scoring?.firstAttempt ?? 100;
    
    const card = document.createElement('div');
    card.className = 'preview-test-exercise-card';
    card.dataset.exerciseId = exercise.id;
    card.dataset.sectionId = exercise.sectionId || currentTestId;
    card.dataset.maxScore = maxScore;
    card.dataset.firstAttempt = exercise.scoring?.firstAttempt ?? 100;
    card.dataset.secondAttempt = exercise.scoring?.secondAttempt ?? 50;
    card.dataset.thirdAttempt = exercise.scoring?.thirdAttempt ?? 25;
    card.dataset.subsequentAttempts = exercise.scoring?.subsequentAttempts ?? 0;
    
    // ВАЖНО: при создании карточки БАЛЛЫ ВСЕГДА 0
    const scoringHtml = currentUserRole === 'student' ? `
      <div class="exercise-score-container" id="score-container-${exercise.id}">
        <span class="exercise-score-label">Количество набранных баллов:</span>
        <span class="exercise-score-value" id="score-value-${exercise.id}">0</span>
        <span class="exercise-score-max">/ ${maxScore}</span>
      </div>
    ` : `
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
  
  // После рендера обновляем баллы и кнопки
  updateTotalTestScore();
  
  if (currentUserRole === 'student') {
    setTimeout(() => {
      updateTestButtons();
    }, 100);
  }
}

function updateTotalTestScore() {
    let totalScore = 0;
    let totalMaxScore = 0;
    
    const exerciseCards = document.querySelectorAll('#previewTestExercisesList .preview-test-exercise-card');
    exerciseCards.forEach(card => {
        const maxScoreSpan = card.querySelector('.exercise-score-max');
        const scoreSpan = card.querySelector('.exercise-score-value');
        
        if (maxScoreSpan) {
            const maxText = maxScoreSpan.textContent;
            const maxValue = parseInt(maxText.replace('/', '').trim());
            if (!isNaN(maxValue)) {
                totalMaxScore += maxValue;
            }
        }
        
        if (scoreSpan) {
            const scoreValue = parseInt(scoreSpan.textContent);
            if (!isNaN(scoreValue)) {
                totalScore += scoreValue;
            }
        }
    });
    
    const totalScoreElement = document.getElementById('totalTestScore');
    const totalMaxScoreElement = document.getElementById('totalTestMaxScore');
    
    if (totalScoreElement) totalScoreElement.textContent = totalScore;
    if (totalMaxScoreElement) totalMaxScoreElement.textContent = totalMaxScore;
    
    console.log('updateTotalTestScore: totalScore=', totalScore, 'totalMaxScore=', totalMaxScore);
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

window.addEventListener('beforeunload', () => {
    if (currentTestId && document.getElementById('testPreviewContainer').style.display === 'block') {
        saveTestState(currentTestId);
    }
});

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

// Также сохраняем при навигации назад
function backToSections() {
    // Сохраняем состояние теста перед уходом
    if (currentTestId && document.getElementById('testPreviewContainer').style.display === 'block' && testAttemptsCount > 0) {
        saveTestState(currentTestId);
    }
    
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
    
    console.log('Все разделы в порядке:', sectionsList.map(s => ({ id: s.sectionId, type: s.sectionType })));
    
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

// Найти функцию updateNextStepButton и заменить её на эту:

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
    
    const nextStepBtn = document.getElementById(`${activeContainer}NextStep`);
    const nextBtn = document.getElementById(`${activeContainer}NextBtn`);
    
    // Для учителя всегда показываем кнопку "Следующий шаг", если есть следующий раздел
    if (currentUserRole === 'teacher') {
        if (nextStepBtn) {
            if (hasNext) {
                nextStepBtn.style.display = 'flex';
            } else {
                nextStepBtn.style.display = 'none';
            }
        }
    } else if (currentUserRole === 'student') {
        // Для студента: показываем кнопку ТОЛЬКО если есть следующий раздел
        // Кнопка становится видимой после того, как раздел пройден (через updateTheoryButtonState / updateExerciseButtonState / updateTestButtons)
        // Но даже если она видима, при отсутствии следующего раздела её нужно скрыть
        if (nextStepBtn) {
            if (hasNext) {
                // Кнопка будет показана только если раздел пройден (это обрабатывается в других функциях)
                // Здесь мы только устанавливаем, что кнопка может быть показана, но фактическое отображение управляется из других мест
                // Оставляем как есть - другие функции управляют display
            } else {
                // Если нет следующего раздела - скрываем кнопку полностью
                nextStepBtn.style.display = 'none';
                if (nextBtn) nextBtn.style.display = 'none';
            }
        }
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
        
        // Привязываем обработчики для кнопок "Следующий шаг"
        const theoryNextBtn = document.getElementById('theoryNextBtn');
        const exerciseNextBtn = document.getElementById('exerciseNextBtn');
        const testNextBtn = document.getElementById('testNextBtn');
        
        if (theoryNextBtn) {
            const newBtn = theoryNextBtn.cloneNode(true);
            theoryNextBtn.parentNode.replaceChild(newBtn, theoryNextBtn);
            newBtn.addEventListener('click', navigateToNextSection);
        }
        
        if (exerciseNextBtn) {
            const newBtn = exerciseNextBtn.cloneNode(true);
            exerciseNextBtn.parentNode.replaceChild(newBtn, exerciseNextBtn);
            newBtn.addEventListener('click', navigateToNextSection);
        }
        
        if (testNextBtn) {
            const newBtn = testNextBtn.cloneNode(true);
            testNextBtn.parentNode.replaceChild(newBtn, testNextBtn);
            newBtn.addEventListener('click', navigateToNextSection);
        }
    } 
    else if (currentUserRole === 'student') {
        document.querySelectorAll('.next-step-btn').forEach(btn => {
            btn.style.display = 'none';
        });
        document.querySelectorAll('.submit-solution-btn').forEach(btn => {
            btn.style.display = 'flex';
        });
        
        // Функция для привязки обработчика к кнопке упражнения
        function bindExerciseSubmitHandler() {
            const exerciseSubmitBtn = document.getElementById('exerciseSubmitBtn');
            if (exerciseSubmitBtn) {
                const newBtn = exerciseSubmitBtn.cloneNode(true);
                exerciseSubmitBtn.parentNode.replaceChild(newBtn, exerciseSubmitBtn);
                
                newBtn.addEventListener('click', async () => {
                    console.log('Кнопка упражнения нажата');
                    const exerciseType = currentEditingExerciseSection?.exercise?.exercise_type || 'matching';
                    
                    if (exerciseType === 'matching') {
                        await submitMatchingSolution(currentEditingExerciseSection.id);
                    } else if (exerciseType === 'choice') {
                        await submitChoiceSolution(currentEditingExerciseSection.id);
                    } else if (exerciseType === 'fill_blanks') {
                        await submitFillBlanksSolution(currentEditingExerciseSection.id);
                    }
                });
            }
        }
        
        // Функция для привязки обработчика к кнопке теста
        function bindTestSubmitHandler() {
            const testSubmitBtn = document.getElementById('testSubmitBtn');
            if (testSubmitBtn) {
                const newBtn = testSubmitBtn.cloneNode(true);
                testSubmitBtn.parentNode.replaceChild(newBtn, testSubmitBtn);
                newBtn.addEventListener('click', async () => {
                    console.log('====== НАЧАЛО ПРОВЕРКИ ТЕСТА ======');
                    const isValid = await validateAndSubmitTest();
                    if (isValid) {
                        showNotification('Тест успешно проверен!', 'success');
                        updateTestButtons();
                    }
                });
            }
        }
        
        // Функция для привязки обработчика к кнопке теории
        function bindTheoryNextHandler() {
            const theoryNextBtn = document.getElementById('theoryNextBtn');
            if (theoryNextBtn) {
                const newBtn = theoryNextBtn.cloneNode(true);
                theoryNextBtn.parentNode.replaceChild(newBtn, theoryNextBtn);
                newBtn.addEventListener('click', navigateToNextSection);
            }
        }
        
        // Вызываем привязку сразу
        bindExerciseSubmitHandler();
        bindTestSubmitHandler();
        bindTheoryNextHandler();
        
        // Повторяем привязку через интервал, так как кнопки могут пересоздаваться
        setInterval(() => {
            bindExerciseSubmitHandler();
            bindTestSubmitHandler();
            bindTheoryNextHandler();
        }, 500);
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
                    <div class="table-header-cell">Выберите соответствующий элемент</div>
                    <div class="table-header-cell">Элементы сопоставления</div>
                </div>
                <div class="matching-rows">
                    ${targets.map((target, idx) => `
                        <div class="matching-row-preview" data-target-id="${target.id}">
                            <div class="matching-cell-preview">
                                <div class="matching-select-wrapper" data-target-id="${target.id}">
                                    <button class="matching-select-btn" data-target-id="${target.id}">
                                        <span class="selected-text">-- выберите элемент --</span>
                                        <img src="/images/taskCreationPage/chevronDown.svg" alt="toggle" class="select-chevron">
                                    </button>
                                    <div class="matching-select-menu" style="display: none;">
                                        <button class="matching-select-option" data-value="">-- выберите элемент --</button>
                                        ${items.map((item, itemIdx) => `
                                            <button class="matching-select-option" data-value="${item.id}">
                                                ${itemIdx + 1}. ${escapeHtml(item.text)}
                                            </button>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                            <div class="matching-cell-preview">
                                <div class="matching-target-text-preview">
                                    <strong>${String.fromCharCode(65 + idx)}.</strong> ${escapeHtml(target.text)}
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
            const value = option.dataset.value;
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
    const pairs = exerciseData.pairs || [];
    const taskText = exerciseData.question_text || 'Сопоставьте каждый элемент с его сопоставлением.';
    
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Создаем карту правильных соответствий для быстрого доступа
    const correctPairsMap = {};
    pairs.forEach(pair => {
        correctPairsMap[pair.targetId] = pair.itemId;
    });
    
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
                        <div class="preview-item-row" data-item-id="${item.id}">
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
                        <div class="preview-target-row" data-target-id="${target.id}">
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
                    <div class="table-header-cell">Выберите соответствующий элемент</div>
                    <div class="table-header-cell">Элементы сопоставления</div>
                </div>
                <div class="matching-rows">
                    ${targets.map((target, idx) => {
                        const correctItemId = correctPairsMap[target.id] || '';
                        const correctItem = items.find(i => i.id == correctItemId);
                        const correctItemNumber = correctItem ? items.findIndex(i => i.id == correctItemId) + 1 : 0;
                        
                        return `
                            <div class="matching-row-preview" data-target-id="${target.id}" data-correct-item-id="${correctItemId}" data-correct-item-number="${correctItemNumber}">
                                <div class="matching-cell-preview">
                                    <div class="matching-select-wrapper" data-target-id="${target.id}">
                                        <button class="matching-select-btn" data-target-id="${target.id}">
                                            <span class="selected-text">-- выберите элемент --</span>
                                            <img src="/images/taskCreationPage/chevronDown.svg" alt="toggle" class="select-chevron">
                                        </button>
                                        <div class="matching-select-menu" style="display: none;">
                                            <button class="matching-select-option" data-value="">-- выберите элемент --</button>
                                            ${items.map((item, itemIdx) => `
                                                <button class="matching-select-option" data-value="${item.id}" data-item-number="${itemIdx + 1}">
                                                    ${itemIdx + 1}. ${escapeHtml(item.text)}
                                                </button>
                                            `).join('')}
                                        </div>
                                    </div>
                                </div>
                                <div class="matching-cell-preview">
                                    <div class="matching-target-text-preview">
                                        <strong>${String.fromCharCode(65 + idx)}.</strong> ${escapeHtml(target.text)}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
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
            const value = option.dataset.value;
            const text = option.textContent;
            const itemNumber = option.dataset.itemNumber;
            const wrapper = option.closest('.matching-select-wrapper');
            const btn = wrapper.querySelector('.matching-select-btn');
            const menu = wrapper.querySelector('.matching-select-menu');
            const targetId = wrapper.dataset.targetId;
            const row = container.querySelector(`.matching-row-preview[data-target-id="${targetId}"]`);
            
            // Обновляем отображаемый текст
            if (value) {
                btn.querySelector('.selected-text').textContent = text;
                // Сохраняем выбранный номер элемента в data атрибут строки
                if (row) {
                    row.setAttribute('data-selected-item-number', itemNumber || '');
                }
            } else {
                btn.querySelector('.selected-text').textContent = '-- выберите элемент --';
                if (row) {
                    row.removeAttribute('data-selected-item-number');
                }
            }
            
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
    `;
    
    statements.forEach((statement, stmtIdx) => {
        // Находим правильные ответы для этого утверждения
        const correctAnswerIds = statement.answers
            .filter(a => a.isCorrect === true)
            .map(a => String(a.id)); // Преобразуем в строку
        
        console.log(`Утверждение ${stmtIdx + 1}, правильные ответы:`, correctAnswerIds);
        
        html += `
            <div class="preview-statement-card" data-statement-id="${statement.id}" data-correct-answers='${JSON.stringify(correctAnswerIds)}'>
                <div class="preview-statement-header">
                    <div class="statement-number-preview">${stmtIdx + 1}.</div>
                    <div class="statement-text-preview">${escapeHtml(statement.text)}</div>
                </div>
                <div class="preview-answers-section">
                    <div class="answers-header">Выберите правильные ответы (можно несколько):</div>
                    <div class="preview-answers-list">
        `;
        
        statement.answers.forEach((answer, ansIdx) => {
            html += `
                <div class="preview-answer-row" data-answer-id="${answer.id}">
                    <div class="checkbox-student" data-statement-id="${statement.id}" data-answer-id="${answer.id}"></div>
                    <div class="answer-number-preview">${String.fromCharCode(65 + ansIdx)}.</div>
                    <div class="answer-text-preview">${escapeHtml(answer.text)}</div>
                </div>
            `;
        });
        
        html += `
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `
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
                    
                    // Сохраняем правильные ответы в data атрибут
                    const correctAnswersJson = JSON.stringify(blanks);
                    
                    let blankIndex = 0;
                    textWithBlanks = textWithBlanks.replace(/_______/g, () => {
                        const correctWord = blanks[blankIndex] || '';
                        const currentBlankIndex = blankIndex;
                        blankIndex++;
                        return `<div class="fillblanks-select-wrapper" data-blank-index="${currentBlankIndex}" data-correct-answer="${escapeHtml(correctWord)}" style="display: inline-block; min-width: 140px; margin: 0 4px; vertical-align: middle;">
                                    <button class="fillblanks-select-btn" data-correct-answer="${escapeHtml(correctWord)}">
                                        <span class="selected-text">-- выберите слово --</span>
                                        <img src="/images/taskCreationPage/chevronDown.svg" alt="toggle" class="select-chevron">
                                    </button>
                                    <div class="fillblanks-select-menu" style="display: none;">
                                        <button class="fillblanks-select-option" data-value="">-- выберите слово --</button>
                                        ${words.map(word => `
                                            <button class="fillblanks-select-option ${correctWord === word.text ? 'correct-answer-data' : ''}" data-value="${escapeHtml(word.text)}" data-correct="${correctWord === word.text}">
                                                ${escapeHtml(word.text)}
                                            </button>
                                        `).join('')}
                                    </div>
                                </div>`;
                    });
                    
                    return `
                        <div class="preview-sentence-card" data-sentence-id="${sentence.id}" data-correct-answers='${correctAnswersJson}'>
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

// Найти функцию updateTheoryButtonState и заменить внутри часть с isCompleted:

function updateTheoryButtonState(sectionId, isCompleted) {
    const theoryNextStep = document.getElementById('theoryNextStep');
    if (!theoryNextStep) return;
    
    const theorySubmitBtn = document.getElementById('theorySubmitBtn');
    const theoryNextBtn = document.getElementById('theoryNextBtn');
    
    // Проверяем, есть ли следующий раздел
    const hasNext = findNextSection(sectionId) !== null;
    
    if (isCompleted) {
        if (theorySubmitBtn) theorySubmitBtn.style.display = 'none';
        if (theoryNextBtn) {
            if (hasNext) {
                theoryNextBtn.style.display = 'flex';
                theoryNextBtn.style.background = '#7651BE';
                const arrowIcon = theoryNextBtn.querySelector('.next-arrow-icon');
                if (arrowIcon) arrowIcon.style.filter = 'brightness(0) invert(1)';
            } else {
                theoryNextBtn.style.display = 'none';
            }
        }
        // Показываем контейнер только если есть следующий раздел
        theoryNextStep.style.display = hasNext ? 'flex' : 'none';
    } else {
        if (theorySubmitBtn) {
            theorySubmitBtn.style.display = 'flex';
            const newSubmitBtn = theorySubmitBtn.cloneNode(true);
            theorySubmitBtn.parentNode.replaceChild(newSubmitBtn, theorySubmitBtn);
            newSubmitBtn.addEventListener('click', async () => {
                const success = await markTheoryAsCompleted(sectionId);
                if (success) {
                    updateTheoryButtonState(sectionId, true);
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

// Проверка сопоставления (matching)
async function checkMatchingExercise(sectionId, userPairs) {
    try {
        const token = getToken();
        const response = await fetch(`${apiBaseUrl}/student/exercise/matching/check`, {  // ← добавил /student/
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                sectionId, 
                userPairs 
            })
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Ошибка проверки сопоставления:', error);
        return { success: false, correct: false, results: [] };
    }
}

// Сохранение прогресса упражнения
async function markExerciseAsCompleted(sectionId, score, maxScore) {
    try {
        const token = getToken();
        const response = await fetch(`${apiBaseUrl}/student/progress/exercise`, {  // ← добавил /student/
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ sectionId, score, maxScore })
        });
        
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Ошибка сохранения прогресса упражнения:', error);
        return false;
    }
}

// Проверка статуса упражнения
async function checkExerciseStatus(sectionId) {
    try {
        const token = getToken();
        const response = await fetch(`${apiBaseUrl}/student/progress/exercise/${sectionId}`, {  // ← добавил /student/
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        return data.completed || false;
    } catch (error) {
        console.error('Ошибка проверки статуса упражнения:', error);
        return false;
    }
}

async function submitMatchingSolution(sectionId) {
    console.log('submitMatchingSolution вызван, sectionId:', sectionId);
    const selectWrappers = document.querySelectorAll('#matchingExercisePreview .matching-select-wrapper');
    const userPairs = {};
    let allSelected = true;
    
    selectWrappers.forEach(wrapper => {
        const targetId = wrapper.dataset.targetId;
        const selectedOption = wrapper.querySelector('.matching-select-option.selected');
        if (selectedOption && selectedOption.dataset.value) {
            userPairs[targetId] = selectedOption.dataset.value;
        } else {
            allSelected = false;
        }
    });
    
    if (!allSelected) {
        showNotification('Пожалуйста, заполните все поля сопоставления', 'warning');
        selectWrappers.forEach(wrapper => {
            const selectedText = wrapper.querySelector('.selected-text')?.textContent || '';
            if (selectedText === '-- выберите элемент --') {
                wrapper.querySelector('.matching-select-btn')?.classList.add('error-highlight');
            }
        });
        setTimeout(() => {
            selectWrappers.forEach(w => {
                w.querySelector('.matching-select-btn')?.classList.remove('error-highlight');
            });
        }, 3000);
        return false;
    }
    
    const result = await checkMatchingExercise(sectionId, userPairs);
    
    if (result.success && result.correct) {
        showNotification('Упражнение выполнено верно!', 'success');
        
        // Сохраняем ответы в localStorage
        localStorage.setItem(`matching_answers_${sectionId}`, JSON.stringify(userPairs));
        
        selectWrappers.forEach(wrapper => {
            const btn = wrapper.querySelector('.matching-select-btn');
            btn.classList.add('success-highlight-permanent');
            btn.disabled = true;
            btn.style.cursor = 'default';
            btn.style.opacity = '0.8';
            const chevron = btn.querySelector('.select-chevron');
            if (chevron) chevron.style.display = 'none';
        });
        
        await markExerciseAsCompleted(sectionId, result.score, result.maxScore);
        updateExerciseButtonState(sectionId, true);
        return true;
    } else {
        showNotification('Есть ошибки. Попробуйте еще раз.', 'warning');
        
        // Сохраняем ответы даже если есть ошибки
        localStorage.setItem(`matching_answers_${sectionId}`, JSON.stringify(userPairs));
        
        if (result.results) {
            for (const [targetId, isCorrect] of Object.entries(result.results)) {
                const wrapper = document.querySelector(`#matchingExercisePreview .matching-select-wrapper[data-target-id="${targetId}"]`);
                if (wrapper) {
                    const btn = wrapper.querySelector('.matching-select-btn');
                    if (isCorrect) {
                        btn.classList.add('success-highlight-temporary');
                        setTimeout(() => {
                            btn.classList.remove('success-highlight-temporary');
                        }, 3000);
                    } else {
                        btn.classList.add('error-highlight');
                        setTimeout(() => {
                            btn.classList.remove('error-highlight');
                        }, 3000);
                    }
                }
            }
         highlightMatchingResults(document.querySelector('#matchingExercisePreview'), result.results);
        }
        return false;
    }
}

// Найти функцию updateExerciseButtonState и заменить внутри часть с isCompleted:

function updateExerciseButtonState(sectionId, isCompleted) {
    const exerciseNextStep = document.getElementById('exerciseNextStep');
    if (!exerciseNextStep) return;
    
    const exerciseSubmitBtn = document.getElementById('exerciseSubmitBtn');
    const exerciseNextBtn = document.getElementById('exerciseNextBtn');
    
    // Проверяем, есть ли следующий раздел
    const hasNext = findNextSection(sectionId) !== null;
    
    if (isCompleted) {
        if (exerciseSubmitBtn) exerciseSubmitBtn.style.display = 'none';
        if (exerciseNextBtn) {
            if (hasNext) {
                exerciseNextBtn.style.display = 'flex';
                exerciseNextBtn.style.background = '#7651BE';
                const arrowIcon = exerciseNextBtn.querySelector('.next-arrow-icon');
                if (arrowIcon) arrowIcon.style.filter = 'brightness(0) invert(1)';
                
                const newNextBtn = exerciseNextBtn.cloneNode(true);
                exerciseNextBtn.parentNode.replaceChild(newNextBtn, exerciseNextBtn);
                newNextBtn.addEventListener('click', navigateToNextSection);
            } else {
                exerciseNextBtn.style.display = 'none';
            }
        }
        exerciseNextStep.style.display = hasNext ? 'flex' : 'none';
    } else {
        if (exerciseSubmitBtn) {
            exerciseSubmitBtn.style.display = 'flex';
            const newSubmitBtn = exerciseSubmitBtn.cloneNode(true);
            exerciseSubmitBtn.parentNode.replaceChild(newSubmitBtn, exerciseSubmitBtn);
            newSubmitBtn.addEventListener('click', async () => {
                const exerciseType = currentEditingExerciseSection?.exercise?.exercise_type || 'matching';
                if (exerciseType === 'matching') {
                    await submitMatchingSolution(currentEditingExerciseSection.id);
                } else if (exerciseType === 'choice') {
                    await submitChoiceSolution(currentEditingExerciseSection.id);
                } else if (exerciseType === 'fill_blanks') {
                    await submitFillBlanksSolution(currentEditingExerciseSection.id);
                }
            });
        }
        if (exerciseNextBtn) exerciseNextBtn.style.display = 'none';
        exerciseNextStep.style.display = 'flex';
    }
}

// Проверка выбора правильного (choice)
async function checkChoiceExercise(sectionId, userAnswers) {
    try {
        const token = getToken();
        const response = await fetch(`${apiBaseUrl}/student/exercise/choice/check`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                sectionId, 
                userAnswers 
            })
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Ошибка проверки выбора правильного:', error);
        return { success: false, correct: false, results: [] };
    }
}

// Отправка решения для выбора правильного
async function submitChoiceSolution(sectionId) {
    console.log('submitChoiceSolution вызван, sectionId:', sectionId);
    const statementCards = document.querySelectorAll('#choiceExercisePreview .preview-statement-card');
    const userAnswers = {};
    let allHaveSelection = true;
    let emptyStatements = [];
    
    // Очищаем предыдущие подсветки
    document.querySelectorAll('#choiceExercisePreview .preview-answers-section.error-highlight').forEach(el => {
        el.classList.remove('error-highlight');
    });
    
    statementCards.forEach((card, idx) => {
        const statementId = card.dataset.statementId;
        const selectedCheckboxes = card.querySelectorAll('.checkbox-student.selected');
        const answerIds = [];
        
        selectedCheckboxes.forEach(checkbox => {
            answerIds.push(checkbox.dataset.answerId);
        });
        
        userAnswers[statementId] = answerIds;
        
        if (answerIds.length === 0) {
            allHaveSelection = false;
            emptyStatements.push(idx + 1);
            const answersSection = card.querySelector('.preview-answers-section');
            answersSection.classList.add('error-highlight');
        }
    });
    
    if (!allHaveSelection) {
        const statementNumbers = emptyStatements.join(', ');
        showNotification(`Пожалуйста, выберите ответ(ы) для утверждений: ${statementNumbers}`, 'warning');
        setTimeout(() => {
            document.querySelectorAll('#choiceExercisePreview .preview-answers-section.error-highlight').forEach(el => {
                el.classList.remove('error-highlight');
            });
        }, 3000);
        return false;
    }
    
    const result = await checkChoiceExercise(sectionId, userAnswers);
    
    if (result.success && result.correct) {
        console.log('Упражнение выполнено верно! Обновляем интерфейс...');
        showNotification('Упражнение выполнено верно!', 'success');
        
        localStorage.setItem(`choice_answers_${sectionId}`, JSON.stringify(userAnswers));
        
        console.log('Блокируем чекбоксы...');
        statementCards.forEach(card => {
            const checkboxes = card.querySelectorAll('.checkbox-student');
            console.log(`Найдено чекбоксов в карточке: ${checkboxes.length}`);
            checkboxes.forEach(checkbox => {
                checkbox.style.pointerEvents = 'none';
                checkbox.style.opacity = '0.8';
                if (checkbox.classList.contains('selected')) {
                    checkbox.classList.add('success-highlight-permanent');
                }
            });
        });
        
        console.log('Сохраняем прогресс...');
        await markExerciseAsCompleted(sectionId, result.score, result.maxScore);
        console.log('Обновляем состояние кнопки...');
        updateExerciseButtonState(sectionId, true);
        return true;
    } else {
        showNotification('Есть ошибки. Попробуйте еще раз.', 'warning');
        
        localStorage.setItem(`choice_answers_${sectionId}`, JSON.stringify(userAnswers));
        
        if (result.results) {
            for (const [statementId, isCorrect] of Object.entries(result.results)) {
                const card = document.querySelector(`#choiceExercisePreview .preview-statement-card[data-statement-id="${statementId}"]`);
                if (card) {
                    if (isCorrect) {
                        const checkboxes = card.querySelectorAll('.checkbox-student.selected');
                        checkboxes.forEach(cb => {
                            cb.classList.add('success-highlight-temporary');
                            setTimeout(() => {
                                cb.classList.remove('success-highlight-temporary');
                            }, 3000);
                        });
                    } else {
                        const answersSection = card.querySelector('.preview-answers-section');
                        answersSection.classList.add('error-highlight');
                        setTimeout(() => {
                            answersSection.classList.remove('error-highlight');
                        }, 3000);
                    }
                }
            }
         highlightChoiceResults(document.querySelector('#choiceExercisePreview'), result.results);
        }
        return false;
    }
}

// Проверка дополнения (fill_blanks)
async function checkFillBlanksExercise(sectionId, userAnswers) {
    try {
        const token = getToken();
        const response = await fetch(`${apiBaseUrl}/student/exercise/fillblanks/check`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                sectionId, 
                userAnswers 
            })
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Ошибка проверки дополнения:', error);
        return { success: false, correct: false, results: [] };
    }
}

// Отправка решения для дополнения
async function submitFillBlanksSolution(sectionId) {
    console.log('submitFillBlanksSolution вызван, sectionId:', sectionId);
    
    const sentenceCards = document.querySelectorAll('#fillBlanksExercisePreview .preview-sentence-card');
    const userAnswers = {};
    let allSelected = true;
    let emptyBlanks = [];
    
    // Очищаем предыдущие подсветки
    document.querySelectorAll('#fillBlanksExercisePreview .fillblanks-select-btn.error-highlight').forEach(el => {
        el.classList.remove('error-highlight');
    });
    
    sentenceCards.forEach((card, cardIdx) => {
        const sentenceId = card.dataset.sentenceId;
        const selectWrappers = card.querySelectorAll('.fillblanks-select-wrapper');
        const selectedWords = [];
        
        selectWrappers.forEach((wrapper, blankIdx) => {
            const selectedOption = wrapper.querySelector('.fillblanks-select-option.selected');
            if (selectedOption && selectedOption.dataset.value) {
                selectedWords.push(selectedOption.dataset.value);
            } else {
                selectedWords.push('');
                allSelected = false;
                emptyBlanks.push(`предложение ${cardIdx + 1}, пропуск ${blankIdx + 1}`);
                const btn = wrapper.querySelector('.fillblanks-select-btn');
                btn.classList.add('error-highlight');
            }
        });
        
        userAnswers[sentenceId] = selectedWords;
    });
    
    if (!allSelected) {
        const blanksList = emptyBlanks.slice(0, 5).join(', ');
        showNotification(`Пожалуйста, заполните все пропуски: ${blanksList}`, 'warning');
        setTimeout(() => {
            document.querySelectorAll('#fillBlanksExercisePreview .fillblanks-select-btn.error-highlight').forEach(el => {
                el.classList.remove('error-highlight');
            });
        }, 3000);
        return false;
    }
    
    console.log('Отправляемые userAnswers:', JSON.stringify(userAnswers, null, 2));
    
    const result = await checkFillBlanksExercise(sectionId, userAnswers);
    console.log('Результат проверки:', result);
    
    if (result.success && result.correct) {
        showNotification('Упражнение выполнено верно!', 'success');
        
        localStorage.setItem(`fillblanks_answers_${sectionId}`, JSON.stringify(userAnswers));
        
        // Блокируем все dropdown и делаем зелеными
        const allSelectWrappers = document.querySelectorAll('#fillBlanksExercisePreview .fillblanks-select-wrapper');
        allSelectWrappers.forEach(wrapper => {
            const btn = wrapper.querySelector('.fillblanks-select-btn');
            btn.classList.add('success-highlight-permanent');
            btn.disabled = true;
            btn.style.cursor = 'default';
            btn.style.opacity = '0.8';
            const chevron = btn.querySelector('.select-chevron');
            if (chevron) chevron.style.display = 'none';
        });
        
        await markExerciseAsCompleted(sectionId, result.score, result.maxScore);
        updateExerciseButtonState(sectionId, true);
        return true;
    } else {
        showNotification('Есть ошибки. Попробуйте еще раз.', 'warning');
        
        localStorage.setItem(`fillblanks_answers_${sectionId}`, JSON.stringify(userAnswers));
        
        if (result.results) {
            for (const [sentenceId, sentenceResult] of Object.entries(result.results)) {
                const sentenceCard = document.querySelector(`#fillBlanksExercisePreview .preview-sentence-card[data-sentence-id="${sentenceId}"]`);
                if (sentenceCard && sentenceResult.blanks) {
                    const blankWrappers = sentenceCard.querySelectorAll('.fillblanks-select-wrapper');
                    blankWrappers.forEach((wrapper, idx) => {
                        const btn = wrapper.querySelector('.fillblanks-select-btn');
                        if (sentenceResult.blanks[idx]) {
                            btn.classList.add('success-highlight-temporary');
                            setTimeout(() => {
                                btn.classList.remove('success-highlight-temporary');
                            }, 3000);
                        } else {
                            btn.classList.add('error-highlight');
                            setTimeout(() => {
                                btn.classList.remove('error-highlight');
                            }, 3000);
                        }
                    });
                }
            }
        highlightFillBlanksResults(document.querySelector('#fillBlanksExercisePreview'), result.results);
        }
        return false;
    }
}

// Проверка и отправка всего теста
// Проверка и отправка всего теста
async function validateAndSubmitTest() {
     console.log('=== validateAndSubmitTest ВЫЗВАН ===');
    console.trace(); // Покажет стек вызовов
    
    if (currentUserRole !== 'student') return false;

    const exerciseCards = document.querySelectorAll('#previewTestExercisesList .preview-test-exercise-card');
    let testId = exerciseCards[0]?.dataset.sectionId;
    
    // Если dataset.sectionId не установлен, используем currentTestId
    if (!testId) {
        testId = currentTestId;
    }
    
    console.log('=== validateAndSubmitTest ===');
    console.log('testId из dataset:', exerciseCards[0]?.dataset.sectionId);
    console.log('testId используемый:', testId);
    console.log('currentTestId:', currentTestId);

    // Проверяем, не превышен ли лимит попыток для теста в целом
    if (testAttemptsCount >= MAX_TEST_ATTEMPTS) {
        showNotification(`Лимит попыток исчерпан! Вы использовали все ${MAX_TEST_ATTEMPTS} попыток.`, 'error');
        return false;
    }
    
    if (exerciseCards.length === 0) {
        showNotification('В тесте нет упражнений', 'warning');
        return false;
    }
    
    if (!testId) {
        showNotification('Ошибка: ID теста не найден', 'error');
        return false;
    }
    
    // Очищаем предыдущие подсветки и подсказки
    clearAllTestHighlights();
    document.querySelectorAll('.correct-answer-tooltip').forEach(el => {
        if (el.parentNode) el.remove();
    });
    document.querySelectorAll('.correct-highlight').forEach(el => {
        el.classList.remove('correct-highlight');
    });
    document.querySelectorAll('.test-card-error').forEach(el => {
        el.classList.remove('test-card-error');
    });
    
    let allValid = true;
    const results = [];
    let hasNewAttempts = false;
    
    // Валидация всех упражнений и сбор ответов только для тех, которые ещё не выполнены
    for (let i = 0; i < exerciseCards.length; i++) {
        const card = exerciseCards[i];
        const exerciseId = card.dataset.exerciseId;
        const typeText = card.querySelector('.exercise-type-preview')?.textContent || '';
        
        // Проверяем, заблокировано ли уже это упражнение (выполнено ранее)
        if (isExerciseLocked(card)) {
            console.log(`Упражнение ${exerciseId} уже выполнено и заблокировано, пропускаем`);
            continue;
        }
        
        hasNewAttempts = true;
        
        let exerciseType = '';
        if (typeText === 'Сопоставление') exerciseType = 'matching';
        else if (typeText === 'Выбор правильного') exerciseType = 'choice';
        else if (typeText === 'Дополнение') exerciseType = 'fill_blanks';
        
        // Получаем ответы студента
        let userAnswers = null;
        let isValid = true;
        
        if (exerciseType === 'matching') {
            const result = collectMatchingAnswers(card);
            userAnswers = result.userAnswers;
            isValid = result.allSelected;
            if (!isValid) {
                highlightMatchingErrors(card);
            }
        } else if (exerciseType === 'choice') {
            const result = collectChoiceAnswers(card);
            userAnswers = result.userAnswers;
            isValid = result.allHaveSelection;
            if (!isValid) {
                highlightChoiceErrors(card);
            }
        } else if (exerciseType === 'fill_blanks') {
            const result = collectFillBlanksAnswers(card);
            userAnswers = result.userAnswers;
            isValid = result.allSelected;
            if (!isValid) {
                highlightFillBlanksErrors(card);
            }
        }
        
        if (!isValid) {
            allValid = false;
            card.classList.add('error-highlight');
            results.push({ exerciseId, exerciseType, isValid: false, error: 'Не все поля заполнены' });
        } else {
            results.push({ exerciseId, exerciseType, isValid: true, userAnswers, card });
        }
    }
    
    if (!allValid) {
        setTimeout(() => {
            exerciseCards.forEach(card => card.classList.remove('error-highlight'));
        }, 3000);
        showNotification('Пожалуйста, заполните все поля в упражнениях', 'warning');
        return false;
    }
    
    // Если нет новых попыток (все упражнения уже выполнены)
    if (!hasNewAttempts) {
        showNotification('Все упражнения уже выполнены!', 'info');
        return false;
    }
    
    console.log(`\n====== ОТПРАВКА НОВЫХ ОТВЕТОВ ======`);
    
    let anySuccess = false;
    
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (!result.isValid) continue;
        
        const card = result.card;
        const exerciseId = result.exerciseId;
        const exerciseType = result.exerciseType;
        
        // Получаем количество предыдущих попыток для этого упражнения
        const exerciseAttemptsCount = getExerciseAttemptsCount(testId, exerciseId);
        const attemptNumber = Math.min(exerciseAttemptsCount + 1, 4);
        
        // Получаем данные о баллах за попытки
        const scoringData = {
            firstAttempt: parseInt(card.dataset.firstAttempt) || 100,
            secondAttempt: parseInt(card.dataset.secondAttempt) || 50,
            thirdAttempt: parseInt(card.dataset.thirdAttempt) || 25,
            subsequentAttempts: parseInt(card.dataset.subsequentAttempts) || 0
        };
        
        console.log(`\n--- Упражнение ${exerciseId} (${exerciseType}) ---`);
        console.log('Номер попытки:', attemptNumber);
        console.log('Баллы за попытку:', getScoreForAttempt(scoringData, attemptNumber));
        console.log('Ответы студента:', JSON.stringify(result.userAnswers, null, 2));
        
        let checkResult = null;
        
        try {
            if (exerciseType === 'matching') {
                checkResult = await checkTestMatchingExercise(testId, exerciseId, result.userAnswers);
            } else if (exerciseType === 'choice') {
                checkResult = await checkTestChoiceExercise(testId, exerciseId, result.userAnswers);
            } else if (exerciseType === 'fill_blanks') {
                checkResult = await checkTestFillBlanksExercise(testId, exerciseId, result.userAnswers);
            }
        } catch (error) {
            console.error('Ошибка при проверке:', error);
        }
        
        // Обработка результата проверки
        if (checkResult && checkResult.success) {
            // Подсвечиваем неправильные ответы (временная подсветка)
            highlightIncorrectAnswers(card, exerciseType, checkResult, result.userAnswers);
            
            let earnedScore = 0;
            
            console.log('checkResult ДЕТАЛЬНО:', JSON.stringify(checkResult, null, 2));
            
            // Если ответ полностью правильный
            if (checkResult.isFullyCorrect || checkResult.correct) {
                earnedScore = getScoreForAttempt(scoringData, attemptNumber);
                
                // Если полностью правильно - блокируем упражнение
                lockExercise(card, exerciseType);
                await saveExerciseAttempt(testId, exerciseId, attemptNumber, earnedScore, true);
                localStorage.setItem(`exercise_fully_correct_${testId}_${exerciseId}`, 'true');
                
                showNotification(`Упражнение "${exerciseType === 'matching' ? 'Сопоставление' : exerciseType === 'choice' ? 'Выбор правильного' : 'Дополнение'}" выполнено верно!`, 'success');
                anySuccess = true;
                
            } else {
                // Если ответ НЕ полностью правильный
                earnedScore = checkResult.earnedScore !== undefined ? checkResult.earnedScore : 0;
                await saveExerciseAttempt(testId, exerciseId, attemptNumber, earnedScore, false);
            }
            
            console.log(`Упражнение ${exerciseId}: попытка ${attemptNumber}, заработано баллов: ${earnedScore}`);
            
            // Обновляем отображение баллов
            const scoreValueSpan = card.querySelector('.exercise-score-value');
            if (scoreValueSpan) {
                const currentScore = parseInt(scoreValueSpan.textContent);
                if (earnedScore > currentScore) {
                    scoreValueSpan.textContent = earnedScore;
                }
            }
        } else {
            console.error('Ошибка при проверке упражнения:', checkResult);
            showNotification('Ошибка при проверке упражнения', 'error');
        }
    }
    
    // Увеличиваем счётчик попыток только если были отправки
    if (results.length > 0) {
        testAttemptsCount++;
        updateTestAttemptsDisplay();
    }
    
    // Пересчитываем итоговые баллы
    updateTotalTestScore();
    
    // Проверяем, не закончились ли попытки после этой отправки
    if (testAttemptsCount >= MAX_TEST_ATTEMPTS) {
        // Принудительно показываем правильные ответы и блокируем все упражнения
        const allExerciseCards = document.querySelectorAll('#previewTestExercisesList .preview-test-exercise-card');
        allExerciseCards.forEach(card => {
            const scoreSpan = card.querySelector('.exercise-score-value');
            const maxScoreSpan = card.querySelector('.exercise-score-max');
            
            const score = parseInt(scoreSpan?.textContent || '0');
            const maxScoreText = maxScoreSpan?.textContent || '/ 100';
            const maxScore = parseInt(maxScoreText.replace('/', '').trim());
            
            const typeText = card.querySelector('.exercise-type-preview')?.textContent || '';
            let exerciseType = '';
            if (typeText === 'Сопоставление') exerciseType = 'matching';
            else if (typeText === 'Выбор правильного') exerciseType = 'choice';
            else if (typeText === 'Дополнение') exerciseType = 'fill_blanks';
            
            const exerciseId = card.dataset.exerciseId;
            const isFullyCorrect = localStorage.getItem(`exercise_fully_correct_${testId}_${exerciseId}`) === 'true';
            
            const isExerciseCompleted = isFullyCorrect || (score >= maxScore && maxScore > 0);
            
            if (!isExerciseCompleted && score === 0) {
                card.classList.add('test-card-error');
            }
            
            if (exerciseType === 'matching') {
                const rows = card.querySelectorAll('.matching-row-preview');
                rows.forEach(row => {
                    const correctItemNumber = row.dataset.correctItemNumber;
                    const wrapper = row.querySelector('.matching-select-wrapper');
                    if (wrapper && correctItemNumber && correctItemNumber !== '0') {
                        const btn = wrapper.querySelector('.matching-select-btn');
                        btn.disabled = true;
                        btn.style.pointerEvents = 'none';
                        btn.style.opacity = '0.8';
                        
                        const correctOption = wrapper.querySelector(`.matching-select-option[data-item-number="${correctItemNumber}"]`);
                        if (correctOption) {
                            correctOption.classList.add('correct-highlight');
                            btn.querySelector('.selected-text').textContent = correctOption.textContent;
                            btn.classList.add('success-highlight-permanent');
                        }
                    } else if (wrapper) {
                        const btn = wrapper.querySelector('.matching-select-btn');
                        btn.disabled = true;
                        btn.style.pointerEvents = 'none';
                        btn.style.opacity = '0.8';
                    }
                });
            } else if (exerciseType === 'choice') {
                const statementCards = card.querySelectorAll('.preview-statement-card');
                statementCards.forEach(statementCard => {
                    let correctAnswers = [];
                    try {
                        const correctAnswersAttr = statementCard.getAttribute('data-correct-answers');
                        if (correctAnswersAttr) {
                            correctAnswers = JSON.parse(correctAnswersAttr);
                            correctAnswers = correctAnswers.map(id => String(id));
                        }
                    } catch(e) {
                        correctAnswers = [];
                    }
                    
                    const allAnswers = statementCard.querySelectorAll('.preview-answer-row');
                    allAnswers.forEach(answerRow => {
                        const checkbox = answerRow.querySelector('.checkbox-student');
                        const answerId = String(answerRow.dataset.answerId);
                        
                        if (checkbox) {
                            checkbox.style.pointerEvents = 'none';
                            checkbox.style.opacity = '0.8';
                            checkbox.classList.remove('selected');
                            
                            if (correctAnswers.includes(answerId)) {
                                checkbox.classList.add('correct-highlight');
                                checkbox.classList.add('selected');
                            }
                        }
                    });
                });
            } else if (exerciseType === 'fill_blanks') {
                const sentenceCards = card.querySelectorAll('.preview-sentence-card');
                sentenceCards.forEach(sentenceCard => {
                    let correctAnswers = [];
                    try {
                        correctAnswers = JSON.parse(sentenceCard.dataset.correctAnswers || '[]');
                    } catch(e) {
                        correctAnswers = [];
                    }
                    
                    const blankWrappers = sentenceCard.querySelectorAll('.fillblanks-select-wrapper');
                    blankWrappers.forEach((wrapper, idx) => {
                        const btn = wrapper.querySelector('.fillblanks-select-btn');
                        btn.disabled = true;
                        btn.style.pointerEvents = 'none';
                        btn.style.opacity = '0.8';
                        
                        const correctAnswer = correctAnswers[idx];
                        if (correctAnswer) {
                            const correctOption = wrapper.querySelector(`.fillblanks-select-option[data-value="${correctAnswer}"]`);
                            if (correctOption) {
                                correctOption.classList.add('correct-highlight');
                                btn.querySelector('.selected-text').textContent = correctAnswer;
                                btn.classList.add('success-highlight-permanent');
                            }
                        }
                    });
                });
            }
        });
        
        showNotification(`Лимит попыток исчерпан!`, 'warning');
    }
    
    // Обновляем кнопки
    updateTestButtons();
    
    console.log('====== КОНЕЦ ПРОВЕРКИ ТЕСТА ======');
    
    if (anySuccess) {
        showNotification(`Отлично! Некоторые упражнения решены правильно!`, 'success');
    } else if (results.length > 0 && testAttemptsCount < MAX_TEST_ATTEMPTS) {
        showNotification(`Попытка ${testAttemptsCount} завершена.`, 'info');
    }

    if (hasNewAttempts && testAttemptsCount <= MAX_TEST_ATTEMPTS) {
        // Собираем результаты всех упражнений
        const { exerciseResults, totalScore, totalMaxScore } = collectExerciseResultsForSave();
        
        // Сохраняем на сервер
        const saved = await saveTestStateToServer(
            testId,
            testAttemptsCount,
            totalScore,
            totalMaxScore,
            exerciseResults
        );
        
        if (saved) {
            console.log(`Попытка ${testAttemptsCount} успешно сохранена на сервере`);
            updateTotalTestScore();
        } else {
            console.error('Не удалось сохранить попытку на сервере');
            showNotification('Ошибка при сохранении прогресса теста', 'error');
        }
    }
    
    return true;
}

// ===== ФУНКЦИИ ПОДСВЕТКИ И БЛОКИРОВКИ ДЛЯ ТЕСТА =====

// Подсветка неправильных ответов при отправке теста с показом правильных ответов
function highlightIncorrectAnswers(card, exerciseType, checkResult, userAnswers) {
    console.log('highlightIncorrectAnswers вызвана для типа:', exerciseType, 'userAnswers:', userAnswers);
    
    if (exerciseType === 'matching') {
        const rows = card.querySelectorAll('.matching-row-preview');
        
        rows.forEach(row => {
            const targetId = row.dataset.targetId;
            const correctItemNumber = row.dataset.correctItemNumber;
            
            const wrapper = row.querySelector('.matching-select-wrapper');
            if (!wrapper) return;
            
            const btn = wrapper.querySelector('.matching-select-btn');
            const selectedOption = wrapper.querySelector('.matching-select-option.selected');
            const selectedNumber = selectedOption ? selectedOption.dataset.itemNumber : null;
            
            const isCorrect = correctItemNumber && selectedNumber && correctItemNumber === selectedNumber;
            
            if (isCorrect) {
                btn.classList.add('success-highlight-temporary');
                setTimeout(() => btn.classList.remove('success-highlight-temporary'), 3000);
            } else if (selectedNumber) {
                btn.classList.add('error-highlight');
                
                // Показываем правильный ответ
                if (correctItemNumber && correctItemNumber !== '0') {
                    const correctOption = wrapper.querySelector(`.matching-select-option[data-item-number="${correctItemNumber}"]`);
                    if (correctOption) {
                        correctOption.classList.add('correct-highlight');
                        
                        const correctText = correctOption.textContent;
                        const tooltip = document.createElement('div');
                        tooltip.className = 'correct-answer-tooltip';
                        tooltip.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 16px;">✓</span>
                                <span>Правильный ответ: ${escapeHtml(correctText)}</span>
                            </div>
                        `;
                        tooltip.style.position = 'absolute';
                        tooltip.style.backgroundColor = '#4CAF50';
                        tooltip.style.color = 'white';
                        tooltip.style.padding = '6px 12px';
                        tooltip.style.borderRadius = '8px';
                        tooltip.style.fontSize = '12px';
                        tooltip.style.marginTop = '4px';
                        tooltip.style.zIndex = '100';
                        tooltip.style.whiteSpace = 'nowrap';
                        tooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                        tooltip.style.left = '0';
                        tooltip.style.top = '100%';
                        
                        const oldTooltip = wrapper.querySelector('.correct-answer-tooltip');
                        if (oldTooltip) oldTooltip.remove();
                        
                        wrapper.style.position = 'relative';
                        wrapper.appendChild(tooltip);
                        
                        setTimeout(() => {
                            if (tooltip.parentNode) tooltip.remove();
                            correctOption.classList.remove('correct-highlight');
                        }, 5000);
                    }
                }
                
                setTimeout(() => btn.classList.remove('error-highlight'), 5000);
            }
        });
    } 
    else if (exerciseType === 'choice') {
        const statementCards = card.querySelectorAll('.preview-statement-card');
        
        statementCards.forEach(statementCard => {
            const statementId = statementCard.dataset.statementId;
            let correctAnswers = [];
            try {
                const correctAnswersAttr = statementCard.getAttribute('data-correct-answers');
                if (correctAnswersAttr) {
                    correctAnswers = JSON.parse(correctAnswersAttr);
                    correctAnswers = correctAnswers.map(id => String(id));
                }
            } catch(e) {
                correctAnswers = [];
            }
            
            const selectedCheckboxes = statementCard.querySelectorAll('.checkbox-student.selected');
            const selectedAnswerIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.answerId);
            
            let hasIncorrect = false;
            for (const answerId of selectedAnswerIds) {
                if (!correctAnswers.includes(String(answerId))) {
                    hasIncorrect = true;
                    break;
                }
            }
            for (const correctId of correctAnswers) {
                if (!selectedAnswerIds.includes(correctId)) {
                    hasIncorrect = true;
                    break;
                }
            }
            
            if (hasIncorrect && selectedAnswerIds.length > 0) {
                const answersSection = statementCard.querySelector('.preview-answers-section');
                answersSection.classList.add('error-highlight');
                
                // Подсвечиваем правильные ответы зеленым
                const allAnswers = statementCard.querySelectorAll('.preview-answer-row');
                allAnswers.forEach(answerRow => {
                    const answerId = String(answerRow.dataset.answerId);
                    if (correctAnswers.includes(answerId)) {
                        const checkbox = answerRow.querySelector('.checkbox-student');
                        if (checkbox) {
                            checkbox.classList.add('correct-highlight-temporary');
                            setTimeout(() => checkbox.classList.remove('correct-highlight-temporary'), 5000);
                        }
                    }
                });
                
                setTimeout(() => answersSection.classList.remove('error-highlight'), 5000);
            }
        });
    } 
    else if (exerciseType === 'fill_blanks') {
        const sentenceCards = card.querySelectorAll('.preview-sentence-card');
        
        sentenceCards.forEach(sentenceCard => {
            let correctAnswers = [];
            try {
                correctAnswers = JSON.parse(sentenceCard.dataset.correctAnswers || '[]');
            } catch(e) {
                correctAnswers = [];
            }
            
            const blankWrappers = sentenceCard.querySelectorAll('.fillblanks-select-wrapper');
            blankWrappers.forEach((wrapper, idx) => {
                const selectedOption = wrapper.querySelector('.fillblanks-select-option.selected');
                const selectedWord = selectedOption ? selectedOption.dataset.value : '';
                const correctAnswer = correctAnswers[idx] || '';
                
                const isCorrect = selectedWord && correctAnswer && selectedWord === correctAnswer;
                
                if (!isCorrect && selectedWord) {
                    const btn = wrapper.querySelector('.fillblanks-select-btn');
                    btn.classList.add('error-highlight');
                    
                    // Показываем правильный ответ
                    if (correctAnswer) {
                        const correctOption = wrapper.querySelector(`.fillblanks-select-option[data-value="${correctAnswer}"]`);
                        if (correctOption) {
                            correctOption.classList.add('correct-highlight');
                            
                            const tooltip = document.createElement('div');
                            tooltip.className = 'correct-answer-tooltip';
                            tooltip.innerHTML = `
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="font-size: 16px;">✓</span>
                                    <span>Правильный ответ: ${escapeHtml(correctAnswer)}</span>
                                </div>
                            `;
                            tooltip.style.position = 'absolute';
                            tooltip.style.backgroundColor = '#4CAF50';
                            tooltip.style.color = 'white';
                            tooltip.style.padding = '6px 12px';
                            tooltip.style.borderRadius = '8px';
                            tooltip.style.fontSize = '12px';
                            tooltip.style.marginTop = '4px';
                            tooltip.style.zIndex = '100';
                            tooltip.style.whiteSpace = 'nowrap';
                            tooltip.style.left = '0';
                            tooltip.style.top = '100%';
                            
                            const oldTooltip = wrapper.querySelector('.correct-answer-tooltip');
                            if (oldTooltip) oldTooltip.remove();
                            
                            wrapper.style.position = 'relative';
                            wrapper.appendChild(tooltip);
                            
                            setTimeout(() => {
                                if (tooltip.parentNode) tooltip.remove();
                                correctOption.classList.remove('correct-highlight');
                            }, 5000);
                        }
                    }
                    
                    setTimeout(() => btn.classList.remove('error-highlight'), 5000);
                } else if (isCorrect) {
                    const btn = wrapper.querySelector('.fillblanks-select-btn');
                    btn.classList.add('success-highlight-temporary');
                    setTimeout(() => btn.classList.remove('success-highlight-temporary'), 3000);
                }
            });
        });
    }
}

// Функция для подсветки ошибок когда попытки закончились (показываем все правильные ответы)
function highlightAllErrorsOnAttemptsExhausted() {
    const exerciseCards = document.querySelectorAll('#previewTestExercisesList .preview-test-exercise-card');
    
    exerciseCards.forEach(card => {
        const scoreSpan = card.querySelector('.exercise-score-value');
        const maxScoreSpan = card.querySelector('.exercise-score-max');
        
        const score = parseInt(scoreSpan?.textContent || '0');
        const maxScoreText = maxScoreSpan?.textContent || '/ 100';
        const maxScore = parseInt(maxScoreText.replace('/', '').trim());
        
        const testId = card.dataset.sectionId;
        const exerciseId = card.dataset.exerciseId;
        
        const isFullyCorrect = localStorage.getItem(`exercise_fully_correct_${testId}_${exerciseId}`) === 'true';
        const isExerciseCompleted = isFullyCorrect || (score >= maxScore && maxScore > 0);
        
        // Красная подсветка только если упражнение НЕ выполнено и набрано 0 баллов
        if (!isExerciseCompleted && score === 0) {
            card.classList.add('test-card-error');
        } else {
            card.classList.remove('test-card-error');
        }
        
        const typeText = card.querySelector('.exercise-type-preview')?.textContent || '';
        let exerciseType = '';
        if (typeText === 'Сопоставление') exerciseType = 'matching';
        else if (typeText === 'Выбор правильного') exerciseType = 'choice';
        else if (typeText === 'Дополнение') exerciseType = 'fill_blanks';
        
        if (exerciseType === 'matching') {
            const rows = card.querySelectorAll('.matching-row-preview');
            rows.forEach(row => {
                const correctItemNumber = row.dataset.correctItemNumber;
                const wrapper = row.querySelector('.matching-select-wrapper');
                if (wrapper && correctItemNumber && correctItemNumber !== '0') {
                    const btn = wrapper.querySelector('.matching-select-btn');
                    btn.disabled = true;
                    btn.style.pointerEvents = 'none';
                    btn.style.opacity = '0.8';
                    
                    const correctOption = wrapper.querySelector(`.matching-select-option[data-item-number="${correctItemNumber}"]`);
                    if (correctOption) {
                        correctOption.classList.add('correct-highlight');
                        btn.querySelector('.selected-text').textContent = correctOption.textContent;
                        btn.classList.add('success-highlight-permanent');
                    }
                } else if (wrapper) {
                    const btn = wrapper.querySelector('.matching-select-btn');
                    btn.disabled = true;
                    btn.style.pointerEvents = 'none';
                    btn.style.opacity = '0.8';
                }
            });
        } else if (exerciseType === 'choice') {
            const statementCards = card.querySelectorAll('.preview-statement-card');
            statementCards.forEach(statementCard => {
                let correctAnswers = [];
                try {
                    const correctAnswersAttr = statementCard.getAttribute('data-correct-answers');
                    if (correctAnswersAttr) {
                        correctAnswers = JSON.parse(correctAnswersAttr);
                        correctAnswers = correctAnswers.map(id => String(id));
                    }
                } catch(e) {
                    correctAnswers = [];
                }
                
                const allAnswers = statementCard.querySelectorAll('.preview-answer-row');
                allAnswers.forEach(answerRow => {
                    const checkbox = answerRow.querySelector('.checkbox-student');
                    const answerId = String(answerRow.dataset.answerId);
                    
                    if (checkbox) {
                        checkbox.style.pointerEvents = 'none';
                        checkbox.style.opacity = '0.8';
                        checkbox.classList.remove('selected');
                        
                        if (correctAnswers.includes(answerId)) {
                            checkbox.classList.add('correct-highlight');
                            checkbox.classList.add('selected');
                        }
                    }
                });
            });
        } else if (exerciseType === 'fill_blanks') {
            const sentenceCards = card.querySelectorAll('.preview-sentence-card');
            sentenceCards.forEach(sentenceCard => {
                let correctAnswers = [];
                try {
                    correctAnswers = JSON.parse(sentenceCard.dataset.correctAnswers || '[]');
                } catch(e) {
                    correctAnswers = [];
                }
                
                const blankWrappers = sentenceCard.querySelectorAll('.fillblanks-select-wrapper');
                blankWrappers.forEach((wrapper, idx) => {
                    const btn = wrapper.querySelector('.fillblanks-select-btn');
                    btn.disabled = true;
                    btn.style.pointerEvents = 'none';
                    btn.style.opacity = '0.8';
                    
                    const correctAnswer = correctAnswers[idx];
                    if (correctAnswer) {
                        const correctOption = wrapper.querySelector(`.fillblanks-select-option[data-value="${correctAnswer}"]`);
                        if (correctOption) {
                            correctOption.classList.add('correct-highlight');
                            btn.querySelector('.selected-text').textContent = correctAnswer;
                            btn.classList.add('success-highlight-permanent');
                        }
                    }
                });
            });
        }
    });
}

// Блокировка выполненного упражнения
function lockExercise(card, exerciseType) {
    if (exerciseType === 'matching') {
        const selectWrappers = card.querySelectorAll('.matching-select-wrapper');
        selectWrappers.forEach(wrapper => {
            const btn = wrapper.querySelector('.matching-select-btn');
            if (btn) {
                btn.classList.add('success-highlight-permanent');
                btn.disabled = true;
                btn.style.pointerEvents = 'none';
                btn.style.cursor = 'default';
                btn.style.opacity = '0.8';
                const chevron = btn.querySelector('.select-chevron');
                if (chevron) chevron.style.display = 'none';
            }
            const menu = wrapper.querySelector('.matching-select-menu');
            if (menu) menu.style.display = 'none';
        });
        
        const btns = card.querySelectorAll('.matching-select-btn');
        btns.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
        });
        } else if (exerciseType === 'choice') {
        const checkboxes = card.querySelectorAll('.checkbox-student');
        checkboxes.forEach(checkbox => {
            checkbox.style.pointerEvents = 'none';
            checkbox.style.opacity = '0.8';
            checkbox.style.cursor = 'default';
            // Добавляем класс успеха для выбранных
            if (checkbox.classList.contains('selected')) {
                checkbox.classList.add('success-highlight-permanent');
            }
            // Удаляем обработчики событий
            const newCheckbox = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(newCheckbox, checkbox);
        });
    } else if (exerciseType === 'fill_blanks') {
        const selectWrappers = card.querySelectorAll('.fillblanks-select-wrapper');
        selectWrappers.forEach(wrapper => {
            const btn = wrapper.querySelector('.fillblanks-select-btn');
            if (btn) {
                btn.classList.add('success-highlight-permanent');
                btn.disabled = true;
                btn.style.pointerEvents = 'none';
                btn.style.cursor = 'default';
                btn.style.opacity = '0.8';
                const chevron = btn.querySelector('.select-chevron');
                if (chevron) chevron.style.display = 'none';
            }
            const menu = wrapper.querySelector('.fillblanks-select-menu');
            if (menu) menu.style.display = 'none';
        });
        
        const btns = card.querySelectorAll('.fillblanks-select-btn');
        btns.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
        });
    }
    
    card.setAttribute('data-locked', 'true');
    card.style.userSelect = 'none';
}

// Простая подсветка ошибок для matching (без подсказок)
function highlightMatchingErrorsSimple(card, results) {
    if (!results) return;
    
    for (const [targetId, isCorrect] of Object.entries(results)) {
        const wrapper = card.querySelector(`.matching-select-wrapper[data-target-id="${targetId}"]`);
        if (wrapper) {
            const btn = wrapper.querySelector('.matching-select-btn');
            if (!isCorrect) {
                btn.classList.add('error-highlight');
                setTimeout(() => {
                    btn.classList.remove('error-highlight');
                }, 3000);
            }
        }
    }
}

// Простая подсветка ошибок для choice (без подсказок)
function highlightChoiceErrorsSimple(card, results) {
    if (!results) return;
    
    for (const [statementId, isCorrect] of Object.entries(results)) {
        const statementCard = card.querySelector(`.preview-statement-card[data-statement-id="${statementId}"]`);
        if (statementCard && !isCorrect) {
            const answersSection = statementCard.querySelector('.preview-answers-section');
            answersSection.classList.add('error-highlight');
            setTimeout(() => {
                answersSection.classList.remove('error-highlight');
            }, 3000);
        }
    }
}

// Простая подсветка ошибок для fill_blanks (без подсказок)
function highlightFillBlanksErrorsSimple(card, results) {
    if (!results) return;
    
    for (const [sentenceId, sentenceResult] of Object.entries(results)) {
        const sentenceCard = card.querySelector(`.preview-sentence-card[data-sentence-id="${sentenceId}"]`);
        if (sentenceCard && sentenceResult.blanks) {
            const blankWrappers = sentenceCard.querySelectorAll('.fillblanks-select-wrapper');
            blankWrappers.forEach((wrapper, idx) => {
                const btn = wrapper.querySelector('.fillblanks-select-btn');
                if (!sentenceResult.blanks[idx]) {
                    btn.classList.add('error-highlight');
                    setTimeout(() => {
                        btn.classList.remove('error-highlight');
                    }, 3000);
                }
            });
        }
    }
}

// Вспомогательная функция для получения ранее выполненных упражнений
// Вспомогательная функция для получения ранее выполненных упражнений
function getPreviouslyCompletedExercises(testId) {
    const completed = [];
    const exerciseCards = document.querySelectorAll('#previewTestExercisesList .preview-test-exercise-card');
    
    exerciseCards.forEach(card => {
        // Проверяем, есть ли у карточки класс success-highlight-permanent или данные о завершении
        const isLocked = card.querySelector('.matching-select-btn[disabled]') !== null ||
                         card.querySelector('.checkbox-student[style*="pointer-events: none"]') !== null ||
                         card.querySelector('.fillblanks-select-btn[disabled]') !== null;
        
        // Или проверяем по сохранённому состоянию
        const savedState = localStorage.getItem(`test_state_${testId}`);
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                const exerciseResult = state.exerciseResults[card.dataset.exerciseId];
                if (exerciseResult && exerciseResult.isCompleted) {
                    completed.push(card.dataset.exerciseId);
                    return;
                }
            } catch(e) {}
        }
        
        // Проверяем по баллам
        const scoreSpan = card.querySelector('.exercise-score-value');
        const maxScoreSpan = card.querySelector('.exercise-score-max');
        
        const score = parseInt(scoreSpan?.textContent || '0');
        const maxScoreText = maxScoreSpan?.textContent || '/ 100';
        const maxScore = parseInt(maxScoreText.replace('/', '').trim());
        
        // Если набрано максимальное количество баллов или упражнение заблокировано
        if (score >= maxScore || isLocked) {
            completed.push(card.dataset.exerciseId);
        }
    });
    
    return completed;
}

function isExerciseLocked(card) {
    const testId = card.dataset.sectionId;
    const exerciseId = card.dataset.exerciseId;
    
    // Проверяем, было ли упражнение полностью выполнено
    const isFullyCorrect = localStorage.getItem(`exercise_fully_correct_${testId}_${exerciseId}`) === 'true';
    if (isFullyCorrect) {
        return true;
    }
    
    // Проверяем по атрибуту
    if (card.getAttribute('data-locked') === 'true') {
        return true;
    }
    
    // Проверяем по баллам: если набрано максимальное количество баллов
    const scoreSpan = card.querySelector('.exercise-score-value');
    const maxScoreSpan = card.querySelector('.exercise-score-max');
    
    if (scoreSpan && maxScoreSpan) {
        const score = parseInt(scoreSpan.textContent);
        const maxScoreText = maxScoreSpan.textContent;
        const maxScore = parseInt(maxScoreText.replace('/', '').trim());
        
        // Если набрано максимальное количество баллов - упражнение выполнено
        if (score >= maxScore && maxScore > 0) {
            card.setAttribute('data-locked', 'true');
            return true;
        }
    }
    
    // Проверяем наличие disabled кнопок
    const matchingBtns = card.querySelectorAll('.matching-select-btn[disabled]');
    const fillBlanksBtns = card.querySelectorAll('.fillblanks-select-btn[disabled]');
    
    if (matchingBtns.length > 0 || fillBlanksBtns.length > 0) {
        card.setAttribute('data-locked', 'true');
        return true;
    }
    
    // Для choice проверяем pointer-events
    const checkboxes = card.querySelectorAll('.checkbox-student');
    if (checkboxes.length > 0) {
        const firstCheckbox = checkboxes[0];
        if (firstCheckbox.style.pointerEvents === 'none') {
            card.setAttribute('data-locked', 'true');
            return true;
        }
    }
    
    return false;
}

// Вспомогательная функция для получения количества попыток упражнения
function getExerciseAttemptsCount(testId, exerciseId) {
    // Здесь можно получить из localStorage или с сервера
    const key = `exercise_attempts_${testId}_${exerciseId}`;
    const attempts = localStorage.getItem(key);
    return attempts ? parseInt(attempts) : 0;
}

// Вспомогательная функция для сохранения попытки упражнения
async function saveExerciseAttempt(testId, exerciseId, attemptNumber, score, isSuccessful) {
    const key = `exercise_attempts_${testId}_${exerciseId}`;
    const currentAttempts = parseInt(localStorage.getItem(key) || '0');
    localStorage.setItem(key, currentAttempts + 1);
    
    // Сохраняем результат упражнения
    const exerciseKey = `exercise_result_${testId}_${exerciseId}`;
    const existingResult = localStorage.getItem(exerciseKey);
    
    if (!existingResult || (isSuccessful && JSON.parse(existingResult).score < score)) {
        localStorage.setItem(exerciseKey, JSON.stringify({
            score: score,
            attemptNumber: attemptNumber,
            isSuccessful: isSuccessful,
            timestamp: new Date().toISOString()
        }));
    }
}

// Вспомогательная функция для подсчета общего балла теста
function calculateTotalTestScore(testId) {
    let totalScore = 0;
    let totalMaxScore = 0;
    
    const exerciseCards = document.querySelectorAll('#previewTestExercisesList .preview-test-exercise-card');
    
    exerciseCards.forEach(card => {
        const scoreSpan = card.querySelector('.exercise-score-value');
        const maxScoreSpan = card.querySelector('.exercise-score-max');
        
        const score = parseInt(scoreSpan?.textContent || '0');
        const maxScoreText = maxScoreSpan?.textContent || '/ 100';
        const maxScore = parseInt(maxScoreText.replace('/', '').trim());
        
        totalScore += score;
        totalMaxScore += maxScore;
    });
    
    return { totalScore, totalMaxScore };
}

// Вспомогательная функция для получения баллов в зависимости от номера попытки
function getScoreForAttempt(scoring, attemptNumber) {
    if (attemptNumber === 1) return scoring.firstAttempt || 100;
    if (attemptNumber === 2) return scoring.secondAttempt || 50;
    if (attemptNumber === 3) return scoring.thirdAttempt || 25;
    return scoring.subsequentAttempts || 0;
}

// Вспомогательная функция для получения данных раздела
async function getSectionData(sectionId) {
    try {
        const token = getToken();
        const response = await fetch(`${apiBaseUrl}/sections/${sectionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            return data.section;
        }
    } catch (error) {
        console.error('Ошибка получения данных раздела:', error);
    }
    return null;
}

// Сбор ответов для сопоставления (только если упражнение не заблокировано)
function collectMatchingAnswers(card) {
    // Если упражнение заблокировано, возвращаем пустые ответы
    if (card.getAttribute('data-locked') === 'true') {
        return { userAnswers: {}, allSelected: true };
    }
    
    const selectWrappers = card.querySelectorAll('.matching-select-wrapper');
    const userAnswers = {};
    let allSelected = true;
    
    selectWrappers.forEach(wrapper => {
        const targetId = wrapper.dataset.targetId;
        const selectedOption = wrapper.querySelector('.matching-select-option.selected');
        if (selectedOption && selectedOption.dataset.value) {
            userAnswers[targetId] = selectedOption.dataset.value;
        } else {
            allSelected = false;
        }
    });
    
    return { userAnswers, allSelected };
}

// Сбор ответов для выбора правильного (только если упражнение не заблокировано)
function collectChoiceAnswers(card) {
    // Если упражнение заблокировано, возвращаем пустые ответы
    if (card.getAttribute('data-locked') === 'true') {
        return { userAnswers: {}, allHaveSelection: true };
    }
    
    const statementCards = card.querySelectorAll('.preview-statement-card');
    const userAnswers = {};
    let allHaveSelection = true;
    
    statementCards.forEach(card => {
        const statementId = card.dataset.statementId;
        const selectedCheckboxes = card.querySelectorAll('.checkbox-student.selected');
        const answerIds = [];
        
        selectedCheckboxes.forEach(checkbox => {
            answerIds.push(checkbox.dataset.answerId);
        });
        
        userAnswers[statementId] = answerIds;
        if (answerIds.length === 0) {
            allHaveSelection = false;
        }
    });
    
    return { userAnswers, allHaveSelection };
}

// Сбор ответов для дополнения
function collectFillBlanksAnswers(card) {
    const sentenceCards = card.querySelectorAll('.preview-sentence-card');
    const userAnswers = {};
    let allSelected = true;
    
    sentenceCards.forEach(card => {
        const sentenceId = card.dataset.sentenceId;
        const selectWrappers = card.querySelectorAll('.fillblanks-select-wrapper');
        const selectedWords = [];
        
        selectWrappers.forEach(wrapper => {
            const selectedOption = wrapper.querySelector('.fillblanks-select-option.selected');
            if (selectedOption && selectedOption.dataset.value) {
                selectedWords.push(selectedOption.dataset.value);
            } else {
                selectedWords.push('');
                allSelected = false;
            }
        });
        
        userAnswers[sentenceId] = selectedWords;
    });
    
    return { userAnswers, allSelected };
}

// Подсветка ошибок для сопоставления
function highlightMatchingErrors(card) {
    const selectWrappers = card.querySelectorAll('.matching-select-wrapper');
    selectWrappers.forEach(wrapper => {
        const selectedText = wrapper.querySelector('.selected-text')?.textContent || '';
        if (selectedText === '-- выберите элемент --') {
            wrapper.querySelector('.matching-select-btn')?.classList.add('error-highlight');
        }
    });
    setTimeout(() => {
        selectWrappers.forEach(w => {
            w.querySelector('.matching-select-btn')?.classList.remove('error-highlight');
        });
    }, 3000);
}

// Подсветка ошибок для выбора правильного
function highlightChoiceErrors(card) {
    const statementCards = card.querySelectorAll('.preview-statement-card');
    statementCards.forEach(card => {
        const selectedCheckboxes = card.querySelectorAll('.checkbox-student.selected');
        if (selectedCheckboxes.length === 0) {
            card.querySelector('.preview-answers-section')?.classList.add('error-highlight');
        }
    });
    setTimeout(() => {
        statementCards.forEach(c => {
            c.querySelector('.preview-answers-section')?.classList.remove('error-highlight');
        });
    }, 3000);
}

// Подсветка ошибок для дополнения
function highlightFillBlanksErrors(card) {
    const selectWrappers = card.querySelectorAll('.fillblanks-select-wrapper');
    selectWrappers.forEach(wrapper => {
        const selectedText = wrapper.querySelector('.selected-text')?.textContent || '';
        if (selectedText === '-- выберите слово --') {
            wrapper.querySelector('.fillblanks-select-btn')?.classList.add('error-highlight');
        }
    });
    setTimeout(() => {
        selectWrappers.forEach(w => {
            w.querySelector('.fillblanks-select-btn')?.classList.remove('error-highlight');
        });
    }, 3000);
}

// Подсветка результатов для сопоставления с показом правильных ответов
// Подсветка результатов для сопоставления с показом правильных ответов
function highlightMatchingResults(card, results) {
    console.log('highlightMatchingResults вызвана с results:', results);
    if (!results) {
        console.log('results пустые');
        return;
    }
    
    // Находим все строки сопоставления внутри карточки
    const rows = card.querySelectorAll('.matching-row-preview');
    console.log('Найдено строк:', rows.length);
    
    rows.forEach(row => {
        const targetId = row.dataset.targetId;
        const isCorrect = results[targetId];
        const correctItemNumber = row.dataset.correctItemNumber;
        
        console.log(`Обработка targetId: ${targetId}, isCorrect: ${isCorrect}, correctItemNumber: ${correctItemNumber}`);
        
        const wrapper = row.querySelector('.matching-select-wrapper');
        if (!wrapper) {
            console.log(`Wrapper не найден для targetId: ${targetId}`);
            return;
        }
        
        const btn = wrapper.querySelector('.matching-select-btn');
        const selectedTextSpan = btn.querySelector('.selected-text');
        const currentSelectedText = selectedTextSpan ? selectedTextSpan.textContent : '';
        
        console.log(`Текущий выбранный текст: ${currentSelectedText}`);
        
        if (isCorrect === true) {
            // Правильный ответ - зеленая подсветка
            btn.classList.add('success-highlight-temporary');
            setTimeout(() => {
                btn.classList.remove('success-highlight-temporary');
            }, 3000);
        } else if (isCorrect === false) {
            // Неправильный ответ - красная подсветка
            btn.classList.add('error-highlight');
            
            // Показываем правильный ответ
            if (correctItemNumber && correctItemNumber !== '0') {
                // Находим правильный вариант в меню
                const correctOption = wrapper.querySelector(`.matching-select-option[data-item-number="${correctItemNumber}"]`);
                
                if (correctOption) {
                    // Подсвечиваем правильный вариант в меню зеленым
                    correctOption.classList.add('correct-highlight');
                    
                    const correctText = correctOption.textContent;
                    
                    // Добавляем подсказку с правильным ответом
                    const tooltip = document.createElement('div');
                    tooltip.className = 'correct-answer-tooltip';
                    tooltip.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 16px;">✓</span>
                            <span>Правильный ответ: ${escapeHtml(correctText)}</span>
                        </div>
                    `;
                    tooltip.style.position = 'absolute';
                    tooltip.style.backgroundColor = '#4CAF50';
                    tooltip.style.color = 'white';
                    tooltip.style.padding = '6px 12px';
                    tooltip.style.borderRadius = '8px';
                    tooltip.style.fontSize = '12px';
                    tooltip.style.marginTop = '4px';
                    tooltip.style.zIndex = '100';
                    tooltip.style.whiteSpace = 'nowrap';
                    tooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                    tooltip.style.left = '0';
                    tooltip.style.top = '100%';
                    
                    // Удаляем старую подсказку, если есть
                    const oldTooltip = wrapper.querySelector('.correct-answer-tooltip');
                    if (oldTooltip) oldTooltip.remove();
                    
                    wrapper.style.position = 'relative';
                    wrapper.appendChild(tooltip);
                    
                    // Удаляем подсказку через 5 секунд
                    setTimeout(() => {
                        if (tooltip.parentNode) tooltip.remove();
                        correctOption.classList.remove('correct-highlight');
                    }, 5000);
                }
            }
            
            setTimeout(() => {
                btn.classList.remove('error-highlight');
            }, 5000);
        }
    });
}

// Подсветка результатов для выбора правильного
// Подсветка результатов для выбора правильного
function highlightChoiceResults(card, results) {
    if (!results) return;
    
    for (const [statementId, isCorrect] of Object.entries(results)) {
        const statementCard = card.querySelector(`.preview-statement-card[data-statement-id="${statementId}"]`);
        if (statementCard) {
            if (isCorrect) {
                // Правильный ответ - зеленая подсветка выбранных чекбоксов
                const selectedCheckboxes = statementCard.querySelectorAll('.checkbox-student.selected');
                selectedCheckboxes.forEach(cb => {
                    cb.classList.add('success-highlight-temporary');
                    setTimeout(() => cb.classList.remove('success-highlight-temporary'), 3000);
                });
            } else {
                // Неправильный ответ - красная подсветка секции
                const answersSection = statementCard.querySelector('.preview-answers-section');
                answersSection.classList.add('error-highlight');
                setTimeout(() => answersSection.classList.remove('error-highlight'), 3000);
                
                // Подсвечиваем правильные ответы зеленым
                const allAnswers = statementCard.querySelectorAll('.preview-answer-row');
                allAnswers.forEach(answerRow => {
                    const answerId = answerRow.dataset.answerId;
                    // Проверяем, является ли этот ответ правильным
                    // Для этого нужно получить данные из упражнения
                    // Временно можно подсветить все правильные ответы из checkResult
                });
            }
        }
    }
}

// Подсветка результатов для дополнения
function highlightFillBlanksResults(card, results) {
    if (!results) return;
    
    for (const [sentenceId, sentenceResult] of Object.entries(results)) {
        const sentenceCard = card.querySelector(`.preview-sentence-card[data-sentence-id="${sentenceId}"]`);
        if (sentenceCard && sentenceResult.blanks) {
            const blankWrappers = sentenceCard.querySelectorAll('.fillblanks-select-wrapper');
            blankWrappers.forEach((wrapper, idx) => {
                const btn = wrapper.querySelector('.fillblanks-select-btn');
                if (sentenceResult.blanks[idx]) {
                    btn.classList.add('success-highlight-temporary');
                    setTimeout(() => btn.classList.remove('success-highlight-temporary'), 3000);
                } else {
                    btn.classList.add('error-highlight');
                    setTimeout(() => btn.classList.remove('error-highlight'), 3000);
                }
            });
        }
    }
}

// Блокировка выполненного упражнения
function lockExercise(card, exerciseType) {
    if (exerciseType === 'matching') {
        // Блокируем все кнопки выбора
        const selectWrappers = card.querySelectorAll('.matching-select-wrapper');
        selectWrappers.forEach(wrapper => {
            const btn = wrapper.querySelector('.matching-select-btn');
            if (btn) {
                btn.classList.add('success-highlight-permanent');
                btn.disabled = true;
                btn.style.pointerEvents = 'none';
                btn.style.cursor = 'default';
                btn.style.opacity = '0.8';
                const chevron = btn.querySelector('.select-chevron');
                if (chevron) chevron.style.display = 'none';
            }
            // Также удаляем возможные обработчики событий
            const menu = wrapper.querySelector('.matching-select-menu');
            if (menu) menu.style.display = 'none';
        });
        
        // Удаляем обработчики событий на кнопках
        const btns = card.querySelectorAll('.matching-select-btn');
        btns.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
        });
        
    } else if (exerciseType === 'choice') {
        // Блокируем все чекбоксы
        const checkboxes = card.querySelectorAll('.checkbox-student');
        checkboxes.forEach(checkbox => {
            checkbox.style.pointerEvents = 'none';
            checkbox.style.opacity = '0.8';
            checkbox.style.cursor = 'default';
            if (checkbox.classList.contains('selected')) {
                checkbox.classList.add('success-highlight-permanent');
            }
            // Удаляем обработчики событий
            const newCheckbox = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(newCheckbox, checkbox);
        });
        
    } else if (exerciseType === 'fill_blanks') {
        // Блокируем все dropdown
        const selectWrappers = card.querySelectorAll('.fillblanks-select-wrapper');
        selectWrappers.forEach(wrapper => {
            const btn = wrapper.querySelector('.fillblanks-select-btn');
            if (btn) {
                btn.classList.add('success-highlight-permanent');
                btn.disabled = true;
                btn.style.pointerEvents = 'none';
                btn.style.cursor = 'default';
                btn.style.opacity = '0.8';
                const chevron = btn.querySelector('.select-chevron');
                if (chevron) chevron.style.display = 'none';
            }
            const menu = wrapper.querySelector('.fillblanks-select-menu');
            if (menu) menu.style.display = 'none';
        });

        // В lockExercise, в конце функции:
    if (card.dataset.sectionId && card.dataset.exerciseId) {
        const testId = card.dataset.sectionId;
        const exerciseId = card.dataset.exerciseId;
        const savedScore = localStorage.getItem(`exercise_result_${testId}_${exerciseId}`);
        if (savedScore) {
            try {
                const result = JSON.parse(savedScore);
                const scoreSpan = card.querySelector('.exercise-score-value');
                if (scoreSpan && result.score > 0) {
                    scoreSpan.textContent = result.score;
                }
            } catch(e) {}
        }
    }
        
        // Удаляем обработчики событий
        const btns = card.querySelectorAll('.fillblanks-select-btn');
        btns.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
        });
    }
    
    // Добавляем атрибут data-locked для отслеживания
    card.setAttribute('data-locked', 'true');
    
    // Также блокируем саму карточку от любых изменений
    card.style.userSelect = 'none';
}

// Проверка упражнения в тесте (matching)
async function checkTestMatchingExercise(testId, exerciseId, userAnswers) {
    try {
        const token = getToken();
        console.log('Отправляем на сервер:', { testId, exerciseId, userAnswers });
        
        const response = await fetch(`${apiBaseUrl}/student/test/${testId}/exercise/${exerciseId}/check`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ userAnswers })
        });
        
        const data = await response.json();
        console.log('Ответ сервера для matching:', data);
        return data;
    } catch (error) {
        console.error('Ошибка проверки упражнения теста (matching):', error);
        return { success: false, correct: false, results: {} };
    }
}

// Проверка упражнения в тесте (choice)
async function checkTestChoiceExercise(testId, exerciseId, userAnswers) {
    try {
        const token = getToken();
        const response = await fetch(`${apiBaseUrl}/student/test/${testId}/exercise/${exerciseId}/check`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ userAnswers })
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Ошибка проверки упражнения теста (choice):', error);
        return { success: false, correct: false, results: [] };
    }
}

// Проверка упражнения в тесте (fill_blanks)
async function checkTestFillBlanksExercise(testId, exerciseId, userAnswers) {
    try {
        const token = getToken();
        const response = await fetch(`${apiBaseUrl}/student/test/${testId}/exercise/${exerciseId}/check`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ userAnswers })
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Ошибка проверки упражнения теста (fill_blanks):', error);
        return { success: false, correct: false, results: [] };
    }
}

// Получение количества попыток теста для студента
async function getTestAttempts(testId) {
    try {
        const token = getToken();
        const response = await fetch(`${apiBaseUrl}/student/test/${testId}/attempts`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.attemptsCount || 0;
        }
        return 0;
    } catch (error) {
        console.error('Ошибка получения попыток теста:', error);
        return 0;
    }
}

// Сохранение результата попытки теста
async function saveTestAttempt(testId, attemptNumber, totalScore, maxScore, exerciseResults) {
    try {
        const token = getToken();
        const response = await fetch(`${apiBaseUrl}/student/test/${testId}/attempt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                attemptNumber,
                totalScore,
                maxScore,
                exerciseResults,
                timestamp: new Date().toISOString()
            })
        });
        
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Ошибка сохранения попытки теста:', error);
        return false;
    }
}

function updateTestAttemptsDisplay() {
    if (currentUserRole !== 'student') return;
    const attemptsContainer = document.getElementById('testAttemptsInfo');
    if (!attemptsContainer) {
        // Создаем контейнер для информации о попытках, если его нет
        const testSettingsPreview = document.querySelector('.test-settings-preview');
        if (testSettingsPreview) {
            const attemptsDiv = document.createElement('div');
            attemptsDiv.id = 'testAttemptsInfo';
            attemptsDiv.className = 'attempts-info';
            attemptsDiv.style.marginTop = '12px';
            attemptsDiv.style.paddingTop = '12px';
            attemptsDiv.style.borderTop = '1px solid #e5e7eb';
            testSettingsPreview.appendChild(attemptsDiv);
        }
    }
    
    const attemptsContainerEl = document.getElementById('testAttemptsInfo');
    if (attemptsContainerEl) {
        const remainingAttempts = Math.max(0, MAX_TEST_ATTEMPTS - testAttemptsCount);
        attemptsContainerEl.innerHTML = `
            <div class="attempts-row">
                <span class="attempts-label">Попытки:</span>
                <span class="attempts-value">${testAttemptsCount} / ${MAX_TEST_ATTEMPTS}</span>
                <span class="attempts-remaining">(осталось: ${remainingAttempts})</span>
            </div>
        `;
        
        // Если попытки закончились, блокируем кнопку
        if (testAttemptsCount >= MAX_TEST_ATTEMPTS) {
            const testSubmitBtn = document.getElementById('testSubmitBtn');
            if (testSubmitBtn) {
                testSubmitBtn.disabled = true;
                testSubmitBtn.style.opacity = '0.5';
                testSubmitBtn.style.cursor = 'not-allowed';
                testSubmitBtn.title = 'Лимит попыток исчерпан';
            }
            // Показываем уведомление только один раз
            const lastNotification = localStorage.getItem('last_attempts_notification');
            const now = Date.now();
            if (!lastNotification || (now - parseInt(lastNotification)) > 5000) {
                showNotification('Лимит попыток исчерпан!', 'warning');
                localStorage.setItem('last_attempts_notification', now.toString());
            }
        } else {
            const testSubmitBtn = document.getElementById('testSubmitBtn');
            if (testSubmitBtn) {
                testSubmitBtn.disabled = false;
                testSubmitBtn.style.opacity = '1';
                testSubmitBtn.style.cursor = 'pointer';
                testSubmitBtn.title = '';
            }
        }
    }
}

// Принудительный сброс состояния теста (для отладки)
function forceResetTestState(testId) {
    console.log('Принудительный сброс состояния теста:', testId);
    localStorage.removeItem(`test_state_${testId}`);
    localStorage.removeItem(`test_state_${testId}_temp`);
    testAttemptsCount = 0;
    testAttemptsScores = [];
    resetTestScoresDisplay();
    updateTestAttemptsDisplay();
    
    // Разблокируем кнопку
    const testSubmitBtn = document.getElementById('testSubmitBtn');
    if (testSubmitBtn) {
        testSubmitBtn.disabled = false;
        testSubmitBtn.style.opacity = '1';
        testSubmitBtn.style.cursor = 'pointer';
    }
    
    showNotification('Состояние теста сброшено', 'success');
}

// Устаревшие функции (заменены на серверные)
// Устаревшие функции (заменены на серверные)
function saveTestState(testId) {
    // Не сохраняем, если нет попыток или попытка 0
    if (testAttemptsCount === 0) {
        console.log('saveTestState: пропущено, testAttemptsCount = 0');
        return;
    }
    
    // Перенаправляем на серверное сохранение
    if (currentUserRole === 'student' && document.getElementById('testPreviewContainer').style.display === 'block') {
        const { exerciseResults, totalScore, totalMaxScore } = collectExerciseResultsForSave();
        saveTestStateToServer(testId, testAttemptsCount, totalScore, totalMaxScore, exerciseResults);
    }
}

function loadTestState(testId) {
// Перенаправляем на серверную загрузку
    return restoreTestFromServer(testId);
}

// Перепривязка обработчика кнопки теста (для студента)
function rebindTestSubmitHandler() {
    const testSubmitBtn = document.getElementById('testSubmitBtn');
    if (testSubmitBtn) {
        // Удаляем старый обработчик через клонирование
        const newBtn = testSubmitBtn.cloneNode(true);
        testSubmitBtn.parentNode.replaceChild(newBtn, testSubmitBtn);
        
        newBtn.addEventListener('click', async () => {
            console.log('====== НАЧАЛО ПРОВЕРКИ ТЕСТА ======');
            const isValid = await validateAndSubmitTest();
            if (isValid) {
                showNotification('Тест успешно проверен!', 'success');
                // Обновляем кнопки после проверки
                updateTestButtons();
            }
        });
    }
}

function restoreExerciseAnswers(card, answers, typeText) {
    console.log(`Восстановление ответов для ${typeText}:`, answers);
    
    if (typeText === 'Сопоставление') {
        for (const [targetId, itemId] of Object.entries(answers)) {
            const wrapper = card.querySelector(`.matching-select-wrapper[data-target-id="${targetId}"]`);
            if (wrapper) {
                const option = wrapper.querySelector(`.matching-select-option[data-value="${itemId}"]`);
                if (option) {
                    const btn = wrapper.querySelector('.matching-select-btn');
                    const selectedTextSpan = btn.querySelector('.selected-text');
                    if (selectedTextSpan) {
                        selectedTextSpan.textContent = option.textContent;
                    }
                    // Убираем selected у всех опций
                    wrapper.querySelectorAll('.matching-select-option').forEach(opt => opt.classList.remove('selected'));
                    option.classList.add('selected');
                    console.log(`Восстановлен matching ответ: targetId=${targetId}, value=${itemId}`);
                }
            }
        }
    } else if (typeText === 'Выбор правильного') {
        for (const [statementId, answerIds] of Object.entries(answers)) {
            for (const answerId of answerIds) {
                const checkbox = card.querySelector(`.checkbox-student[data-statement-id="${statementId}"][data-answer-id="${answerId}"]`);
                if (checkbox) {
                    checkbox.classList.add('selected');
                    console.log(`Восстановлен choice ответ: statementId=${statementId}, answerId=${answerId}`);
                }
            }
        }
    } else if (typeText === 'Дополнение') {
        for (const [sentenceId, words] of Object.entries(answers)) {
            const sentenceCard = card.querySelector(`.preview-sentence-card[data-sentence-id="${sentenceId}"]`);
            if (sentenceCard) {
                const blankWrappers = sentenceCard.querySelectorAll('.fillblanks-select-wrapper');
                blankWrappers.forEach((wrapper, idx) => {
                    if (words[idx] && words[idx] !== '') {
                        const option = wrapper.querySelector(`.fillblanks-select-option[data-value="${words[idx]}"]`);
                        if (option) {
                            const btn = wrapper.querySelector('.fillblanks-select-btn');
                            if (btn) {
                                const selectedTextSpan = btn.querySelector('.selected-text');
                                if (selectedTextSpan) {
                                    selectedTextSpan.textContent = words[idx];
                                }
                            }
                            option.classList.add('selected');
                            console.log(`Восстановлен fill_blanks ответ: sentenceId=${sentenceId}, blank=${idx}, word=${words[idx]}`);
                        }
                    }
                });
            }
        }
    }
}

// Проверка, завершён ли тест (все упражнения выполнены)
function isTestCompleted() {
  const exerciseCards = document.querySelectorAll('#previewTestExercisesList .preview-test-exercise-card');
  if (exerciseCards.length === 0) return false;
  
  let allCompleted = true;
  
  for (const card of exerciseCards) {
    const testId = card.dataset.sectionId;
    const exerciseId = card.dataset.exerciseId;
    
    // Проверяем по флагу полного выполнения
    const isFullyCorrect = localStorage.getItem(`exercise_fully_correct_${testId}_${exerciseId}`) === 'true';
    
    // Проверяем по баллам
    const scoreSpan = card.querySelector('.exercise-score-value');
    const maxScoreSpan = card.querySelector('.exercise-score-max');
    
    let score = 0;
    let maxScore = 0;
    
    if (scoreSpan && maxScoreSpan) {
      score = parseInt(scoreSpan.textContent) || 0;
      const maxScoreText = maxScoreSpan.textContent;
      maxScore = parseInt(maxScoreText.replace('/', '').trim()) || 0;
    }
    
    // Проверяем по атрибуту блокировки
    const isLocked = card.getAttribute('data-locked') === 'true';
    
    // Если не выполнено ни по одному критерию
    if (!isFullyCorrect && !isLocked && score < maxScore) {
      allCompleted = false;
    }
  }
  
  return allCompleted;
}

// Найти функцию updateTestButtons и заменить её на эту:

function updateTestButtons() {
  console.log('[updateTestButtons] Called');
  
  const testNextStep = document.getElementById('testNextStep');
  const testSubmitBtn = document.getElementById('testSubmitBtn');
  const testNextBtn = document.getElementById('testNextBtn');
  const totalScoreWrapper = document.querySelector('.total-score-container');
  
  if (!testNextStep) {
    console.log('[updateTestButtons] testNextStep not found');
    return;
  }
  
  // Получаем текущий sectionId для проверки следующего раздела
  const currentSectionId = currentEditingExerciseSection?.id;
  const hasNext = currentSectionId ? findNextSection(currentSectionId) !== null : false;
  
  console.log('[updateTestButtons] hasNext:', hasNext);
  console.log('[updateTestButtons] testAttemptsCount:', testAttemptsCount);
  console.log('[updateTestButtons] currentUserRole:', currentUserRole);
  
  // Для студента
  if (currentUserRole === 'student') {
    const testCompleted = isTestCompleted();
    const attemptsExhausted = testAttemptsCount >= MAX_TEST_ATTEMPTS;
    
    console.log('[updateTestButtons] testCompleted:', testCompleted);
    console.log('[updateTestButtons] attemptsExhausted:', attemptsExhausted);
    
    // Случай 1: Тест НЕ выполнен И попытки НЕ исчерпаны -> показываем кнопку "Отправить решение"
    if (!testCompleted && !attemptsExhausted) {
      console.log('[updateTestButtons] Show submit button');
      
      if (testSubmitBtn) {
        // ПРИНУДИТЕЛЬНО показываем кнопку, переопределяя inline style
        testSubmitBtn.style.display = 'flex';
        testSubmitBtn.style.background = '#379B34';
        
        // Убираем старый обработчик и добавляем новый
        const newSubmitBtn = testSubmitBtn.cloneNode(true);
        testSubmitBtn.parentNode.replaceChild(newSubmitBtn, testSubmitBtn);
        newSubmitBtn.addEventListener('click', async () => {
          console.log('[updateTestButtons] Submit button clicked');
          const isValid = await validateAndSubmitTest();
          if (isValid) {
            showNotification('Тест успешно проверен!', 'success');
            updateTestButtons();
          }
        });
      }
      
      if (testNextBtn) {
        testNextBtn.style.display = 'none';
      }
      
      if (totalScoreWrapper) {
        totalScoreWrapper.style.display = 'flex';
      }
      
      testNextStep.style.display = 'flex';
    }
    // Случай 2: Тест выполнен ИЛИ попытки исчерпаны -> показываем "Следующий шаг"
    else {
      console.log('[updateTestButtons] Show next button or nothing');
      
      if (testSubmitBtn) {
        testSubmitBtn.style.display = 'none';
      }
      
      if (testNextBtn) {
        if (hasNext) {
          console.log('[updateTestButtons] Showing next button');
          testNextBtn.style.display = 'flex';
          testNextBtn.style.background = '#7651BE';
          const arrowIcon = testNextBtn.querySelector('.next-arrow-icon');
          if (arrowIcon) arrowIcon.style.filter = 'brightness(0) invert(1)';
          
          // Убираем старый обработчик и добавляем новый
          const newNextBtn = testNextBtn.cloneNode(true);
          testNextBtn.parentNode.replaceChild(newNextBtn, testNextBtn);
          newNextBtn.addEventListener('click', navigateToNextSection);
        } else {
          console.log('[updateTestButtons] No next section, hiding next button');
          testNextBtn.style.display = 'none';
        }
      }
      
      testNextStep.style.display = 'flex';
      
      if (attemptsExhausted && !testCompleted) {
        console.log('[updateTestButtons] Attempts exhausted, highlighting errors');
        setTimeout(() => {
          highlightAllErrorsOnAttemptsExhausted();
        }, 100);
      }
    }
  }
  // Для учителя
  else if (currentUserRole === 'teacher') {
    console.log('[updateTestButtons] Teacher mode');
    
    if (testSubmitBtn) {
      testSubmitBtn.style.display = 'none';
    }
    
    if (testNextBtn) {
      if (hasNext) {
        testNextBtn.style.display = 'flex';
        testNextBtn.style.background = '#7651BE';
        const arrowIcon = testNextBtn.querySelector('.next-arrow-icon');
        if (arrowIcon) arrowIcon.style.filter = 'brightness(0) invert(1)';
      } else {
        testNextBtn.style.display = 'none';
      }
    }
    
    testNextStep.style.display = 'flex';
  }
}

// Функция для подсветки ошибок когда попытки закончились
function highlightAllErrorsOnAttemptsExhausted() {
    const exerciseCards = document.querySelectorAll('#previewTestExercisesList .preview-test-exercise-card');
    
    exerciseCards.forEach(card => {
        const scoreSpan = card.querySelector('.exercise-score-value');
        const maxScoreSpan = card.querySelector('.exercise-score-max');
        
        const score = parseInt(scoreSpan?.textContent || '0');
        const maxScoreText = maxScoreSpan?.textContent || '/ 100';
        const maxScore = parseInt(maxScoreText.replace('/', '').trim());
        
        const testId = card.dataset.sectionId;
        const exerciseId = card.dataset.exerciseId;
        
        // Проверяем, было ли упражнение полностью выполнено (сохранённый флаг)
        const isFullyCorrect = localStorage.getItem(`exercise_fully_correct_${testId}_${exerciseId}`) === 'true';
        
        // Упражнение считается выполненным, если:
        // 1. isFullyCorrect === true (сервер подтвердил полную правильность)
        // 2. score >= maxScore (набрано максимальное количество баллов)
        const isExerciseCompleted = isFullyCorrect || (score >= maxScore && maxScore > 0);
        
        // Красная подсветка ТОЛЬКО если упражнение НЕ выполнено и набрано 0 баллов
        if (!isExerciseCompleted && score === 0) {
            card.classList.add('test-card-error');
        } else {
            card.classList.remove('test-card-error');
        }
        
        const typeText = card.querySelector('.exercise-type-preview')?.textContent || '';
        let exerciseType = '';
        if (typeText === 'Сопоставление') exerciseType = 'matching';
        else if (typeText === 'Выбор правильного') exerciseType = 'choice';
        else if (typeText === 'Дополнение') exerciseType = 'fill_blanks';
        
        if (exerciseType === 'matching') {
            const rows = card.querySelectorAll('.matching-row-preview');
            rows.forEach(row => {
                const correctItemNumber = row.dataset.correctItemNumber;
                const wrapper = row.querySelector('.matching-select-wrapper');
                if (wrapper && correctItemNumber && correctItemNumber !== '0') {
                    const btn = wrapper.querySelector('.matching-select-btn');
                    btn.disabled = true;
                    btn.style.pointerEvents = 'none';
                    btn.style.opacity = '0.8';
                    
                    const correctOption = wrapper.querySelector(`.matching-select-option[data-item-number="${correctItemNumber}"]`);
                    if (correctOption) {
                        correctOption.classList.add('correct-highlight');
                        btn.querySelector('.selected-text').textContent = correctOption.textContent;
                        btn.classList.add('success-highlight-permanent');
                    }
                } else if (wrapper) {
                    const btn = wrapper.querySelector('.matching-select-btn');
                    btn.disabled = true;
                    btn.style.pointerEvents = 'none';
                    btn.style.opacity = '0.8';
                }
            });
        } else if (exerciseType === 'choice') {
            const statementCards = card.querySelectorAll('.preview-statement-card');
            statementCards.forEach(statementCard => {
                let correctAnswers = [];
                try {
                    const correctAnswersAttr = statementCard.getAttribute('data-correct-answers');
                    if (correctAnswersAttr) {
                        correctAnswers = JSON.parse(correctAnswersAttr);
                        correctAnswers = correctAnswers.map(id => String(id));
                    }
                } catch(e) {
                    correctAnswers = [];
                }
                
                const allAnswers = statementCard.querySelectorAll('.preview-answer-row');
                allAnswers.forEach(answerRow => {
                    const checkbox = answerRow.querySelector('.checkbox-student');
                    const answerId = String(answerRow.dataset.answerId);
                    
                    if (checkbox) {
                        checkbox.style.pointerEvents = 'none';
                        checkbox.style.opacity = '0.8';
                        checkbox.classList.remove('selected');
                        
                        if (correctAnswers.includes(answerId)) {
                            checkbox.classList.add('correct-highlight');
                            checkbox.classList.add('selected');
                        }
                    }
                });
            });
        } else if (exerciseType === 'fill_blanks') {
            const sentenceCards = card.querySelectorAll('.preview-sentence-card');
            sentenceCards.forEach(sentenceCard => {
                let correctAnswers = [];
                try {
                    correctAnswers = JSON.parse(sentenceCard.dataset.correctAnswers || '[]');
                } catch(e) {
                    correctAnswers = [];
                }
                
                const blankWrappers = sentenceCard.querySelectorAll('.fillblanks-select-wrapper');
                blankWrappers.forEach((wrapper, idx) => {
                    const btn = wrapper.querySelector('.fillblanks-select-btn');
                    btn.disabled = true;
                    btn.style.pointerEvents = 'none';
                    btn.style.opacity = '0.8';
                    
                    const correctAnswer = correctAnswers[idx];
                    if (correctAnswer) {
                        const correctOption = wrapper.querySelector(`.fillblanks-select-option[data-value="${correctAnswer}"]`);
                        if (correctOption) {
                            correctOption.classList.add('correct-highlight');
                            btn.querySelector('.selected-text').textContent = correctAnswer;
                            btn.classList.add('success-highlight-permanent');
                        }
                    }
                });
            });
        }
    });
}

// Синхронизация состояния упражнений при загрузке теста
function syncExerciseLockState() {
    const exerciseCards = document.querySelectorAll('#previewTestExercisesList .preview-test-exercise-card');
    
    exerciseCards.forEach(card => {
        const testId = card.dataset.sectionId;
        const exerciseId = card.dataset.exerciseId;
        
        // Проверяем по сохранённому флагу
        const isFullyCorrect = localStorage.getItem(`exercise_fully_correct_${testId}_${exerciseId}`) === 'true';
        
        if (isFullyCorrect) {
            // Упражнение должно быть заблокировано
            const typeText = card.querySelector('.exercise-type-preview')?.textContent || '';
            let exerciseType = '';
            if (typeText === 'Сопоставление') exerciseType = 'matching';
            else if (typeText === 'Выбор правильного') exerciseType = 'choice';
            else if (typeText === 'Дополнение') exerciseType = 'fill_blanks';
            
            if (exerciseType) {
                // Проверяем, не заблокировано ли уже
                if (!isExerciseLocked(card)) {
                    lockExercise(card, exerciseType);
                }
            }
            
            // ВАЖНО: НЕ перезаписываем баллы на максимальные!
            // Оставляем баллы как есть (они уже восстановлены из сохранённого состояния)
        }
    });
    
    // Пересчитываем итоговые баллы (суммируем то, что есть)
    updateTotalTestScore();
    
    // Обновляем кнопки с учётом наличия следующего раздела
    const currentSectionId = currentEditingExerciseSection?.id;
    const hasNext = currentSectionId ? findNextSection(currentSectionId) !== null : false;
    const testNextBtn = document.getElementById('testNextBtn');
    
    if (!hasNext && testNextBtn) {
        testNextBtn.style.display = 'none';
    }
}

// Подсветка неправильных ответов при отправке теста (без блокировки)
function highlightIncorrectAnswers(card, exerciseType, checkResult, userAnswers) {
    console.log('highlightIncorrectAnswers вызвана для типа:', exerciseType, 'userAnswers:', userAnswers);
    
    if (exerciseType === 'matching') {
        // Для matching - получаем правильные ответы из data-атрибутов строк
        const rows = card.querySelectorAll('.matching-row-preview');
        
        rows.forEach(row => {
            const targetId = row.dataset.targetId;
            const correctItemNumber = row.dataset.correctItemNumber;
            const selectedItemNumber = row.dataset.selectedItemNumber;
            
            // Получаем выбранный ответ студента
            const wrapper = row.querySelector('.matching-select-wrapper');
            const selectedOption = wrapper ? wrapper.querySelector('.matching-select-option.selected') : null;
            const selectedValue = selectedOption ? selectedOption.dataset.value : null;
            const selectedNumber = selectedOption ? selectedOption.dataset.itemNumber : null;
            
            // Проверяем, правильный ли ответ
            const isCorrect = correctItemNumber && selectedNumber && correctItemNumber === selectedNumber;
            
            if (!isCorrect && selectedNumber) {
                // Неправильный ответ - красная подсветка
                const btn = wrapper.querySelector('.matching-select-btn');
                btn.classList.add('error-highlight');
                console.log('Подсветили matching ошибку для targetId:', targetId);
                setTimeout(() => {
                    btn.classList.remove('error-highlight');
                }, 3000);
            }
        });
    } 
    else if (exerciseType === 'choice') {
        // Для choice - получаем правильные ответы из data-атрибутов утверждений
        const statementCards = card.querySelectorAll('.preview-statement-card');
        
        statementCards.forEach(statementCard => {
            const statementId = statementCard.dataset.statementId;
            let correctAnswers = [];
            try {
                const correctAnswersAttr = statementCard.getAttribute('data-correct-answers');
                if (correctAnswersAttr) {
                    correctAnswers = JSON.parse(correctAnswersAttr);
                    correctAnswers = correctAnswers.map(id => String(id));
                }
            } catch(e) {
                correctAnswers = [];
            }
            
            // Получаем выбранные ответы студента
            const selectedCheckboxes = statementCard.querySelectorAll('.checkbox-student.selected');
            const selectedAnswerIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.answerId);
            
            // Проверяем, все ли выбранные ответы правильные и выбраны ли все правильные
            let hasIncorrect = false;
            for (const answerId of selectedAnswerIds) {
                if (!correctAnswers.includes(String(answerId))) {
                    hasIncorrect = true;
                    break;
                }
            }
            
            // Также проверяем, не пропустил ли студент какой-то правильный ответ
            for (const correctId of correctAnswers) {
                if (!selectedAnswerIds.includes(correctId)) {
                    hasIncorrect = true;
                    break;
                }
            }
            
            if (hasIncorrect && selectedAnswerIds.length > 0) {
                const answersSection = statementCard.querySelector('.preview-answers-section');
                answersSection.classList.add('error-highlight');
                console.log('Подсветили choice ошибку для statementId:', statementId);
                setTimeout(() => {
                    answersSection.classList.remove('error-highlight');
                }, 3000);
            }
        });
    } 
    else if (exerciseType === 'fill_blanks') {
        // Для fill_blanks - получаем правильные ответы из data-атрибутов
        const sentenceCards = card.querySelectorAll('.preview-sentence-card');
        
        sentenceCards.forEach(sentenceCard => {
            let correctAnswers = [];
            try {
                correctAnswers = JSON.parse(sentenceCard.dataset.correctAnswers || '[]');
            } catch(e) {
                correctAnswers = [];
            }
            
            const blankWrappers = sentenceCard.querySelectorAll('.fillblanks-select-wrapper');
            blankWrappers.forEach((wrapper, idx) => {
                const selectedOption = wrapper.querySelector('.fillblanks-select-option.selected');
                const selectedWord = selectedOption ? selectedOption.dataset.value : '';
                const correctAnswer = correctAnswers[idx] || '';
                
                const isCorrect = selectedWord && correctAnswer && selectedWord === correctAnswer;
                
                if (!isCorrect && selectedWord) {
                    const btn = wrapper.querySelector('.fillblanks-select-btn');
                    btn.classList.add('error-highlight');
                    console.log('Подсветили fill_blanks ошибку для blank:', idx);
                    setTimeout(() => {
                        btn.classList.remove('error-highlight');
                    }, 3000);
                }
            });
        });
    }
}

// ===== ПОДСВЕТКА РЕЗУЛЬТАТОВ ДЛЯ УПРАЖНЕНИЙ (НЕ ТЕСТОВ) =====

// Подсветка результатов для сопоставления (matching) в упражнении
function highlightMatchingResults(card, results) {
    if (!results) return;
    
    const rows = card.querySelectorAll('.matching-row-preview');
    
    rows.forEach(row => {
        const targetId = row.dataset.targetId;
        const isCorrect = results[targetId];
        const correctItemNumber = row.dataset.correctItemNumber;
        
        const wrapper = row.querySelector('.matching-select-wrapper');
        if (!wrapper) return;
        
        const btn = wrapper.querySelector('.matching-select-btn');
        
        if (isCorrect === true) {
            btn.classList.add('success-highlight-temporary');
            setTimeout(() => btn.classList.remove('success-highlight-temporary'), 3000);
        } else if (isCorrect === false) {
            btn.classList.add('error-highlight');
            
            if (correctItemNumber && correctItemNumber !== '0') {
                const correctOption = wrapper.querySelector(`.matching-select-option[data-item-number="${correctItemNumber}"]`);
                if (correctOption) {
                    correctOption.classList.add('correct-highlight');
                    
                    const tooltip = document.createElement('div');
                    tooltip.className = 'correct-answer-tooltip';
                    tooltip.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 16px;">✓</span>
                            <span>Правильный ответ: ${escapeHtml(correctOption.textContent)}</span>
                        </div>
                    `;
                    tooltip.style.cssText = 'position: absolute; background: #4CAF50; color: white; padding: 6px 12px; border-radius: 8px; font-size: 12px; margin-top: 4px; z-index: 100; white-space: nowrap; left: 0; top: 100%;';
                    
                    const oldTooltip = wrapper.querySelector('.correct-answer-tooltip');
                    if (oldTooltip) oldTooltip.remove();
                    
                    wrapper.style.position = 'relative';
                    wrapper.appendChild(tooltip);
                    
                    setTimeout(() => {
                        if (tooltip.parentNode) tooltip.remove();
                        correctOption.classList.remove('correct-highlight');
                    }, 5000);
                }
            }
            setTimeout(() => btn.classList.remove('error-highlight'), 5000);
        }
    });
}

// Подсветка результатов для выбора правильного (choice) в упражнении
function highlightChoiceResults(card, results) {
    if (!results) return;
    
    const statementCards = card.querySelectorAll('.preview-statement-card');
    
    statementCards.forEach(statementCard => {
        const statementId = statementCard.dataset.statementId;
        const isCorrect = results[statementId];
        
        // Находим правильные ответы из data-атрибута
        let correctAnswers = [];
        try {
            const correctAnswersAttr = statementCard.getAttribute('data-correct-answers');
            if (correctAnswersAttr) {
                correctAnswers = JSON.parse(correctAnswersAttr);
                correctAnswers = correctAnswers.map(id => String(id));
            }
        } catch(e) {}
        
        if (isCorrect === true) {
            const selectedCheckboxes = statementCard.querySelectorAll('.checkbox-student.selected');
            selectedCheckboxes.forEach(cb => {
                cb.classList.add('success-highlight-temporary');
                setTimeout(() => cb.classList.remove('success-highlight-temporary'), 3000);
            });
        } else if (isCorrect === false) {
            const answersSection = statementCard.querySelector('.preview-answers-section');
            answersSection.classList.add('error-highlight');
            
            // Подсвечиваем правильные ответы зеленым
            const allAnswers = statementCard.querySelectorAll('.preview-answer-row');
            allAnswers.forEach(answerRow => {
                const answerId = String(answerRow.dataset.answerId);
                const checkbox = answerRow.querySelector('.checkbox-student');
                if (correctAnswers.includes(answerId) && checkbox) {
                    checkbox.classList.add('correct-highlight-temporary');
                    // Также показываем галочку
                    checkbox.classList.add('selected');
                    setTimeout(() => {
                        checkbox.classList.remove('correct-highlight-temporary');
                    }, 5000);
                }
            });
            setTimeout(() => answersSection.classList.remove('error-highlight'), 5000);
        }
    });
}

// Подсветка результатов для дополнения (fill_blanks) в упражнении
function highlightFillBlanksResults(card, results) {
    if (!results) return;
    
    const sentenceCards = card.querySelectorAll('.preview-sentence-card');
    
    sentenceCards.forEach(sentenceCard => {
        const sentenceId = sentenceCard.dataset.sentenceId;
        const sentenceResult = results[sentenceId];
        
        if (!sentenceResult || !sentenceResult.blanks) return;
        
        const blankWrappers = sentenceCard.querySelectorAll('.fillblanks-select-wrapper');
        blankWrappers.forEach((wrapper, idx) => {
            const btn = wrapper.querySelector('.fillblanks-select-btn');
            const isCorrect = sentenceResult.blanks[idx];
            
            // Находим правильный ответ из data-атрибута
            const correctAnswer = wrapper.dataset.correctAnswer;
            
            if (isCorrect === true) {
                btn.classList.add('success-highlight-temporary');
                setTimeout(() => btn.classList.remove('success-highlight-temporary'), 3000);
            } else if (isCorrect === false) {
                btn.classList.add('error-highlight');
                
                if (correctAnswer) {
                    const correctOption = wrapper.querySelector(`.fillblanks-select-option[data-value="${correctAnswer}"]`);
                    if (correctOption) {
                        correctOption.classList.add('correct-highlight');
                        
                        const tooltip = document.createElement('div');
                        tooltip.className = 'correct-answer-tooltip';
                        tooltip.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 16px;">✓</span>
                                <span>Правильный ответ: ${escapeHtml(correctAnswer)}</span>
                            </div>
                        `;
                        tooltip.style.cssText = 'position: absolute; background: #4CAF50; color: white; padding: 6px 12px; border-radius: 8px; font-size: 12px; margin-top: 4px; z-index: 100; white-space: nowrap; left: 0; top: 100%;';
                        
                        const oldTooltip = wrapper.querySelector('.correct-answer-tooltip');
                        if (oldTooltip) oldTooltip.remove();
                        
                        wrapper.style.position = 'relative';
                        wrapper.appendChild(tooltip);
                        
                        setTimeout(() => {
                            if (tooltip.parentNode) tooltip.remove();
                            correctOption.classList.remove('correct-highlight');
                        }, 5000);
                    }
                }
                setTimeout(() => btn.classList.remove('error-highlight'), 5000);
            }
        });
    });
}

// ===== ОБРАБОТЧИКИ СОБЫТИЙ =====

backButton.addEventListener('click', () => {
    window.location.href = `/teacher/course-preview?id=${courseId}`;
});

window.addEventListener('pagehide', () => {
    if (currentTestId && document.getElementById('testPreviewContainer').style.display === 'block') {
        saveTestState(currentTestId);
    }
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

// Получение правильных ответов для упражнения
function getCorrectAnswers(card, exerciseType) {
    const correctAnswers = {};
    
    if (exerciseType === 'matching') {
        // Для сопоставления - получаем пары из данных
        const matchingRows = card.querySelectorAll('.matching-row-preview');
        matchingRows.forEach(row => {
            const targetId = row.dataset.targetId;
            const correctOption = row.querySelector('.matching-correct-answer'); // Нужно добавить в разметку
            if (correctOption) {
                correctAnswers[targetId] = correctOption.dataset.value;
            }
        });
    } else if (exerciseType === 'choice') {
        // Для выбора правильного - получаем правильные ответы из атрибутов
        const statementCards = card.querySelectorAll('.preview-statement-card');
        statementCards.forEach(statementCard => {
            const statementId = statementCard.dataset.statementId;
            const correctAnswersList = [];
            const answers = statementCard.querySelectorAll('.preview-answer-row');
            answers.forEach(answer => {
                if (answer.classList.contains('correct-answer')) {
                    correctAnswersList.push(answer.dataset.answerId);
                }
            });
            if (correctAnswersList.length > 0) {
                correctAnswers[statementId] = correctAnswersList;
            }
        });
    } else if (exerciseType === 'fill_blanks') {
        // Для дополнения - получаем правильные слова из данных
        const sentenceCards = card.querySelectorAll('.preview-sentence-card');
        sentenceCards.forEach(sentenceCard => {
            const sentenceId = sentenceCard.dataset.sentenceId;
            const correctWords = [];
            const blanks = sentenceCard.querySelectorAll('.fillblanks-select-wrapper');
            blanks.forEach(blank => {
                const correctWord = blank.dataset.correctAnswer;
                if (correctWord) {
                    correctWords.push(correctWord);
                }
            });
            if (correctWords.length > 0) {
                correctAnswers[sentenceId] = correctWords;
            }
        });
    }
    
    return correctAnswers;
}

// ===== ФУНКЦИИ ДЛЯ ВЕРСИОНИРОВАНИЯ И СБРОСА =====

// Очистка localStorage для раздела
function clearSectionLocalStorage(sectionId, testId = null) {
  console.log(`[Reset] Clearing localStorage for section ${sectionId}`);
  
  // Очищаем ответы упражнений
  const matchingKey = `matching_answers_${sectionId}`;
  const choiceKey = `choice_answers_${sectionId}`;
  const fillblanksKey = `fillblanks_answers_${sectionId}`;
  
  localStorage.removeItem(matchingKey);
  localStorage.removeItem(choiceKey);
  localStorage.removeItem(fillblanksKey);
  
  // Если есть testId, очищаем данные теста
  if (testId) {
    const testStateKey = `test_state_${testId}`;
    const testTempKey = `test_state_${testId}_temp`;
    localStorage.removeItem(testStateKey);
    localStorage.removeItem(testTempKey);
    
    // Очищаем флаги полностью правильных упражнений
    const exerciseCards = document.querySelectorAll('.preview-test-exercise-card');
    exerciseCards.forEach(card => {
      const exerciseId = card.dataset.exerciseId;
      localStorage.removeItem(`exercise_fully_correct_${testId}_${exerciseId}`);
      localStorage.removeItem(`exercise_attempts_${testId}_${exerciseId}`);
      localStorage.removeItem(`exercise_result_${testId}_${exerciseId}`);
    });
  }
  
  // Сбрасываем глобальные переменные теста
  testAttemptsCount = 0;
  testAttemptsScores = [];
  
  console.log(`[Reset] LocalStorage cleared for section ${sectionId}`);
}

// Функция для отображения уведомления о сбросе
function showVersionResetNotification() {
  showNotification('Контент раздела был обновлён преподавателем. Ваш прогресс сброшен.', 'info');
}

function resetTestUI() {
  console.log('[resetTestUI] Resetting test UI (preserving scores)');
  
  // СБЕРЕГАЕМ максимальные баллы перед сбросом
  const totalMaxScoreElement = document.getElementById('totalTestMaxScore');
  let savedMaxScore = '0';
  if (totalMaxScoreElement) {
    savedMaxScore = totalMaxScoreElement.textContent;
  }
  
  // Сбрасываем только выбранные ответы (интерактивные элементы)
  const exerciseCards = document.querySelectorAll('#previewTestExercisesList .preview-test-exercise-card');
  console.log(`[resetTestUI] Found ${exerciseCards.length} exercise cards`);
  
  exerciseCards.forEach((card, idx) => {
    // Сбрасываем matching - только визуально, не трогаем сохранённые баллы
    const matchingBtns = card.querySelectorAll('.matching-select-btn');
    matchingBtns.forEach(btn => {
      const selectedSpan = btn.querySelector('.selected-text');
      if (selectedSpan && !btn.disabled) {
        selectedSpan.textContent = '-- выберите элемент --';
      }
      btn.classList.remove('error-highlight', 'success-highlight-temporary', 'active');
    });
    
    // Убираем выделение с опций matching (только у невыполненных)
    const matchingOptions = card.querySelectorAll('.matching-select-option');
    matchingOptions.forEach(opt => opt.classList.remove('selected'));
    
    // Сбрасываем choice (только у невыполненных)
    const checkboxes = card.querySelectorAll('.checkbox-student');
    checkboxes.forEach(checkbox => {
      if (!checkbox.classList.contains('success-highlight-permanent')) {
        checkbox.classList.remove('selected');
      }
    });
    
    // Сбрасываем fill_blanks (только у невыполненных)
    const fillBlanksBtns = card.querySelectorAll('.fillblanks-select-btn');
    fillBlanksBtns.forEach(btn => {
      const selectedSpan = btn.querySelector('.selected-text');
      if (selectedSpan && !btn.disabled) {
        selectedSpan.textContent = '-- выберите слово --';
      }
      btn.classList.remove('error-highlight', 'success-highlight-temporary', 'active');
    });
    
    // Убираем выделение с опций fill_blanks
    const fillBlanksOptions = card.querySelectorAll('.fillblanks-select-option');
    fillBlanksOptions.forEach(opt => opt.classList.remove('selected'));
    
    // НЕ СБРАСЫВАЕМ БАЛЛЫ! Они должны сохраниться после восстановления
    
    // Удаляем атрибут блокировки ТОЛЬКО если упражнение не было выполнено
    const testId = card.dataset.sectionId;
    const exerciseId = card.dataset.exerciseId;
    const isFullyCorrect = localStorage.getItem(`exercise_fully_correct_${testId}_${exerciseId}`) === 'true';
    if (!isFullyCorrect) {
      card.removeAttribute('data-locked');
    }
    card.classList.remove('test-card-error');
  });
  
  // ВОССТАНАВЛИВАЕМ максимальный балл
  if (totalMaxScoreElement) {
    totalMaxScoreElement.textContent = savedMaxScore;
  }
  
  console.log('[resetTestUI] UI reset complete (scores preserved)');
}

// Функция для полного сброса теста при изменении версии (СБРАСЫВАЕТ БАЛЛЫ!)
function resetTestUIWithScores() {
  console.log('[resetTestUIWithScores] FULL RESET WITH SCORES');
  
  // 1. Сбрасываем глобальные переменные
  testAttemptsCount = 0;
  testAttemptsScores = [];
  updateTestAttemptsDisplay();
  
  // 2. Сбрасываем отображение общих баллов
  const totalScoreElement = document.getElementById('totalTestScore');
  const totalMaxScoreElement = document.getElementById('totalTestMaxScore');
  if (totalScoreElement) totalScoreElement.textContent = '0';
  if (totalMaxScoreElement) totalMaxScoreElement.textContent = '0';
  
  // 3. Сбрасываем все карточки упражнений
  const exerciseCards = document.querySelectorAll('#previewTestExercisesList .preview-test-exercise-card');
  console.log(`[resetTestUIWithScores] Found ${exerciseCards.length} exercise cards`);
  
  exerciseCards.forEach((card, idx) => {
    // Сбрасываем баллы в карточках
    const scoreSpan = card.querySelector('.exercise-score-value');
    if (scoreSpan) {
      scoreSpan.textContent = '0';
      console.log(`[resetTestUIWithScores] Reset score for card ${idx}`);
    }
    
    // Сбрасываем matching - визуально
    const matchingBtns = card.querySelectorAll('.matching-select-btn');
    matchingBtns.forEach(btn => {
      const selectedSpan = btn.querySelector('.selected-text');
      if (selectedSpan) {
        selectedSpan.textContent = '-- выберите элемент --';
      }
      btn.classList.remove('error-highlight', 'success-highlight-temporary', 'active', 'success-highlight-permanent');
      btn.disabled = false;
      btn.style.cursor = 'pointer';
      btn.style.opacity = '1';
      const chevron = btn.querySelector('.select-chevron');
      if (chevron) chevron.style.display = 'block';
    });
    
    // Убираем выделение с опций matching
    const matchingOptions = card.querySelectorAll('.matching-select-option');
    matchingOptions.forEach(opt => opt.classList.remove('selected'));
    
    // Сбрасываем choice
    const checkboxes = card.querySelectorAll('.checkbox-student');
    checkboxes.forEach(checkbox => {
      checkbox.classList.remove('selected', 'success-highlight-permanent');
      checkbox.style.pointerEvents = 'auto';
      checkbox.style.opacity = '1';
    });
    
    // Сбрасываем fill_blanks
    const fillBlanksBtns = card.querySelectorAll('.fillblanks-select-btn');
    fillBlanksBtns.forEach(btn => {
      const selectedSpan = btn.querySelector('.selected-text');
      if (selectedSpan) {
        selectedSpan.textContent = '-- выберите слово --';
      }
      btn.classList.remove('error-highlight', 'success-highlight-temporary', 'active', 'success-highlight-permanent');
      btn.disabled = false;
      btn.style.cursor = 'pointer';
      btn.style.opacity = '1';
    });
    
    const fillBlanksOptions = card.querySelectorAll('.fillblanks-select-option');
    fillBlanksOptions.forEach(opt => opt.classList.remove('selected'));
    
    // Удаляем атрибут блокировки
    card.removeAttribute('data-locked');
    card.classList.remove('test-card-error');
  });
  
  console.log('[resetTestUIWithScores] FULL RESET complete');
}

// Полная очистка состояния теста перед загрузкой нового
function fullResetTestState(newTestId) {
  console.log(`[Full Reset] Clearing state for new test: ${newTestId}, old test: ${currentTestId}`);
  
  // 1. Сбрасываем глобальные переменные
  const oldTestId = currentTestId;
  testAttemptsCount = 0;
  testAttemptsScores = [];
  
  // 2. Очищаем все временные данные из localStorage для старого теста
  if (oldTestId && oldTestId !== newTestId) {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes(`test_state_${oldTestId}`) || 
                  key.includes(`exercise_fully_correct_${oldTestId}`) ||
                  key.includes(`exercise_attempts_${oldTestId}`) ||
                  key.includes(`exercise_result_${oldTestId}`))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => {
      console.log(`[Full Reset] Removing localStorage key: ${key}`);
      localStorage.removeItem(key);
    });
  }
  
  // 3. Обновляем currentTestId
  currentTestId = newTestId;
  
  // 4. Сбрасываем отображение баллов в DOM
  const totalScoreElement = document.getElementById('totalTestScore');
  const totalMaxScoreElement = document.getElementById('totalTestMaxScore');
  if (totalScoreElement) totalScoreElement.textContent = '0';
  if (totalMaxScoreElement) totalMaxScoreElement.textContent = '0';
  
  // 5. Очищаем все карточки упражнений, если они есть
  const exerciseCards = document.querySelectorAll('#previewTestExercisesList .preview-test-exercise-card');
  exerciseCards.forEach(card => {
    // Сбрасываем отображение баллов в карточках
    const scoreSpan = card.querySelector('.exercise-score-value');
    if (scoreSpan) scoreSpan.textContent = '0';
    
    // Удаляем атрибуты блокировки
    card.removeAttribute('data-locked');
    card.classList.remove('test-card-error');
  });
  
  console.log(`[Full Reset] Complete. New test ID: ${newTestId}`);
}

// ===== ИНИЦИАЛИЗАЦИЯ =====

initQuillPreview();
loadCourseData();

gsap.set('body', { opacity: 0 });
gsap.to('body', { opacity: 1, duration: 0.8, ease: 'power3.out' });
gsap.from('header', { y: -30, opacity: 0, duration: 0.8, delay: 0.2, ease: 'power3.out' });