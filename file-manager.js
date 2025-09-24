/**
 * File Manager UI Component
 * Компонент для работы с файлами Google Drive
 */

class FileManager {
    constructor(auth, drive) {
        this.auth = auth;
        this.drive = drive;
        this.selectedFiles = [];
        this.currentFiles = [];
        
        // Callbacks
        this.onFilesSelected = null;
        this.onFileLoaded = null;
    }
    
    /**
     * Проверка авторизации
     */
    isAuthorized() {
        // Сначала проверяем глобальный AuthService
        if (window.authService && window.authService.isSignedIn()) {
            return true;
        }
        
        // Затем проверяем переданный auth (может быть AuthService)
        if (this.auth && this.auth.isSignedIn && this.auth.isSignedIn()) {
            return true;
        }
        
        // Проверяем старый формат auth
        if (this.auth && this.auth.isSignedIn && this.auth.accessToken) {
            return true;
        }
        
        return false;
    }

    /**
     * Показать модальное окно выбора файлов
     */
    async showFileSelector(options = {}) {
        try {
            console.log('📁 Открытие селектора файлов...');
            
            // Проверяем авторизацию
            if (!this.isAuthorized()) {
                console.error('❌ FileManager: Пользователь не авторизован');
                throw new Error('Пользователь не авторизован. Необходимо войти в Google.');
            }
            
            // Дополнительная проверка токена
            let hasValidToken = false;
            if (window.authService && window.authService.isSignedIn()) {
                const token = window.authService.getAccessToken();
                if (token) {
                    hasValidToken = true;
                    console.log('✅ FileManager: Токен найден в AuthService');
                } else {
                    console.error('❌ FileManager: AuthService.isSignedIn() = true, но токен отсутствует');
                }
            } else {
                console.error('❌ FileManager: AuthService не инициализирован или пользователь не авторизован');
            }
            
            if (!hasValidToken) {
                throw new Error('Токен доступа отсутствует. Перейдите на страницу инструкций для авторизации.');
            }
            
            console.log('✅ Авторизация подтверждена для FileManager');
            
            // Получаем список файлов
            const result = await this.drive.getFiles({
                mimeType: 'application/json',
                folderOnly: true,
                pageSize: options.pageSize || 50
            });

            if (!result.success) {
                throw new Error(result.error);
            }

            this.currentFiles = result.files;
            this.selectedFiles = [];
            
            // Показываем модальное окно
            this.renderFileSelectorModal(result.files, options);
            
        } catch (error) {
            console.error('❌ Ошибка открытия селектора файлов:', error);
            this.drive.showNotification('Ошибка загрузки файлов: ' + error.message, 'error');
        }
    }

    /**
     * Отрисовка модального окна селектора файлов
     */
    renderFileSelectorModal(files, options) {
        const modal = document.createElement('div');
        modal.id = 'file-selector-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const filesHtml = files.map(file => {
            const isSelected = this.selectedFiles.includes(file.id);
            const fileSize = file.size ? this.formatFileSize(file.size) : '';
            const modifiedDate = new Date(file.modifiedTime).toLocaleDateString('ru-RU');
            
            return `
                <div class="file-item ${isSelected ? 'selected' : ''}" 
                     data-file-id="${file.id}"
                     onclick="fileManager.toggleFileSelection('${file.id}')">
                    <div class="file-icon">
                        ${this.getFileIcon(file.mimeType)}
                    </div>
                    <div class="file-info">
                        <div class="file-name">${file.name}</div>
                        <div class="file-meta">
                            ${fileSize} • ${modifiedDate}
                        </div>
                    </div>
                    <div class="file-actions">
                        <button class="btn-load" 
                                onclick="event.stopPropagation(); fileManager.loadFile('${file.id}')"
                                title="Загрузить файл">
                            📥
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📁 Выберите файлы оценок</h3>
                    <button class="btn-close" onclick="fileManager.closeFileSelector()">❌</button>
                </div>
                
                <div class="modal-body">
                    ${files.length === 0 ? 
                        '<div class="empty-state">📭 Файлы не найдены</div>' :
                        `<div class="files-list">${filesHtml}</div>`
                    }
                </div>
                
                <div class="modal-footer">
                    <div class="selected-info">
                        Выбрано: <span id="selected-count">0</span> файлов
                    </div>
                    <div class="modal-actions">
                        <button class="btn-secondary" onclick="fileManager.closeFileSelector()">
                            Отмена
                        </button>
                        <button class="btn-primary" 
                                onclick="fileManager.confirmSelection()"
                                disabled>
                            Добавить выбранные
                        </button>
                    </div>
                </div>
            </div>
            
            <style>
                .modal-content {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    max-width: 600px;
                    width: 90%;
                    max-height: 80vh;
                    display: flex;
                    flex-direction: column;
                }
                
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px;
                    border-bottom: 1px solid #e2e8f0;
                }
                
                .modal-header h3 {
                    margin: 0;
                    color: #2d3748;
                }
                
                .btn-close {
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 5px;
                    border-radius: 4px;
                    transition: background 0.2s;
                }
                
                .btn-close:hover {
                    background: #f7fafc;
                }
                
                .modal-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                }
                
                .files-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                
                .file-item {
                    display: flex;
                    align-items: center;
                    padding: 15px;
                    border: 2px solid #e2e8f0;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    gap: 15px;
                }
                
                .file-item:hover {
                    border-color: #4299e1;
                    background: #f7fafc;
                }
                
                .file-item.selected {
                    border-color: #4299e1;
                    background: #ebf8ff;
                }
                
                .file-icon {
                    font-size: 24px;
                    width: 40px;
                    text-align: center;
                }
                
                .file-info {
                    flex: 1;
                }
                
                .file-name {
                    font-weight: 600;
                    color: #2d3748;
                    margin-bottom: 4px;
                }
                
                .file-meta {
                    font-size: 14px;
                    color: #718096;
                }
                
                .file-actions {
                    display: flex;
                    gap: 10px;
                }
                
                .btn-load {
                    background: #48bb78;
                    color: white;
                    border: none;
                    padding: 8px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background 0.2s;
                }
                
                .btn-load:hover {
                    background: #38a169;
                }
                
                .empty-state {
                    text-align: center;
                    padding: 40px;
                    color: #718096;
                    font-size: 16px;
                }
                
                .modal-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px;
                    border-top: 1px solid #e2e8f0;
                }
                
                .selected-info {
                    color: #4a5568;
                    font-size: 14px;
                }
                
                .modal-actions {
                    display: flex;
                    gap: 10px;
                }
                
                .btn-secondary, .btn-primary {
                    padding: 10px 20px;
                    border-radius: 6px;
                    border: none;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                
                .btn-secondary {
                    background: #e2e8f0;
                    color: #4a5568;
                }
                
                .btn-secondary:hover {
                    background: #cbd5e0;
                }
                
                .btn-primary {
                    background: #4299e1;
                    color: white;
                }
                
                .btn-primary:hover:not(:disabled) {
                    background: #3182ce;
                }
                
                .btn-primary:disabled {
                    background: #a0aec0;
                    cursor: not-allowed;
                }
            </style>
        `;

        document.body.appendChild(modal);
        
        // Обновляем счетчик выбранных файлов
        this.updateSelectedCount();
    }

