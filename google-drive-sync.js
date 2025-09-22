// Система синхронизации с Google Диском через API
// Прямая загрузка и сохранение в Google Диск

class GoogleDriveSync {
    constructor() {
        // Проверяем наличие обязательных переменных окружения
        this.validateEnvironment();
        
        // Используем конфигурацию из config.js
        this.driveFolderUrl = config.folderUrl;
        this.filePrefix = config.filePrefix;
        this.folderId = config.folderId;
        this.isInitialized = false;
        
        // Google OAuth credentials из конфигурации
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.projectId = config.projectId;
    }

    // Проверка переменных окружения
    validateEnvironment() {
        // Только секретные переменные требуют обязательной настройки
        const requiredVars = [
            'clientId',
            'clientSecret', 
            'projectId'
        ];
        
        const missingVars = requiredVars.filter(varName => !config[varName]);
        
        if (missingVars.length > 0) {
            console.error('Отсутствуют обязательные переменные окружения:', missingVars);
            showNotification(
                `Ошибка конфигурации: отсутствуют переменные окружения: ${missingVars.join(', ')}`, 
                'error'
            );
            throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
        }
        
        // Проверяем наличие настроек Google Диска (с дефолтными значениями)
        if (!config.folderId || !config.folderUrl) {
            console.warn('Настройки Google Диска не найдены, используются дефолтные значения');
        }
    }

    // Инициализация Google API
    async initializeGapi() {
        if (this.isInitialized) return true;
        
        try {
            console.log('Инициализация Google API...');
            
            // Загружаем Google API
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://apis.google.com/js/api.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
            
            // Инициализируем gapi
            await new Promise((resolve, reject) => {
                gapi.load('client:auth2', resolve);
            });
            
            console.log('Инициализация gapi с Client ID:', this.clientId);
            
            await gapi.client.init({
                clientId: this.clientId,
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
                scope: 'https://www.googleapis.com/auth/drive.file'
            });
            
            this.isInitialized = true;
            console.log('Google API инициализирован успешно');
            return true;
        } catch (error) {
            console.error('Ошибка инициализации Google API:', error);
            return false;
        }
    }

    // Авторизация пользователя
    async authenticate() {
        if (!this.isInitialized) {
            const initialized = await this.initializeGapi();
            if (!initialized) return false;
        }
        
        try {
            const authInstance = gapi.auth2.getAuthInstance();
            
            // Проверяем, авторизован ли пользователь
            if (authInstance.isSignedIn.get()) {
                return true;
            }
            
            // Если не авторизован, запрашиваем авторизацию
            const user = await authInstance.signIn({
                scope: 'https://www.googleapis.com/auth/drive.file'
            });
            
            return user.isSignedIn();
        } catch (error) {
            console.error('Ошибка авторизации:', error);
            return false;
        }
    }

