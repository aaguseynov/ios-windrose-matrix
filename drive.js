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
        
        // Callbacks
        this.onFilesLoaded = null;
        this.onFileUploaded = null;
        this.onError = null;
    }

    /**
     * Получение списка файлов из Google Drive
     */
    async getFiles(options = {}) {
        try {
            console.log('📁 Получение списка файлов...');
            this.showLoadingIndicator('Загрузка файлов...');

            const accessToken = this.auth.getAccessToken();
            
            // Параметры запроса
            const params = new URLSearchParams({
                pageSize: options.pageSize || 100,
                fields: 'files(id,name,mimeType,createdTime,modifiedTime,size,iconLink)',
                orderBy: 'modifiedTime desc'
            });

            // Если указана папка, ищем файлы только в ней
            if (this.folderId && options.folderOnly !== false) {
                params.append('q', `'${this.folderId}' in parents`);
            }

            // Если указан тип файлов
            if (options.mimeType) {
                const q = params.get('q') || '';
                params.set('q', q ? `${q} and mimeType='${options.mimeType}'` : `mimeType='${options.mimeType}'`);
            }

            const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
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

            const accessToken = this.auth.getAccessToken();
            
            // Создаем метаданные файла
            const metadata = {
                name: filename,
                parents: options.parents || (this.folderId ? [this.folderId] : [])
            };

            // Создаем FormData для multipart upload
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', new Blob([fileContent], { type: 'application/json' }));

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

            const accessToken = this.auth.getAccessToken();

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
            const accessToken = this.auth.getAccessToken();

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

            const accessToken = this.auth.getAccessToken();
            
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

            const accessToken = this.auth.getAccessToken();

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
