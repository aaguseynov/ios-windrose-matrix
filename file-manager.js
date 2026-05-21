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
        // Проверяем глобальный AuthService
        if (window.authService && window.authService.isSignedIn()) {
            return true;
        }
        
        // Проверяем переданный auth (может быть AuthService)
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
     * ID общей папки Google Drive (config.folderId, не config.drive.folderId)
     */
    getFolderId() {
        const config = window.config || globalThis.config;
        return config?.folderId || config?.drive?.folderId || this.drive?.folderId || null;
    }

    /**
     * Проверка готовности FileManager и GoogleDrive к работе
     */
    diagnoseConflicts() {
        console.log('🔍 Проверка FileManager и GoogleDrive...');
        
        if (!this.drive) {
            console.error('❌ GoogleDrive не инициализирован');
            return false;
        }
        
        const requiredMethods = ['getFiles', 'downloadFile', 'getFileInfo', 'getFilesFromFolder', 'showNotification'];
        const missingMethods = requiredMethods.filter(method => typeof this.drive[method] !== 'function');
        
        if (missingMethods.length > 0) {
            console.error('❌ Отсутствуют методы GoogleDrive:', missingMethods);
            return false;
        }
        
        const folderId = this.getFolderId();
        if (!folderId) {
            console.error('❌ ID папки Google Drive не найден (ожидается config.folderId)');
            return false;
        }
        
        console.log('✅ GoogleDrive готов, папка:', folderId);
        return true;
    }

    /**
     * Показать модальное окно выбора файлов
     */
    async showFileSelector(options = {}) {
        try {
            console.log('📁 Открытие селектора файлов...');
            
            if (!this.diagnoseConflicts()) {
                throw new Error('Система Google Drive не настроена. Проверьте config.folderId и авторизацию.');
            }
            
            // Проверяем авторизацию
            if (!this.isAuthorized()) {
                console.error('❌ FileManager: Пользователь не авторизован');
                throw new Error('Пользователь не авторизован. Необходимо войти в Google для работы с файлами.');
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
            
            // Получаем список JSON файлов по всему Google Drive
            console.log('📁 FileManager: запрос файлов с параметрами:', {
                mimeType: 'application/json',
                folderOnly: false, // Ищем по всему Drive
                pageSize: options.pageSize || 50
            });
            
            // Стратегия 1: Ищем файлы в общей папке (приоритет)
            console.log('🔍 Стратегия 1: Поиск в общей папке...');
            console.log('📁 ID папки из конфигурации:', this.getFolderId());
            let result = await this.drive.getFiles({
                mimeType: 'application/json',
                folderOnly: true, // Ищем в конкретной папке
                filterByPrefix: true, // Фильтруем по префиксу
                pageSize: options.pageSize || 50
            });
            
            console.log('📊 Результат поиска в папке:', result.success ? `Найдено ${result.files.length} файлов` : `Ошибка: ${result.error}`);

            // Стратегия 2: Если файлы не найдены в папке, ищем все JSON файлы в папке
            if (result.success && result.files.length === 0) {
                console.log('🔍 Стратегия 2: Поиск всех JSON файлов в папке...');
                result = await this.drive.getFiles({
                    mimeType: 'application/json',
                    folderOnly: true, // Ищем в конкретной папке
                    filterByPrefix: false, // Без фильтра по префиксу
                    pageSize: options.pageSize || 50
                });
            }

            // Стратегия 3: Если все еще не найдены, ищем по всему Google Drive
            if (result.success && result.files.length === 0) {
                console.log('🔍 Стратегия 3: Поиск по всему Google Drive...');
                result = await this.drive.getFiles({
                    mimeType: 'application/json',
                    folderOnly: false, // Ищем по всему Google Drive
                    filterByPrefix: true, // С фильтром по префиксу
                    pageSize: options.pageSize || 50
                });
                
                console.log('📊 Результат поиска по всему Drive:', result.success ? `Найдено ${result.files.length} файлов` : `Ошибка: ${result.error}`);
                
                // Диагностика найденных файлов
                if (result.success && result.files.length > 0) {
                    console.log('🔍 Найденные файлы по всему Drive:');
                    result.files.forEach((file, index) => {
                        console.log(`  ${index + 1}. ${file.name}`);
                        console.log(`     - ID: ${file.id}`);
                        console.log(`     - Владелец: ${file.owners ? file.owners[0]?.displayName || 'неизвестно' : 'неизвестно'}`);
                        console.log(`     - Общий доступ: ${file.shared ? 'да' : 'нет'}`);
                        console.log(`     - Родительская папка: ${file.parents ? file.parents.join(', ') : 'неизвестно'}`);
                        console.log(`     - Последний редактор: ${file.lastModifyingUser ? file.lastModifyingUser.displayName || 'неизвестно' : 'неизвестно'}`);
                        console.log(`     - Описание: ${file.description || 'нет'}`);
                        console.log(`     - Ссылка для просмотра: ${file.webViewLink || 'нет'}`);
                        
                        // Информация о правах доступа
                        if (file.capabilities) {
                            console.log(`     - Права доступа:`);
                            console.log(`       - Может читать: ${file.capabilities.canRead || false}`);
                            console.log(`       - Может редактировать: ${file.capabilities.canEdit || false}`);
                            console.log(`       - Может удалять: ${file.capabilities.canDelete || false}`);
                            console.log(`       - Может делиться: ${file.capabilities.canShare || false}`);
                        }
                        
                        // Информация о разрешениях
                        if (file.permissions && file.permissions.length > 0) {
                            console.log(`     - Разрешения (${file.permissions.length}):`);
                            file.permissions.forEach((permission, permIndex) => {
                                console.log(`       ${permIndex + 1}. ${permission.role} - ${permission.type} (${permission.displayName || 'неизвестно'})`);
                            });
                        }
                    });
                }
            }

            // Стратегия 4: Поиск всех JSON файлов по всему Google Drive
            if (result.success && result.files.length === 0) {
                console.log('🔍 Стратегия 4: Поиск всех JSON файлов по всему Google Drive...');
                result = await this.drive.getFiles({
                    mimeType: 'application/json',
                    folderOnly: false,
                    filterByPrefix: false,
                    pageSize: options.pageSize || 50
                });
            }

            // Стратегия 5: Поиск файлов с общим доступом
            if (result.success && result.files.length === 0) {
                console.log('🔍 Стратегия 5: Поиск файлов с общим доступом...');
                result = await this.drive.getFiles({
                    mimeType: 'application/json',
                    folderOnly: false,
                    filterByPrefix: false,
                    includeShared: true, // Включаем общие файлы
                    pageSize: options.pageSize || 50
                });
            }

            // Стратегия 6: Прямой поиск в папке по ID
            if (result.success && result.files.length === 0) {
                console.log('🔍 Стратегия 6: Прямой поиск в папке по ID...');
                try {
                    // Пробуем получить файлы напрямую из папки
                    const folderResult = await this.drive.getFilesFromFolder();
                    if (folderResult.success && folderResult.files.length > 0) {
                        console.log(`📁 Найдено ${folderResult.files.length} файлов в папке`);
                        result = folderResult;
                    }
                } catch (error) {
                    console.log('⚠️ Ошибка при прямом поиске в папке:', error.message);
                }
            }

            if (!result.success) {
                throw new Error(result.error);
            }

            this.currentFiles = result.files;
            this.selectedFiles = [];
            
            console.log(`📁 Найдено файлов: ${result.files.length}`);
            
            // Дополнительная диагностика файлов
            if (result.files.length > 0) {
                console.log('📋 Информация о найденных файлах:');
                result.files.forEach((file, index) => {
                    console.log(`  ${index + 1}. ${file.name}`);
                    console.log(`     - ID: ${file.id}`);
                    console.log(`     - Размер: ${file.size ? this.formatFileSize(file.size) : 'неизвестно'}`);
                    console.log(`     - Владелец: ${file.owners ? file.owners[0]?.displayName || 'неизвестно' : 'неизвестно'}`);
                    console.log(`     - Общий доступ: ${file.shared ? 'да' : 'нет'}`);
                    console.log(`     - Изменен: ${file.modifiedTime ? new Date(file.modifiedTime).toLocaleString('ru-RU') : 'неизвестно'}`);
                });
            } else {
                console.log('❌ Файлы не найдены. Возможные причины:');
                console.log('   - Файлы принадлежат другому пользователю');
                console.log('   - Нет прав доступа к файлам');
                console.log('   - Файлы находятся в другой папке');
                console.log('   - Неправильный тип файла или имя');
            }
            
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
            
            // Определяем тип файла по имени
            const isEvaluationFile = file.name.includes('ios-windrose-evaluation') || file.name.includes('evaluation');
            const fileTypeIndicator = isEvaluationFile ? '📊' : '📄';
            
            // Информация о владельце
            const ownerInfo = file.owners && file.owners[0] ? 
                `${file.owners[0].displayName || 'Неизвестно'}` : 
                'Неизвестно';
            
            
            return `
                <div class="file-item ${isSelected ? 'selected' : ''}" 
                     data-file-id="${file.id}"
                     onclick="fileManager.toggleFileSelection('${file.id}')">
                    <div class="file-icon">
                        ${fileTypeIndicator}
                    </div>
                    <div class="file-info">
                        <div class="file-name">${file.name}</div>
                        <div class="file-meta">
                            ${fileSize} • ${modifiedDate} ${isEvaluationFile ? '• Файл оценки' : ''}
                            <br><small style="color: #666;">Владелец: ${ownerInfo} ${file.shared ? '• Общий доступ' : ''}</small>
                        </div>
                    </div>
                    <div class="file-actions">
                        <button class="btn-preview" 
                                onclick="event.stopPropagation(); fileManager.previewFile('${file.id}')"
                                title="Предварительный просмотр">
                            👁️
                        </button>
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
                    <h3>📁 Выберите файл оценки</h3>
                    <p style="margin: 5px 0; color: #666; font-size: 14px;">Найдено файлов: ${files.length}. Выберите один JSON файл для загрузки данных</p>
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
                        Выбран: <span id="selected-count">0</span> файл
                    </div>
                    <div class="modal-actions">
                        <button class="btn-secondary" onclick="fileManager.closeFileSelector()">
                            Отмена
                        </button>
                        <button class="btn-primary" 
                                onclick="fileManager.confirmSelection()"
                                disabled>
                            📥 Загрузить выбранный файл
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
                
                .btn-preview {
                    background: #4299e1;
                    color: white;
                    border: none;
                    padding: 8px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background 0.2s;
                }
                
                .btn-preview:hover {
                    background: #3182ce;
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
     * Переключение выбора файла (только один файл)
     */
    toggleFileSelection(fileId) {
        // Очищаем предыдущий выбор
        this.selectedFiles = [];
        
        // Снимаем выделение со всех файлов
        document.querySelectorAll('.file-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Выбираем новый файл
        this.selectedFiles.push(fileId);
        
        // Обновляем UI
        const fileItem = document.querySelector(`[data-file-id="${fileId}"]`);
        if (fileItem) {
            fileItem.classList.add('selected');
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
     * Подтверждение выбора файлов - загружает выбранный файл
     */
    async confirmSelection() {
        if (this.selectedFiles.length === 0) {
            console.warn('⚠️ Нет выбранных файлов для загрузки');
            return;
        }
        
        // Берем первый выбранный файл (так как разрешен выбор только одного файла)
        const fileId = this.selectedFiles[0];
        console.log('📥 Загружаем выбранный файл:', fileId);
        
        try {
            // Закрываем модальное окно выбора
            this.closeFileSelector();
            
            // Загружаем файл
            await this.loadFile(fileId);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки выбранного файла:', error);
            this.drive.showNotification('Ошибка загрузки файла: ' + error.message, 'error');
        }
    }

    /**
     * Загрузка одного файла
     */
    async loadFile(fileId) {
        try {
            console.log('📥 Загрузка файла:', fileId);
            
            // Сначала получаем информацию о файле для проверки размера
            const fileInfo = await this.drive.getFileInfo(fileId);
            if (fileInfo.success) {
                const fileSize = fileInfo.file.size;
                const config = window.config || globalThis.config;
                const maxSize = config?.drive?.maxFileSize;
                
                console.log(`📊 Размер файла: ${this.formatFileSize(fileSize)}, Максимум: ${this.formatFileSize(maxSize)}`);
                
                if (fileSize > maxSize) {
                    throw new Error(`Файл слишком большой: ${this.formatFileSize(fileSize)}. Максимальный размер: ${this.formatFileSize(maxSize)}`);
                }
            }
            
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
     * Предварительный просмотр файла
     */
    async previewFile(fileId) {
        try {
            console.log('👁️ Предварительный просмотр файла:', fileId);
            
            // Показываем индикатор загрузки
            this.drive.showNotification('Загружаем файл для просмотра...', 'info');
            
            // Скачиваем файл
            const result = await this.drive.downloadFile(fileId);
            
            // Парсим JSON
            const data = JSON.parse(result.content);
            console.log('📄 Данные из файла после парсинга:', data);
            console.log('📄 Структура competencies:', data.competencies);
            
            // Показываем модальное окно с предварительным просмотром
            this.showPreviewModal(data, fileId);
            
        } catch (error) {
            console.error('❌ Ошибка предварительного просмотра:', error);
            this.drive.showNotification('Ошибка предварительного просмотра: ' + error.message, 'error');
        }
    }

    /**
     * Показ модального окна с предварительным просмотром
     */
    showPreviewModal(data, fileId) {
        // Создаем модальное окно
        const modal = document.createElement('div');
        modal.id = 'preview-modal';
        modal.className = 'modal';
        
        // Форматируем JSON для отображения
        const formattedJson = JSON.stringify(data, null, 2);
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px; max-height: 80vh;">
                <div class="modal-header">
                    <h3>👁️ Предварительный просмотр файла</h3>
                    <button class="btn-close" onclick="fileManager.closePreviewModal()">❌</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 15px;">
                        <strong>Разработчик:</strong> ${data.developer || 'Не указан'}<br>
                        <strong>Дата:</strong> ${data.date ? new Date(data.date).toLocaleDateString('ru-RU') : 'Не указана'}<br>
                        <strong>Статус:</strong> ${data.status || 'Не указан'}
                    </div>
                    <div style="margin-bottom: 15px;">
                        <h4>Компетенции:</h4>
                        <div id="competencies-preview" style="max-height: 300px; overflow-y: auto; background: #f8f9fa; padding: 10px; border-radius: 6px; font-family: monospace; font-size: 12px;">
                            ${this.formatCompetenciesForPreview(data.competencies)}
                        </div>
                    </div>
                    <details>
                        <summary style="cursor: pointer; font-weight: bold; margin-bottom: 10px;">📄 Полный JSON</summary>
                        <pre style="background: #f8f9fa; padding: 15px; border-radius: 6px; overflow-x: auto; font-size: 11px; max-height: 300px; overflow-y: auto;">${formattedJson}</pre>
                    </details>
                </div>
                <div class="modal-footer">
                    <div></div>
                    <div class="modal-actions">
                        <button class="btn-secondary" onclick="fileManager.closePreviewModal()">Закрыть</button>
                        <button class="btn-primary" onclick="fileManager.loadFileFromPreview('${fileId}')">📥 Загрузить файл</button>
                    </div>
                </div>
            </div>
        `;
        
        // Добавляем стили для модального окна
        const style = document.createElement('style');
        style.textContent = `
            .modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            }
            
            .modal-content {
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
                display: flex;
                flex-direction: column;
                max-width: 90vw;
                max-height: 90vh;
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
            
            .modal-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-top: 1px solid #e2e8f0;
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
                font-size: 14px;
                transition: background 0.2s;
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
            
            .btn-primary:hover {
                background: #3182ce;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(modal);
    }

    /**
     * Форматирование компетенций для предварительного просмотра
     */
    formatCompetenciesForPreview(competencies) {
        console.log('🔍 formatCompetenciesForPreview получил данные:', competencies);
        
        if (!competencies) return 'Нет данных о компетенциях';
        
        let html = '';
        Object.keys(competencies).forEach(compKey => {
            const comp = competencies[compKey];
            console.log(`🔍 Обрабатываем компетенцию ${compKey}:`, comp);
            
            html += `<div style="margin-bottom: 10px;"><strong>${comp.name || compKey}:</strong><br>`;
            
            // Проверяем разные возможные структуры данных
            if (comp.levels) {
                console.log(`🔍 У компетенции ${compKey} есть levels:`, comp.levels);
                Object.keys(comp.levels).forEach(levelKey => {
                    const level = comp.levels[levelKey];
                    console.log(`🔍 Уровень ${levelKey}:`, level);
                    html += `  ${levelKey}: самооценка=${level.selfEvaluation || 0}, менеджер=${level.managerEvaluation || 0}`;
                    if (level.comments) {
                        html += `, комментарии="${level.comments}"`;
                    }
                    html += '<br>';
                });
            } else {
                // Возможно, данные в другом формате - попробуем обработать напрямую
                console.log(`🔍 У компетенции ${compKey} нет levels, проверяем прямые свойства:`, comp);
                Object.keys(comp).forEach(levelKey => {
                    if (levelKey !== 'name' && typeof comp[levelKey] === 'object') {
                        const level = comp[levelKey];
                        console.log(`🔍 Прямое свойство ${levelKey}:`, level);
                        html += `  ${levelKey}: самооценка=${level.selfEvaluation || 0}, менеджер=${level.managerEvaluation || 0}`;
                        if (level.comments) {
                            html += `, комментарии="${level.comments}"`;
                        }
                        html += '<br>';
                    }
                });
            }
            html += '</div>';
        });
        
        const result = html || 'Нет данных о компетенциях';
        console.log('🔍 Результат formatCompetenciesForPreview:', result);
        return result;
    }

    /**
     * Загрузка файла из предварительного просмотра
     */
    async loadFileFromPreview(fileId) {
        console.log('📥 Загружаем файл из предварительного просмотра:', fileId);
        this.closePreviewModal();
        await this.loadFile(fileId);
    }

    /**
     * Закрытие модального окна предварительного просмотра
     */
    closePreviewModal() {
        const modal = document.getElementById('preview-modal');
        if (modal) {
            modal.remove();
        }
        
        // Удаляем добавленные стили
        const style = document.querySelector('style');
        if (style && style.textContent.includes('.modal {')) {
            style.remove();
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
