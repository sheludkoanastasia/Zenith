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
const closeMenuBtn = document.getElementById('closeMenuBtn');

const editModal = document.getElementById('editModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const saveModalBtn = document.getElementById('saveModalBtn');

let currentEditingSection = null;

function getToken() {
    return localStorage.getItem('token');
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

function renderThemes(themes) {
    if (!themes || themes.length === 0) {
        themesListEl.innerHTML = '<p class="empty-message">Нет тем в этом курсе</p>';
        return;
    }

    themesListEl.innerHTML = themes.map(theme => `
        <div class="theme-item" data-theme-id="${theme.id}">
            <div class="theme-header">${escapeHtml(theme.title)}</div>
            <div class="blocks-list">
                ${theme.blocks && theme.blocks.length > 0 
                    ? theme.blocks.map(block => `
                        <div class="block-item ${blockId === block.id ? 'active' : ''}" 
                             data-block-id="${block.id}" 
                             data-block-title="${escapeHtml(block.title)}" 
                             data-block-description="${escapeHtml(block.description || '')}">
                            ${escapeHtml(block.title)}
                        </div>
                    `).join('')
                    : '<div class="empty-message">Нет блоков в этой теме</div>'
                }
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.block-item').forEach(blockEl => {
        blockEl.addEventListener('click', () => {
            const blockId = blockEl.dataset.blockId;
            const blockTitle = blockEl.dataset.blockTitle;
            const blockDescription = blockEl.dataset.blockDescription;
            
            document.querySelectorAll('.block-item').forEach(el => el.classList.remove('active'));
            blockEl.classList.add('active');
            
            const newUrl = `/teacher/course-constructor?courseId=${courseId}&blockId=${blockId}&themeId=${themeId}`;
            window.history.pushState({}, '', newUrl);
            
            loadBlockSections(blockId, blockTitle, blockDescription);
        });
    });
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
                showNotification(`Переход к разделу "${section.title}" (будет реализовано позже)`, 'info');
            }
        });
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
            body = { title, text: '', file_url: null };
            break;
        case 'exercise':
            url = `${apiBaseUrl}/sections/${currentEditingSection.id}/exercise`;
            body = { title, exercise_type: 'matching' };
            break;
        case 'test':
            url = `${apiBaseUrl}/sections/${currentEditingSection.id}/test`;
            body = { title, questions: [], passing_score: 70 };
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
            await loadBlockSections(currentBlock.id, currentBlock.title, currentBlock.description);
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
            await loadBlockSections(currentBlock.id, currentBlock.title, currentBlock.description);
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

showCreateMenuBtn.addEventListener('click', () => {
    createMenu.style.display = 'block';
});

closeMenuBtn.addEventListener('click', () => {
    createMenu.style.display = 'none';
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

document.addEventListener('click', (e) => {
    if (createMenu.style.display === 'block' && 
        !createMenu.contains(e.target) && 
        e.target !== showCreateMenuBtn) {
        createMenu.style.display = 'none';
    }
});

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

loadCourseData();