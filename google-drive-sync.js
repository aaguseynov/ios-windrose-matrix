// Система синхронизации с Google Диском через файлы
// ВНИМАНИЕ: Это решение требует ручной загрузки/скачивания файлов

class GoogleDriveSync {
    constructor() {
        this.driveFolderUrl = 'https://drive.google.com/drive/folders/14RzE0Souwr-gzb5D0sNqsPH6nMI0J3Ae?usp=drive_link';
        this.filePrefix = 'ios-windrose-evaluation';
    }

    // Создание ссылки для загрузки файла на Google Диск
    createUploadLink(filename) {
        const message = `
📁 Загрузите файл на Google Диск:

🔗 Папка: ${this.driveFolderUrl}

📄 Имя файла: ${filename}

📋 Инструкция:
1. Откройте ссылку на папку Google Диска
2. Нажмите "Создать" → "Загрузить файлы"
3. Выберите файл ${filename}
4. Дождитесь завершения загрузки

✅ После загрузки файл будет доступен всем участникам команды
        `;
        
        return {
            message: message,
            folderUrl: this.driveFolderUrl,
            filename: filename
        };
    }

    // Создание ссылки для скачивания файла с Google Диска
    createDownloadLink(filename) {
        const message = `
📥 Скачайте файл с Google Диска:

🔗 Папка: ${this.driveFolderUrl}

📄 Имя файла: ${filename}

📋 Инструкция:
1. Откройте ссылку на папку Google Диска
2. Найдите файл ${filename}
3. Нажмите правой кнопкой мыши → "Скачать"
4. Сохраните файл на компьютер
5. Используйте "Импорт из файла" для загрузки в систему
        `;
        
        return {
            message: message,
            folderUrl: this.driveFolderUrl,
            filename: filename
        };
    }

    // Экспорт с инструкцией для Google Диска
    async exportToGoogleDrive(evaluationData) {
        try {
            // Создаём файл для экспорта
            const filename = `${this.filePrefix}_${evaluationData.developer}_${new Date().toISOString().split('T')[0]}.json`;
            const result = fileExportManager.exportToJSON(evaluationData, filename);
            
            if (result.success) {
                // Показываем инструкцию для загрузки на Google Диск
                const uploadInfo = this.createUploadLink(filename);
                
                // Создаём модальное окно с инструкцией
                this.showUploadModal(uploadInfo);
                
                return { success: true, filename: filename };
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Ошибка при экспорте для Google Диска:', error);
            return { success: false, error: error.message };
        }
    }

    // Импорт с инструкцией для Google Диска
    async importFromGoogleDrive(developer) {
        try {
            const filename = `${this.filePrefix}_${developer}_${new Date().toISOString().split('T')[0]}.json`;
            const downloadInfo = this.createDownloadLink(filename);
            
            // Показываем модальное окно с инструкцией
            this.showDownloadModal(downloadInfo);
            
            return { success: true, filename: filename };
        } catch (error) {
            console.error('Ошибка при импорте с Google Диска:', error);
            return { success: false, error: error.message };
        }
    }

    // Показать модальное окно для загрузки
    showUploadModal(uploadInfo) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                padding: 30px;
                border-radius: 15px;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            ">
                <h3 style="color: #2d3748; margin-bottom: 20px;">📁 Загрузка на Google Диск</h3>
                <div style="white-space: pre-line; line-height: 1.6; color: #4a5568; margin-bottom: 20px;">${uploadInfo.message}</div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="this.closest('.modal').remove()" style="
                        padding: 10px 20px;
                        border: 1px solid #e2e8f0;
                        background: #f7fafc;
                        border-radius: 8px;
                        cursor: pointer;
                    ">Закрыть</button>
                    <button onclick="window.open('${uploadInfo.folderUrl}', '_blank')" style="
                        padding: 10px 20px;
                        background: #4299e1;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                    ">Открыть папку</button>
                </div>
            </div>
        `;
        
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    // Показать модальное окно для скачивания
    showDownloadModal(downloadInfo) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                padding: 30px;
                border-radius: 15px;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            ">
                <h3 style="color: #2d3748; margin-bottom: 20px;">📥 Скачивание с Google Диска</h3>
                <div style="white-space: pre-line; line-height: 1.6; color: #4a5568; margin-bottom: 20px;">${downloadInfo.message}</div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="this.closest('.modal').remove()" style="
                        padding: 10px 20px;
                        border: 1px solid #e2e8f0;
                        background: #f7fafc;
                        border-radius: 8px;
                        cursor: pointer;
                    ">Закрыть</button>
                    <button onclick="window.open('${downloadInfo.folderUrl}', '_blank')" style="
                        padding: 10px 20px;
                        background: #4299e1;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                    ">Открыть папку</button>
                </div>
            </div>
        `;
        
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
}

// Создаём глобальный экземпляр
const googleDriveSync = new GoogleDriveSync();