    /**
     * Переключение выбора файла
     */
    toggleFileSelection(fileId) {
        const index = this.selectedFiles.indexOf(fileId);
        if (index > -1) {
            this.selectedFiles.splice(index, 1);
        } else {
            this.selectedFiles.push(fileId);
        }
        
        // Обновляем UI
        const fileItem = document.querySelector(`[data-file-id="${fileId}"]`);
        if (fileItem) {
            fileItem.classList.toggle('selected', this.selectedFiles.includes(fileId));
        }
        
        this.updateSelectedCount();
    }

    /**
     * Обновление счетчика выбранных файлов
     */
    updateSelectedCount() {
        const countElement = document.getElementById('selected-count');
        const confirmButton = document.querySelector('.btn-primary');
        
        if (countElement) {
            countElement.textContent = this.selectedFiles.length;
        }
        
        if (confirmButton) {
            confirmButton.disabled = this.selectedFiles.length === 0;
        }
    }

    /**
     * Подтверждение выбора файлов
     */
    confirmSelection() {
        if (this.selectedFiles.length === 0) return;
        
        const selectedFilesData = this.currentFiles.filter(file => 
            this.selectedFiles.includes(file.id)
        );
        
        if (this.onFilesSelected) {
            this.onFilesSelected(selectedFilesData);
        }
        
        this.closeFileSelector();
    }

    /**
     * Загрузка одного файла
     */
    async loadFile(fileId) {
        try {
            console.log('📥 Загрузка файла:', fileId);
            
            const result = await this.drive.downloadFile(fileId);
            if (!result.success) {
                throw new Error(result.error);
            }
            
            // Парсим JSON
            const data = JSON.parse(result.content);
            
            if (this.onFileLoaded) {
                this.onFileLoaded(data, fileId);
            }
            
            this.closeFileSelector();
            
        } catch (error) {
            console.error('❌ Ошибка загрузки файла:', error);
            this.drive.showNotification('Ошибка загрузки файла: ' + error.message, 'error');
        }
    }

    /**
     * Закрытие селектора файлов
     */
    closeFileSelector() {
        const modal = document.getElementById('file-selector-modal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Получение иконки файла
     */
    getFileIcon(mimeType) {
        if (mimeType === 'application/json') {
            return '📄';
        } else if (mimeType.includes('text/')) {
            return '📝';
        } else if (mimeType.includes('image/')) {
            return '🖼️';
        } else if (mimeType.includes('video/')) {
            return '🎥';
        } else if (mimeType.includes('audio/')) {
            return '🎵';
        } else {
            return '📎';
        }
    }

    /**
     * Форматирование размера файла
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileManager;
} else {
    window.FileManager = FileManager;
}
