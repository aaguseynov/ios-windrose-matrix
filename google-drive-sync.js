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
            // Используем новый Google Identity Services API
            const tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: this.clientId,
                scope: 'https://www.googleapis.com/auth/drive.file',
                callback: (response) => {
                    if (response.error) {
                        console.error('Ошибка авторизации:', response.error);
                        return false;
                    }
                    console.log('Авторизация успешна');
                    return true;
                }
            });
            
            // Запрашиваем токен
            tokenClient.requestAccessToken();
            
            return true;
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
            console.log('Начинаем выбор файла из Google Диска...');
            
            const authenticated = await this.authenticate();
            if (!authenticated) {
                throw new Error('Не удалось авторизоваться в Google');
            }
            
            console.log('Авторизация успешна, загружаем Google Picker...');
            
            // Проверяем, загружен ли уже Google Picker
            if (typeof google === 'undefined' || !google.picker) {
                // Загружаем Google Picker API
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://apis.google.com/js/picker.js';
                    script.onload = () => {
                        console.log('Google Picker API загружен');
                        resolve();
                    };
                    script.onerror = (error) => {
                        console.error('Ошибка загрузки Google Picker API:', error);
                        reject(error);
                    };
                    document.head.appendChild(script);
                });
            }
            
            console.log('Создаем Google Picker...');
            
            // Получаем токен доступа
            const authInstance = gapi.auth2.getAuthInstance();
            const user = authInstance.currentUser.get();
            const authResponse = user.getAuthResponse();
            
            if (!authResponse.access_token) {
                throw new Error('Не удалось получить токен доступа');
            }
            
            // Создаем Picker
            const picker = new google.picker.PickerBuilder()
                .addView(google.picker.ViewId.DOCS)
                .setOAuthToken(authResponse.access_token)
                .setCallback(this.onFilePicked.bind(this))
                .build();
            
            console.log('Открываем Google Picker...');
            picker.setVisible(true);
            
            return { success: true };
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
            console.log('Начинаем импорт для разработчика:', developer);
            
            // Сначала пробуем Google Picker
            const result = await this.pickFileFromGoogleDrive();
            
            if (result && result.success) {
                console.log('Google Picker успешно открыт');
                return { success: true };
            } else {
                console.warn('Google Picker не сработал, пробуем альтернативный метод...');
                
                // Альтернативный метод - показываем инструкцию и используем стандартный файловый менеджер
                this.showAlternativeImportInstructions();
                return { success: true };
            }
        } catch (error) {
            console.error('Ошибка при импорте с Google Диска:', error);
            
            // Показываем альтернативный метод при ошибке
            this.showAlternativeImportInstructions();
            return { success: true };
        }
    }

    // Показ инструкций для альтернативного импорта
    showAlternativeImportInstructions() {
        const instructions = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: white; padding: 30px; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                        z-index: 10000; max-width: 500px; text-align: center;">
                <h3 style="color: #2d3748; margin-bottom: 20px;">📥 Загрузка из Google Диска</h3>
                <p style="margin-bottom: 15px;">Для загрузки файла оценки:</p>
                <ol style="text-align: left; margin-bottom: 20px;">
                    <li>Перейдите в папку Google Диска</li>
                    <li>Скачайте нужный файл на устройство</li>
                    <li>Выберите файл в следующем окне</li>
                </ol>
                <a href="${this.driveFolderUrl}" target="_blank" 
                   style="display: inline-block; background: #4285f4; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 6px; margin-bottom: 15px;">
                    📁 Открыть папку Google Диска
                </a>
                <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
                    Найдите файл с оценкой и скачайте его на устройство
                </p>
                <button onclick="this.parentElement.remove(); googleDriveSync.startFileSelection();" 
                        style="background: #48bb78; color: white; border: none; padding: 12px 24px; 
                               border-radius: 6px; cursor: pointer; margin-right: 10px;">
                    Выбрать файл
                </button>
                <button onclick="this.parentElement.remove()" 
                        style="background: #e53e3e; color: white; border: none; padding: 8px 16px; 
                               border-radius: 4px; cursor: pointer;">
                    Закрыть
                </button>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', instructions);
    }

    // Запуск выбора файла
    startFileSelection() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.style.display = 'none';
        
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                this.loadFileFromDevice(file);
            }
        };
        
        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
    }

    // Загрузка файла с устройства
    loadFileFromDevice(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const evaluationData = JSON.parse(e.target.result);
                this.loadEvaluationData(evaluationData);
                showNotification('Файл загружен и данные заполнены!', 'success');
            } catch (error) {
                console.error('Ошибка парсинга файла:', error);
                showNotification('Ошибка при чтении файла. Убедитесь, что это файл оценки.', 'error');
            }
        };
        reader.onerror = () => {
            showNotification('Ошибка при чтении файла', 'error');
        };
        reader.readAsText(file);
    }
}

// Создаем экземпляр класса
const googleDriveSync = new GoogleDriveSync();