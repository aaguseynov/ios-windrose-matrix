/**
 * Google Drive API Operations Module
 * 
 * Настройка:
 * 1. Убедитесь, что Google Drive API включен в Google Cloud Console
 * 2. Установите правильные настройки в config.js
 * 3. Папка для сохранения файлов должна быть доступна для записи
 */

class GoogleDrive {
    constructor(config, auth) {
        this.auth = auth;
        this.folderId = config.folderId;
        this.folderUrl = config.folderUrl;
        this.filePrefix = config.filePrefix || 'evaluation';
        
        // Отладочная информация
        console.log('🔧 GoogleDrive инициализирован:', {
            folderId: this.folderId,
            folderUrl: this.folderUrl,
            filePrefix: this.filePrefix
        });
        
        // Callbacks
        this.onFilesLoaded = null;
        this.onFileUploaded = null;
        this.onError = null;
    }

    /**
     * Получение токена доступа
     */
    async getAccessToken() {
        try {
            console.log('🔍 Поиск токена доступа...');
            
            // Сначала пытаемся получить токен из глобального AuthService
            if (window.authService && window.authService.isSignedIn()) {
                const token = window.authService.getAccessToken();
                if (token) {
                    console.log('✅ Токен получен из глобального AuthService');
                    return token;
                } else {
                    console.log('⚠️ AuthService.isSignedIn() = true, но токен отсутствует');
                }
            } else {
                console.log('⚠️ AuthService не инициализирован или пользователь не авторизован');
            }
            
            // Затем пытаемся получить токен из переданного auth (может быть AuthService)
            if (this.auth) {
                if (this.auth.isSignedIn && typeof this.auth.isSignedIn === 'function') {
                    // Это AuthService
                    if (this.auth.isSignedIn()) {
                        const token = this.auth.getAccessToken();
                        if (token) {
                            console.log('✅ Токен получен из переданного AuthService');
                            return token;
                        }
                    }
                } else if (this.auth.accessToken) {
                    // Это старый формат auth
                    console.log('✅ Токен получен из переданного auth (старый формат)');
                    return this.auth.accessToken;
                }
            }
            
            // Если пользователь авторизован, но токена нет, пытаемся получить новый токен
            if (window.authService && window.authService.isSignedIn()) {
                console.log('🔄 Пользователь авторизован, но токен отсутствует. Пытаемся получить новый токен...');
                
                try {
                    // Пытаемся получить токен через Google Identity Services
                    const tokenClient = window.google.accounts.oauth2.initTokenClient({
                        client_id: window.authService.auth.clientId,
                        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
                        callback: (response) => {
                            if (response.access_token) {
                                console.log('✅ Новый токен получен через Google Identity Services');
                                // Обновляем токен в AuthService
                                if (window.authService.auth) {
                                    window.authService.auth.accessToken = response.access_token;
                                    window.authService.auth.saveAuthState();
                                }
                                return response.access_token;
                            }
                        }
                    });
                    
                    tokenClient.requestAccessToken();
                    
                    // Ждем получения токена
                    return new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            reject(new Error('Таймаут получения токена'));
                        }, 10000);
                        
                        const checkToken = () => {
                            if (window.authService.auth && window.authService.auth.accessToken) {
                                clearTimeout(timeout);
                                resolve(window.authService.auth.accessToken);
                            } else {
                                setTimeout(checkToken, 100);
                            }
                        };
                        checkToken();
                    });
                    
                } catch (error) {
                    console.error('❌ Ошибка получения нового токена:', error);
                }
            }
            
            console.error('❌ Токен доступа не найден. Пользователь должен авторизоваться через instructions.html');
            throw new Error('Пользователь не авторизован. Перейдите на страницу инструкций для авторизации.');
            
        } catch (error) {
            console.error('❌ Ошибка получения токена:', error);
            throw error;
        }
    }

    /**
     * Получение списка файлов из Google Drive
     */
    async getFiles(options = {}) {
        try {
            console.log('📁 Получение списка файлов...');
            this.showLoadingIndicator('Загрузка файлов...');

            const accessToken = await this.getAccessToken();
            
            // Параметры запроса
            const params = new URLSearchParams({
                pageSize: options.pageSize || 100,
                fields: 'files(id,name,mimeType,createdTime,modifiedTime,size,iconLink,trashed,owners,shared,parents,permissions,capabilities,lastModifyingUser,webViewLink,description)',
                orderBy: 'modifiedTime desc'
            });

            // Если указана папка, ищем файлы только в ней
            console.log('🔍 Поиск файлов:', {
                folderId: this.folderId,
                folderOnly: options.folderOnly,
                mimeType: options.mimeType
            });
            
            if (this.folderId && options.folderOnly !== false) {
                const query = `'${this.folderId}' in parents`;
                params.append('q', query);
                console.log('📁 Поиск в папке:', query);
                console.log('🔧 folderId:', this.folderId);
            } else {
                console.log('🌐 Поиск во всем Drive');
                console.log('🔧 Причина:', {
                    hasFolderId: !!this.folderId,
                    folderOnly: options.folderOnly,
                    folderId: this.folderId
                });
            }

            // Если указан тип файлов
            if (options.mimeType) {
                const q = params.get('q') || '';
                params.set('q', q ? `${q} and mimeType='${options.mimeType}'` : `mimeType='${options.mimeType}'`);
            }
            
            // Включаем общие файлы (если указано)
            if (options.includeShared) {
                const q = params.get('q') || '';
                const sharedFilter = 'sharedWithMe=true';
                params.set('q', q ? `${q} and ${sharedFilter}` : sharedFilter);
                console.log('🔍 Включаем общие файлы:', sharedFilter);
            }
            
            // Фильтруем файлы оценок по имени (если указан префикс)
            if (this.filePrefix && options.filterByPrefix !== false) {
                const q = params.get('q') || '';
                const nameFilter = `name contains '${this.filePrefix}'`;
                params.set('q', q ? `${q} and ${nameFilter}` : nameFilter);
                console.log('🔍 Фильтр по имени файла:', nameFilter);
            }
            
            // Поиск по имени файла (если указан)
            if (options.searchByName) {
                const q = params.get('q') || '';
                const nameSearch = `name contains '${options.searchByName}'`;
                params.set('q', q ? `${q} and ${nameSearch}` : nameSearch);
                console.log('🔍 Поиск по имени файла:', nameSearch);
            }
            
            // Исключаем удаленные файлы (файлы в корзине)
            const currentQ = params.get('q') || '';
            const excludeTrashed = 'trashed=false';
            params.set('q', currentQ ? `${currentQ} and ${excludeTrashed}` : excludeTrashed);
            console.log('🗑️ Исключаем удаленные файлы:', excludeTrashed);

            const finalUrl = `https://www.googleapis.com/drive/v3/files?${params}`;
            console.log('🌐 Финальный запрос к API:', finalUrl);
            console.log('📋 Параметры запроса:', params.toString());
            
            const response = await fetch(finalUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Ошибка получения файлов: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ Найдено файлов: ${data.files.length}`);
            
            // Дополнительная фильтрация: исключаем удаленные файлы на уровне JavaScript
            const activeFiles = data.files.filter(file => !file.trashed);
            console.log(`🗑️ После исключения удаленных файлов: ${activeFiles.length} активных файлов`);
            
            // Если есть удаленные файлы, показываем информацию о них
            if (activeFiles.length < data.files.length) {
                const trashedCount = data.files.length - activeFiles.length;
                console.log(`⚠️ Найдено ${trashedCount} удаленных файлов, исключены из результатов`);
                
                // Показываем информацию об удаленных файлах
                const trashedFiles = data.files.filter(file => file.trashed);
                trashedFiles.forEach(file => {
                    console.log(`  🗑️ Удаленный файл: ${file.name} (ID: ${file.id})`);
                });
            }
            
            // Заменяем список файлов на активные
            data.files = activeFiles;
            
            this.hideLoadingIndicator();
            
            if (this.onFilesLoaded) {
                this.onFilesLoaded(data.files);
            }

            return { success: true, files: data.files };
        } catch (error) {
            console.error('❌ Ошибка получения файлов:', error);
            this.hideLoadingIndicator();
            this.handleError(error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Загрузка файла в Google Drive
     */
    async uploadFile(fileContent, filename, options = {}) {
        try {
            console.log('📤 Загрузка файла:', filename);
            this.showLoadingIndicator('Сохранение файла...');

            // Проверяем размер файла перед загрузкой
            const fileSize = new Blob([fileContent]).size;
            const maxSize = config.drive.maxFileSize;
            
            console.log(`📊 Размер файла: ${this.formatFileSize(fileSize)}, Максимум: ${this.formatFileSize(maxSize)}`);
            
            if (fileSize > maxSize) {
                throw new Error(`Файл слишком большой: ${this.formatFileSize(fileSize)}. Максимальный размер: ${this.formatFileSize(maxSize)}`);
            }

            const accessToken = await this.getAccessToken();
            
            // Проверяем, существует ли файл с таким же именем, и удаляем его
            try {
                const existingFiles = await this.getFiles({ name: filename });
                if (existingFiles.success && existingFiles.files.length > 0) {
                    console.log('🔄 Найден существующий файл, удаляем его перед загрузкой нового:', filename);
                    for (const file of existingFiles.files) {
                        await this.deleteFile(file.id);
                        console.log('🗑️ Удален существующий файл:', file.id);
                    }
                }
            } catch (error) {
                console.warn('⚠️ Ошибка при проверке существующих файлов:', error.message);
                // Продолжаем загрузку даже если не удалось проверить существующие файлы
            }
            
            // Создаем метаданные файла
            const metadata = {
                name: filename,
                parents: options.parents || (this.folderId ? [this.folderId] : [])
            };

            // Определяем тип контента
            const contentType = options.contentType || 'application/json';
            
            // Создаем FormData для multipart upload
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            
            // Для изображений используем base64, для JSON - обычный текст
            if (contentType.startsWith('image/')) {
                // Для изображений конвертируем base64 в blob
                const byteCharacters = atob(fileContent);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                form.append('file', new Blob([byteArray], { type: contentType }));
            } else {
                form.append('file', new Blob([fileContent], { type: contentType }));
            }

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
                body: form
            });

            if (!response.ok) {
                throw new Error(`Ошибка загрузки файла: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('✅ Файл успешно загружен:', result.id);
            
            this.hideLoadingIndicator();
            
            if (this.onFileUploaded) {
                this.onFileUploaded(result);
            }

            return { success: true, fileId: result.id, filename: filename };
        } catch (error) {
            console.error('❌ Ошибка загрузки файла:', error);
            this.hideLoadingIndicator();
            this.handleError(error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Скачивание файла из Google Drive
     */
    async downloadFile(fileId) {
        try {
            console.log('📥 Скачивание файла:', fileId);
            this.showLoadingIndicator('Загрузка файла...');

            const accessToken = await this.getAccessToken();

            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Ошибка скачивания файла: ${response.status} ${response.statusText}`);
            }

            const content = await response.text();
            console.log('✅ Файл успешно скачан');
            
            this.hideLoadingIndicator();
            
            return { success: true, content: content };
        } catch (error) {
            console.error('❌ Ошибка скачивания файла:', error);
            this.hideLoadingIndicator();
            this.handleError(error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Получение информации о файле
     */
    async getFileInfo(fileId) {
        try {
            const accessToken = await this.getAccessToken();

            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,createdTime,modifiedTime,size`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Ошибка получения информации о файле: ${response.status} ${response.statusText}`);
            }

            const fileInfo = await response.json();
            return { success: true, file: fileInfo };
        } catch (error) {
            console.error('❌ Ошибка получения информации о файле:', error);
            this.handleError(error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Создание папки
     */
    async createFolder(name, parentId = null) {
        try {
            console.log('📁 Создание папки:', name);

            const accessToken = await this.getAccessToken();
            
            const metadata = {
                name: name,
                mimeType: 'application/vnd.google-apps.folder',
                parents: parentId ? [parentId] : (this.folderId ? [this.folderId] : [])
            };

            const response = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(metadata)
            });

            if (!response.ok) {
                throw new Error(`Ошибка создания папки: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('✅ Папка создана:', result.id);
            
            return { success: true, folderId: result.id };
        } catch (error) {
            console.error('❌ Ошибка создания папки:', error);
            this.handleError(error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Удаление файла
     */
    async deleteFile(fileId) {
        try {
            console.log('🗑️ Удаление файла:', fileId);

            const accessToken = await this.getAccessToken();

            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Ошибка удаления файла: ${response.status} ${response.statusText}`);
            }

            console.log('✅ Файл удален');
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка удаления файла:', error);
            this.handleError(error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Показать индикатор загрузки
     */
    showLoadingIndicator(message = 'Загрузка...') {
        let loader = document.getElementById('drive-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'drive-loader';
            loader.style.cssText = `
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
            
            loader.innerHTML = `
                <div style="background: white; padding: 30px; border-radius: 12px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                    <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #4285f4; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                    <p style="margin: 0; color: #333; font-size: 16px;">${message}</p>
                </div>
            `;
            
            document.body.appendChild(loader);
        }
    }

    /**
     * Скрыть индикатор загрузки
     */
    hideLoadingIndicator() {
        const loader = document.getElementById('drive-loader');
        if (loader) {
            loader.remove();
        }
    }

    /**
     * Обработка ошибок
     */
    handleError(error) {
        let message = 'Произошла ошибка';
        
        if (error.message.includes('401')) {
            message = 'Ошибка авторизации. Попробуйте войти в Google снова';
        } else if (error.message.includes('403')) {
            message = 'Доступ запрещен. Проверьте права доступа к файлам';
        } else if (error.message.includes('404')) {
            message = 'Файл не найден';
        } else {
            message = error.message || message;
        }

        if (this.onError) {
            this.onError(message);
        }
    }

    /**
     * Получение файлов напрямую из папки
     */
    async getFilesFromFolder() {
        try {
            console.log('📁 Прямой поиск в папке:', this.folderId);
            
            if (!this.folderId) {
                return { success: false, error: 'ID папки не указан' };
            }

            const accessToken = await this.getAccessToken();
            
            const params = new URLSearchParams({
                q: `'${this.folderId}' in parents and trashed=false`,
                fields: 'files(id,name,mimeType,createdTime,modifiedTime,size,iconLink,trashed,owners,shared,parents,permissions,capabilities,lastModifyingUser,webViewLink,description)',
                orderBy: 'modifiedTime desc',
                pageSize: 100
            });

            const url = `https://www.googleapis.com/drive/v3/files?${params}`;
            console.log('🌐 Прямой запрос к папке:', url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Ошибка получения файлов из папки: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`📁 Найдено файлов в папке: ${data.files.length}`);

            return {
                success: true,
                files: data.files,
                totalFiles: data.files.length
            };

        } catch (error) {
            console.error('❌ Ошибка получения файлов из папки:', error);
            return { success: false, error: error.message };
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

    /**
     * Показать уведомление
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: translateX(100%);
            transition: transform 0.3s ease;
            max-width: 400px;
        `;

        const colors = {
            success: 'linear-gradient(135deg, #48bb78, #38a169)',
            error: 'linear-gradient(135deg, #f56565, #e53e3e)',
            warning: 'linear-gradient(135deg, #ed8936, #dd6b20)',
            info: 'linear-gradient(135deg, #4299e1, #3182ce)'
        };

        notification.style.background = colors[type] || colors.info;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoogleDrive;
} else {
    window.GoogleDrive = GoogleDrive;
}