    // Прямая загрузка файла в Google Диск
    async uploadToGoogleDrive(evaluationData) {
        try {
            console.log('Начинаем загрузку в Google Диск...');
            const authenticated = await this.authenticate();
            if (!authenticated) {
                throw new Error('Не удалось авторизоваться в Google. Проверьте, что у вас есть доступ к Google Диску.');
            }
            
            console.log('Авторизация успешна, начинаем загрузку файла...');
            
            const filename = `${this.filePrefix}_${evaluationData.developer}_${new Date().toISOString().split('T')[0]}.json`;
            const fileContent = JSON.stringify(evaluationData, null, 2);
            
            const file = new Blob([fileContent], { type: 'application/json' });
            const metadata = {
                name: filename,
                parents: [this.folderId]
            };
            
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', file);
            
            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token}`
                },
                body: form
            });
            
            if (response.ok) {
                const result = await response.json();
                return { success: true, fileId: result.id, filename: filename };
            } else {
                throw new Error(`Ошибка загрузки: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Ошибка загрузки в Google Диск:', error);
            return { success: false, error: error.message };
        }
    }

    // Выбор файла из Google Диска через Picker
    async pickFileFromGoogleDrive() {
        try {
            const authenticated = await this.authenticate();
            if (!authenticated) {
                throw new Error('Не удалось авторизоваться в Google');
            }
            
            // Загружаем Google Picker API
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://apis.google.com/js/picker.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
            
            // Создаем Picker
            const picker = new google.picker.PickerBuilder()
                .addView(google.picker.ViewId.DOCS)
                .setOAuthToken(gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token)
                .setCallback(this.onFilePicked.bind(this))
                .build();
            
            picker.setVisible(true);
        } catch (error) {
            console.error('Ошибка выбора файла:', error);
            return { success: false, error: error.message };
        }
    }

    // Обработка выбранного файла
    onFilePicked(data) {
        if (data.action === google.picker.Action.PICKED) {
            const fileId = data.docs[0].id;
            this.downloadFileFromGoogleDrive(fileId);
        }
    }

    // Скачивание файла из Google Диска
    async downloadFileFromGoogleDrive(fileId) {
        try {
            const response = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });
            
            const fileContent = response.body;
            const evaluationData = JSON.parse(fileContent);
            
            // Загружаем данные в форму
            this.loadEvaluationData(evaluationData);
            
            return { success: true, data: evaluationData };
        } catch (error) {
            console.error('Ошибка скачивания файла:', error);
            return { success: false, error: error.message };
        }
    }

    // Загрузка данных оценки в форму
    loadEvaluationData(evaluationData) {
        console.log('Загружаем данные оценки:', evaluationData);
        
        // Загружаем данные в поля ввода
        const inputs = document.querySelectorAll('.evaluation-input');
        
        if (evaluationData.competencies) {
            let inputIndex = 0;
            Object.keys(evaluationData.competencies).forEach(compKey => {
                const compData = evaluationData.competencies[compKey];
                Object.keys(compData).forEach(levelKey => {
                    const levelData = compData[levelKey];
                    
                    if (inputs[inputIndex * 3]) {
                        inputs[inputIndex * 3].value = levelData.selfEvaluation || 0;
                    }
                    if (inputs[inputIndex * 3 + 1]) {
                        inputs[inputIndex * 3 + 1].value = levelData.managerEvaluation || 0;
                    }
                    if (inputs[inputIndex * 3 + 2]) {
                        inputs[inputIndex * 3 + 2].value = levelData.comments || '';
                    }
                    
                    inputIndex++;
                });
            });
        }
        
        // Обновляем диаграмму
        if (typeof updateWindroseChart === 'function') {
            updateWindroseChart();
        }
        
        showNotification('Данные оценки загружены из Google Диска!', 'success');
    }

    // Экспорт с прямой загрузкой в Google Диск
    async exportToGoogleDrive(evaluationData) {
        try {
            const result = await this.uploadToGoogleDrive(evaluationData);
            
            if (result.success) {
                showNotification(`Файл "${result.filename}" успешно загружен в Google Диск!`, 'success');
                return { success: true, filename: result.filename };
            } else {
                showNotification('Ошибка при загрузке в Google Диск: ' + result.error, 'error');
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('Ошибка при экспорте для Google Диска:', error);
            return { success: false, error: error.message };
        }
    }

    // Импорт с выбором файла из Google Диска
    async importFromGoogleDrive(developer) {
        try {
            const result = await this.pickFileFromGoogleDrive();
            
            if (result && result.success) {
                return { success: true };
            } else {
                showNotification('Ошибка при выборе файла: ' + (result?.error || 'Неизвестная ошибка'), 'error');
                return { success: false, error: result?.error || 'Неизвестная ошибка' };
            }
        } catch (error) {
            console.error('Ошибка при импорте с Google Диска:', error);
            return { success: false, error: error.message };
        }
    }
}

// Создаем экземпляр класса
const googleDriveSync = new GoogleDriveSync();