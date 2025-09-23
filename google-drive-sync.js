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
        this.accessToken = null;
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
            
            // Загружаем Google Picker API
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://apis.google.com/js/picker.js';
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

    // Авторизация в Google
    async authenticate() {
        try {
            console.log('Начинаем авторизацию в Google...');
            
            // Инициализируем Google API если еще не инициализирован
            const gapiInitialized = await this.initializeGapi();
            if (!gapiInitialized) {
                throw new Error('Не удалось инициализировать Google API');
            }
            
            // Получаем экземпляр авторизации
            const authInstance = gapi.auth2.getAuthInstance();
            
            // Проверяем, авторизован ли пользователь
            if (!authInstance.isSignedIn.get()) {
                console.log('Пользователь не авторизован, запускаем авторизацию...');
                
                // Запускаем авторизацию с правильными параметрами
                const user = await authInstance.signIn({
                    scope: 'https://www.googleapis.com/auth/drive.file'
                });
                console.log('Авторизация успешна:', user.getBasicProfile().getName());
            } else {
                console.log('Пользователь уже авторизован');
            }
            
            // Получаем токен доступа
            const user = authInstance.currentUser.get();
            const authResponse = user.getAuthResponse();
            
            if (!authResponse.access_token) {
                throw new Error('Не удалось получить токен доступа');
            }
            
            // Проверяем, что токен действителен
            if (authResponse.expires_at && Date.now() >= authResponse.expires_at) {
                console.log('Токен истек, обновляем...');
                await user.reloadAuthResponse();
                const newAuthResponse = user.getAuthResponse();
                this.accessToken = newAuthResponse.access_token;
            } else {
                this.accessToken = authResponse.access_token;
            }
            
            console.log('Токен доступа получен успешно');
            return true;
        } catch (error) {
            console.error('Ошибка авторизации:', error);
            
            // Более детальная обработка ошибок
            if (error.error === 'popup_closed_by_user') {
                showNotification('Авторизация отменена пользователем', 'error');
            } else if (error.error === 'access_denied') {
                showNotification('Доступ запрещен. Проверьте настройки Google API', 'error');
            } else {
                showNotification('Ошибка авторизации в Google: ' + error.message, 'error');
            }
            
            return false;
        }
    }

    // Показать Google Picker для выбора файла
    async showGooglePicker() {
        return new Promise((resolve) => {
            try {
                console.log('Показываем Google Picker...');
                
                // Проверяем, что Google Picker API загружен
                if (typeof google === 'undefined' || !google.picker) {
                    console.error('Google Picker API не загружен');
                    resolve(null);
                    return;
                }
                
                // Создаем Google Picker
                const picker = new google.picker.PickerBuilder()
                    .addView(google.picker.ViewId.DOCS)
                    .setOAuthToken(this.accessToken)
                    .setDeveloperKey(this.clientId)
                    .setCallback((data) => {
                        console.log('Google Picker callback:', data);
                        if (data.action === google.picker.Action.PICKED) {
                            const file = data.docs[0];
                            console.log('Выбран файл:', file);
                            resolve(file);
                        } else {
                            console.log('Пользователь отменил выбор');
                            resolve(null);
                        }
                    })
                    .build();
                
                picker.setVisible(true);
            } catch (error) {
                console.error('Ошибка Google Picker:', error);
                resolve(null);
            }
        });
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
                    'Authorization': `Bearer ${this.accessToken}`
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
            
            // Инициализируем Google API
            const gapiInitialized = await this.initializeGapi();
            if (!gapiInitialized) {
                throw new Error('Не удалось инициализировать Google API');
            }
            
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
            
            this.accessToken = authResponse.access_token;
            
            // Создаем Picker с правильными параметрами
            const picker = new google.picker.PickerBuilder()
                .addView(google.picker.ViewId.DOCS)
                .addView(google.picker.ViewId.FOLDERS)
                .setOAuthToken(authResponse.access_token)
                .setDeveloperKey(this.clientId)
                .setOrigin(window.location.origin)
                .setCallback(this.onFilePicked.bind(this))
                .build();
            
            console.log('Открываем Google Picker...');
            picker.setVisible(true);
            
            return { success: true };
        } catch (error) {
            console.error('Ошибка выбора файла:', error);
            
            // Если Google Picker не работает, показываем альтернативный метод
            console.log('Google Picker не работает, показываем альтернативный метод...');
            this.showAlternativeImportInstructions();
            
            return { success: false, error: error.message };
        }
    }

    // Обработка выбранного файла
    onFilePicked(data) {
        if (data.action === google.picker.Action.PICKED) {
            const file = data.docs[0];
            console.log('Выбран файл:', file);
            
            // Проверяем, что это файл оценки (JSON)
            if (file.mimeType === 'application/json' || file.name.endsWith('.json')) {
                this.downloadFileFromGoogleDrive(file.id, file.name);
            } else {
                showNotification('Пожалуйста, выберите JSON файл с оценкой', 'error');
            }
        }
    }

    // Скачивание файла из Google Диска напрямую
    async downloadFileFromGoogleDrive(fileId, fileName = '') {
        try {
            console.log('Начинаем скачивание файла:', fileId);
            
            // Получаем токен доступа
            const authInstance = gapi.auth2.getAuthInstance();
            const user = authInstance.currentUser.get();
            const authResponse = user.getAuthResponse();
            
            if (!authResponse.access_token) {
                throw new Error('Не удалось получить токен доступа');
            }
            
            // Загружаем файл напрямую через Drive API
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authResponse.access_token}`,
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Ошибка авторизации. Попробуйте войти в Google снова.');
                } else if (response.status === 403) {
                    throw new Error('Доступ запрещен. Проверьте права доступа к файлу.');
                } else {
                    throw new Error(`Ошибка загрузки файла: ${response.status} ${response.statusText}`);
                }
            }
            
            const fileContent = await response.text();
            
            // Проверяем, что это валидный JSON
            let evaluationData;
            try {
                evaluationData = JSON.parse(fileContent);
            } catch (parseError) {
                throw new Error('Файл не является валидным JSON файлом оценки');
            }
            
            // Проверяем структуру данных
            if (!evaluationData.developer && !evaluationData.competencies) {
                throw new Error('Файл не содержит данные оценки');
            }
            
            // Загружаем данные в форму
            this.loadEvaluationData(evaluationData);
            
            showNotification(`Файл "${fileName}" успешно загружен из Google Диска!`, 'success');
            
            return { success: true, data: evaluationData };
        } catch (error) {
            console.error('Ошибка скачивания файла:', error);
            showNotification('Ошибка при загрузке файла: ' + error.message, 'error');
            return { success: false, error: error.message };
        }
    }

    // Получение списка файлов оценок из папки Google Drive
    async getEvaluationFiles() {
        try {
            console.log('Получаем список файлов оценок...');
            
            const authenticated = await this.authenticate();
            if (!authenticated) {
                throw new Error('Не удалось авторизоваться в Google');
            }
            
            // Получаем токен доступа
            const authInstance = gapi.auth2.getAuthInstance();
            const user = authInstance.currentUser.get();
            const authResponse = user.getAuthResponse();
            
            if (!authResponse.access_token) {
                throw new Error('Не удалось получить токен доступа');
            }
            
            // Запрашиваем файлы из папки
            const response = await fetch(`https://www.googleapis.com/drive/v3/files?q='${this.folderId}' in parents and mimeType='application/json'&fields=files(id,name,createdTime,modifiedTime)`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authResponse.access_token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Ошибка получения списка файлов: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Найдено файлов:', data.files.length);
            
            return { success: true, files: data.files };
        } catch (error) {
            console.error('Ошибка получения списка файлов:', error);
            return { success: false, error: error.message };
        }
    }

    // Загрузка данных оценки в форму
    loadEvaluationData(evaluationData) {
        console.log('Загружаем данные оценки:', evaluationData);
        
        // Устанавливаем разработчика в селект
        if (evaluationData.developer) {
            const developerSelect = document.getElementById('developer-profile');
            if (developerSelect) {
                developerSelect.value = evaluationData.developer;
            }
        }
        
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
        
        // Обновляем диаграмму и прогресс
        if (typeof calculateProgress === 'function') {
            calculateProgress();
        }
        
        // Обновляем информацию об оценке
        this.updateEvaluationInfo(evaluationData);
    }

    // Обновление информации об оценке
    updateEvaluationInfo(evaluationData) {
        const developerSelect = document.getElementById('developer-profile');
        const currentDeveloper = document.getElementById('current-developer');
        const evaluationDate = document.getElementById('evaluation-date');
        const evaluationStatus = document.getElementById('evaluation-status');
        const evaluationInfo = document.getElementById('evaluation-info');
        
        if (currentDeveloper && evaluationData.developer) {
            const developerNames = {
                'artem': 'Артем Брагин',
                'denis': 'Денис Вальщиков', 
                'anar': 'Анар Гусейнов'
            };
            currentDeveloper.textContent = developerNames[evaluationData.developer] || evaluationData.developer;
        }
        
        if (evaluationDate && evaluationData.date) {
            evaluationDate.textContent = new Date(evaluationData.date).toLocaleDateString('ru-RU');
        }
        
        if (evaluationStatus) {
            evaluationStatus.textContent = 'Загружена';
            evaluationStatus.className = 'status-completed';
        }
        
        if (evaluationInfo) {
            evaluationInfo.style.display = 'block';
        }
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
            
            // Сначала пробуем показать список файлов
            const filesResult = await this.getEvaluationFiles();
            
            if (filesResult.success && filesResult.files.length > 0) {
                // Показываем список файлов для выбора
                this.showFileSelectionModal(filesResult.files);
                return { success: true };
            } else {
                // Если файлов нет или ошибка, пробуем Google Picker
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
            }
        } catch (error) {
            console.error('Ошибка при импорте с Google Диска:', error);
            
            // Показываем альтернативный метод при ошибке
            this.showAlternativeImportInstructions();
            return { success: true };
        }
    }

    // Показ модального окна для выбора файла
    showFileSelectionModal(files) {
        console.log('Показываем модальное окно выбора файла');
        
        // Создаем HTML для модального окна
        const modalHtml = `
            <div id="file-selection-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                        background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                            max-width: 600px; width: 90%; max-height: 80%; overflow-y: auto;">
                    <h3 style="color: #2d3748; margin-bottom: 20px; text-align: center;">📁 Выберите файл оценки</h3>
                    <div id="files-list" style="margin-bottom: 20px;">
                        ${files.map(file => `
                            <div class="file-item" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 10px; 
                                        cursor: pointer; transition: all 0.3s ease;" 
                                 onclick="googleDriveSync.selectFile('${file.id}', '${file.name}')"
                                 onmouseover="this.style.background='#f7fafc'; this.style.borderColor='#4299e1';"
                                 onmouseout="this.style.background='white'; this.style.borderColor='#e2e8f0';">
                                <div style="display: flex; justify-content: between; align-items: center;">
                                    <div style="flex: 1;">
                                        <h4 style="margin: 0 0 5px 0; color: #2d3748; font-size: 16px;">${file.name}</h4>
                                        <p style="margin: 0; color: #4a5568; font-size: 14px;">
                                            Создан: ${new Date(file.createdTime).toLocaleDateString('ru-RU')}
                                        </p>
                                        <p style="margin: 0; color: #4a5568; font-size: 14px;">
                                            Изменен: ${new Date(file.modifiedTime).toLocaleDateString('ru-RU')}
                                        </p>
                                    </div>
                                    <div style="color: #4299e1; font-size: 24px;">📄</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div style="text-align: center;">
                        <button onclick="googleDriveSync.closeFileSelectionModal()" 
                                style="background: #e53e3e; color: white; border: none; padding: 12px 24px; 
                                       border-radius: 6px; cursor: pointer; margin-right: 10px;">
                            Закрыть
                        </button>
                        <button onclick="googleDriveSync.pickFileFromGoogleDrive()" 
                                style="background: #4299e1; color: white; border: none; padding: 12px 24px; 
                                       border-radius: 6px; cursor: pointer;">
                            Открыть Google Picker
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // Закрытие модального окна выбора файла
    closeFileSelectionModal() {
        const modal = document.getElementById('file-selection-modal');
        if (modal) {
            modal.remove();
        }
    }

    // Выбор файла из списка
    async selectFile(fileId, fileName) {
        console.log('Выбран файл:', fileName, 'ID:', fileId);
        
        // Закрываем модальное окно
        this.closeFileSelectionModal();
        
        // Загружаем файл
        await this.downloadFileFromGoogleDrive(fileId, fileName);
    }

    // Показ инструкций для альтернативного импорта
    showAlternativeImportInstructions() {
        const instructions = `
            <div id="alternative-import-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                        background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                            max-width: 600px; width: 90%; max-height: 80%; overflow-y: auto;">
                    <h3 style="color: #2d3748; margin-bottom: 20px; text-align: center;">📥 Загрузка из Google Диска</h3>
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="color: #e53e3e; margin-bottom: 10px;">⚠️ Проблема с Google Picker</h4>
                        <p style="margin: 0; color: #666; font-size: 14px;">
                            Google Picker временно недоступен. Используйте альтернативный способ загрузки.
                        </p>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="color: #2d3748; margin-bottom: 15px;">📋 Инструкция:</h4>
                        <ol style="text-align: left; margin-bottom: 20px; padding-left: 20px;">
                            <li style="margin-bottom: 8px;">Перейдите в папку Google Диска по ссылке ниже</li>
                            <li style="margin-bottom: 8px;">Найдите нужный файл оценки (формат .json)</li>
                            <li style="margin-bottom: 8px;">Скачайте файл на устройство</li>
                            <li style="margin-bottom: 8px;">Выберите файл в следующем окне</li>
                        </ol>
                    </div>
                    
                    <div style="text-align: center; margin-bottom: 20px;">
                        <a href="${this.driveFolderUrl}" target="_blank" 
                           style="display: inline-block; background: #4285f4; color: white; padding: 12px 24px; 
                                  text-decoration: none; border-radius: 6px; margin-bottom: 15px; font-weight: 600;">
                            📁 Открыть папку Google Диска
                        </a>
                    </div>
                    
                    <div style="background: #e6fffa; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #38a169;">
                        <p style="margin: 0; color: #2d3748; font-size: 14px;">
                            <strong>💡 Совет:</strong> Ищите файлы с названиями типа "ios-windrose-evaluation_artem_2024-01-15.json"
                        </p>
                    </div>
                    
                    <div style="text-align: center;">
                        <button onclick="googleDriveSync.closeAlternativeModal(); googleDriveSync.startFileSelection();" 
                                style="background: #48bb78; color: white; border: none; padding: 12px 24px; 
                                       border-radius: 6px; cursor: pointer; margin-right: 10px; font-weight: 600;">
                            📂 Выбрать файл с устройства
                        </button>
                        <button onclick="googleDriveSync.closeAlternativeModal()" 
                                style="background: #e53e3e; color: white; border: none; padding: 12px 24px; 
                                       border-radius: 6px; cursor: pointer; font-weight: 600;">
                            ❌ Закрыть
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', instructions);
    }

    // Закрытие альтернативного модального окна
    closeAlternativeModal() {
        const modal = document.getElementById('alternative-import-modal');
        if (modal) {
            modal.remove();
        }
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
    
    // Показать Google Picker для выбора файла
    async pickFileFromGoogleDrive() {
        try {
            console.log('Показываем Google Picker для выбора файла...');
            
            // Проверяем, что Google Picker API загружен
            if (typeof google === 'undefined' || !google.picker) {
                console.error('Google Picker API не загружен');
                return false;
            }
            
            // Создаем Google Picker
            const picker = new google.picker.PickerBuilder()
                .addView(google.picker.ViewId.DOCS)
                .setDeveloperKey(this.clientId)
                .setCallback((data) => {
                    console.log('Google Picker callback:', data);
                    if (data.action === google.picker.Action.PICKED) {
                        const file = data.docs[0];
                        console.log('Выбран файл:', file);
                        this.onFilePicked(file);
                    } else {
                        console.log('Пользователь отменил выбор');
                    }
                })
                .build();
            
            picker.setVisible(true);
            return true;
        } catch (error) {
            console.error('Ошибка Google Picker:', error);
            return false;
        }
    }
    
    // Обработка выбранного файла
    onFilePicked(file) {
        console.log('Обрабатываем выбранный файл:', file);
        // Здесь можно добавить логику обработки выбранного файла
        alert(`Выбран файл: ${file.name}`);
    }
}

// Создаем экземпляр класса
const googleDriveSync = new GoogleDriveSync();