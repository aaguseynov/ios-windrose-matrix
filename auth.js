/**
 * Google Identity Services Authorization Module
 * 
 * Использует новые Google Identity Services (GIS) вместо устаревшего gapi.auth2
 * 
 * Настройка:
 * 1. Получите Client ID в Google Cloud Console: https://console.cloud.google.com/
 * 2. Создайте OAuth 2.0 Client ID для веб-приложения
 * 3. Добавьте ваш домен в Authorized JavaScript origins
 * 4. Установите CLIENT_ID в config.js
 */

class GoogleAuth {
    constructor(config) {
        this.clientId = config.clientId;
        this.scope = 'https://www.googleapis.com/auth/drive.file';
        this.isInitialized = false;
        this.isSignedIn = false;
        this.user = null;
        this.accessToken = null;
        this.credential = null;
        
        // Callbacks
        this.onAuthSuccess = null;
        this.onAuthError = null;
        this.onSignOut = null;
    }

    /**
     * Инициализация Google Identity Services
     */
    async initialize() {
        try {
            console.log('🔧 Инициализация Google Identity Services...');
            
            // Проверяем наличие Client ID
            if (!this.clientId || this.clientId.includes('CLIENT_ID_PLACEHOLDER') || this.clientId.includes('YOUR_CLIENT_ID_HERE')) {
                throw new Error('Client ID не настроен. Убедитесь, что env-vars.js загружен корректно.');
            }
            
            // Загружаем Google Identity Services
            await this.loadGoogleIdentityServices();
            
            // Инициализируем Google Identity Services
            await this.initGoogleIdentityServices();
            
            // Проверяем существующую авторизацию
            await this.checkExistingAuth();
            
            this.isInitialized = true;
            console.log('✅ Google Identity Services инициализированы');
            
            return true;
        } catch (error) {
            console.error('❌ Ошибка инициализации Google Identity Services:', error);
            this.handleAuthError(error);
            return false;
        }
    }

    /**
     * Загрузка Google Identity Services скрипта
     */
    loadGoogleIdentityServices() {
        return new Promise((resolve, reject) => {
            // Проверяем, не загружен ли уже
            if (window.google && window.google.accounts) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Инициализация Google Identity Services
     */
    initGoogleIdentityServices() {
        return new Promise((resolve, reject) => {
            try {
                // Инициализируем Google Identity Services
                google.accounts.id.initialize({
                    client_id: this.clientId,
                    callback: (response) => {
                        console.log('🔐 Получен ответ от Google Identity Services');
                        this.handleCredentialResponse(response);
                    },
                    auto_select: false,
                    cancel_on_tap_outside: false
                });
                
                console.log('✅ Google Identity Services инициализированы');
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Обработка ответа с учетными данными
     */
    handleCredentialResponse(response) {
        try {
            console.log('🔐 Получены учетные данные от Google');
            
            // Декодируем JWT токен
            const payload = this.decodeJwtToken(response.credential);
            
            this.credential = response.credential;
            this.user = {
                id: payload.sub,
                email: payload.email,
                name: payload.name,
                picture: payload.picture,
                getBasicProfile: () => ({
                    getName: () => payload.name,
                    getEmail: () => payload.email,
                    getImageUrl: () => payload.picture
                })
            };
            
            this.isSignedIn = true;
            
            // Сохраняем состояние в localStorage
            this.saveAuthState();
            
            // Получаем токен доступа для Google Drive API
            this.getAccessTokenForDrive();
            
        } catch (error) {
            console.error('❌ Ошибка обработки учетных данных:', error);
            this.handleAuthError(error);
        }
    }

    /**
     * Декодирование JWT токена
     */
    decodeJwtToken(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (error) {
            throw new Error('Не удалось декодировать JWT токен: ' + error.message);
        }
    }

    /**
     * Получение токена доступа для Google Drive API
     */
    async getAccessTokenForDrive() {
        try {
            console.log('🔄 Получение токена доступа для Google Drive API...');
            
            // Для Google Identity Services используем credential напрямую
            // или получаем токен через Google Token API
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    assertion: this.credential,
                    scope: this.scope
                })
            });

            if (response.ok) {
                const tokenData = await response.json();
                this.accessToken = tokenData.access_token;
                console.log('✅ Токен доступа получен через Token API');
            } else {
                // Fallback: используем credential для прямых запросов
                this.accessToken = this.credential;
                console.log('⚠️ Используем credential напрямую');
            }
            
            this.handleAuthSuccess();
            
        } catch (error) {
            console.error('❌ Ошибка получения токена доступа:', error);
            
            // Fallback: используем credential для прямых запросов
            this.accessToken = this.credential;
            this.handleAuthSuccess();
        }
    }

    /**
     * Авторизация пользователя
     */
    async signIn() {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            // Проверяем, есть ли Client ID
            if (!this.clientId || this.clientId.includes('CLIENT_ID_PLACEHOLDER') || this.clientId.includes('YOUR_CLIENT_ID_HERE')) {
                throw new Error('Client ID не настроен. Убедитесь, что env-vars.js загружен корректно.');
            }

            if (this.isSignedIn) {
                console.log('👤 Пользователь уже авторизован');
                this.handleAuthSuccess();
                return true;
            }

            console.log('🔐 Запрос авторизации...');
            this.showLoadingIndicator('Авторизация в Google...');

            // Используем renderButton для создания кнопки авторизации
            const buttonContainer = document.getElementById('google-signin-button') || this.createSignInButton();
            
            // Рендерим кнопку Google Sign-In
            google.accounts.id.renderButton(buttonContainer, {
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                shape: 'rectangular',
                logo_alignment: 'left',
                width: 300
            });

            // Также показываем popup как альтернативу
            google.accounts.id.prompt();
            
            return true;
        } catch (error) {
            console.error('❌ Ошибка авторизации:', error);
            this.hideLoadingIndicator();
            this.handleAuthError(error);
            return false;
        }
    }

    /**
     * Создание контейнера для кнопки авторизации
     */
    createSignInButton() {
        const buttonContainer = document.createElement('div');
        buttonContainer.id = 'google-signin-button';
        buttonContainer.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 10002;
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        `;
        
        const title = document.createElement('h3');
        title.textContent = 'Авторизация в Google';
        title.style.marginBottom = '20px';
        title.style.textAlign = 'center';
        title.style.color = '#333';
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #666;
        `;
        closeBtn.onclick = () => {
            buttonContainer.remove();
            this.hideLoadingIndicator();
        };
        
        buttonContainer.appendChild(closeBtn);
        buttonContainer.appendChild(title);
        document.body.appendChild(buttonContainer);
        
        return buttonContainer;
    }

    /**
     * Выход из системы
     */
    async signOut() {
        try {
            if (window.google && window.google.accounts) {
                google.accounts.id.disableAutoSelect();
            }
            
            this.isSignedIn = false;
            this.user = null;
            this.accessToken = null;
            this.credential = null;
            
            // Очищаем localStorage
            this.clearAuthState();
            
            console.log('👋 Пользователь вышел из системы');
            this.handleSignOut();
        } catch (error) {
            console.error('❌ Ошибка выхода:', error);
        }
    }

    /**
     * Получение токена доступа
     */
    getAccessToken() {
        if (!this.isSignedIn || !this.accessToken) {
            throw new Error('Пользователь не авторизован');
        }
        return this.accessToken;
    }

    /**
     * Обработка успешной авторизации
     */
    handleAuthSuccess() {
        this.hideLoadingIndicator();
        if (this.onAuthSuccess) {
            this.onAuthSuccess(this.user);
        }
    }

    /**
     * Обработка ошибки авторизации
     */
    handleAuthError(error) {
        this.hideLoadingIndicator();
        
        let message = 'Ошибка авторизации';
        
        if (error.message && error.message.includes('отменена пользователем')) {
            message = 'Авторизация отменена пользователем';
        } else if (error.message && error.message.includes('Client ID не настроен')) {
            message = 'Client ID не настроен. Проверьте настройки Google API';
        } else {
            message = error.message || message;
        }

        if (this.onAuthError) {
            this.onAuthError(message);
        }
    }

    /**
     * Обработка выхода из системы
     */
    handleSignOut() {
        if (this.onSignOut) {
            this.onSignOut();
        }
    }

    /**
     * Показать индикатор загрузки
     */
    showLoadingIndicator(message = 'Загрузка...') {
        // Создаем индикатор загрузки, если его нет
        let loader = document.getElementById('auth-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'auth-loader';
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
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            `;
            
            document.body.appendChild(loader);
        }
    }

    /**
     * Скрыть индикатор загрузки
     */
    hideLoadingIndicator() {
        const loader = document.getElementById('auth-loader');
        if (loader) {
            loader.remove();
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

        // Цвета для разных типов уведомлений
        const colors = {
            success: 'linear-gradient(135deg, #48bb78, #38a169)',
            error: 'linear-gradient(135deg, #f56565, #e53e3e)',
            warning: 'linear-gradient(135deg, #ed8936, #dd6b20)',
            info: 'linear-gradient(135deg, #4299e1, #3182ce)'
        };

        notification.style.background = colors[type] || colors.info;
        notification.textContent = message;
        document.body.appendChild(notification);

        // Анимация появления
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Автоматическое скрытие
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    /**
     * Сохранение состояния авторизации в localStorage
     */
    saveAuthState() {
        try {
            const authState = {
                isSignedIn: this.isSignedIn,
                user: this.user,
                accessToken: this.accessToken,
                credential: this.credential,
                timestamp: Date.now()
            };
            
            localStorage.setItem('google_auth_state', JSON.stringify(authState));
            console.log('💾 Состояние авторизации сохранено');
        } catch (error) {
            console.error('❌ Ошибка сохранения состояния:', error);
        }
    }

    /**
     * Восстановление состояния авторизации из localStorage
     */
    restoreAuthState() {
        try {
            const authStateStr = localStorage.getItem('google_auth_state');
            if (!authStateStr) {
                return false;
            }

            const authState = JSON.parse(authStateStr);
            
            // Проверяем, не истек ли токен (24 часа)
            const tokenAge = Date.now() - authState.timestamp;
            const maxAge = 24 * 60 * 60 * 1000; // 24 часа
            
            if (tokenAge > maxAge) {
                console.log('⏰ Токен авторизации истек, очищаем состояние');
                this.clearAuthState();
                return false;
            }

            this.isSignedIn = authState.isSignedIn;
            this.user = authState.user;
            this.accessToken = authState.accessToken;
            this.credential = authState.credential;
            
            console.log('✅ Состояние авторизации восстановлено');
            return true;
        } catch (error) {
            console.error('❌ Ошибка восстановления состояния:', error);
            this.clearAuthState();
            return false;
        }
    }

    /**
     * Очистка состояния авторизации из localStorage
     */
    clearAuthState() {
        try {
            localStorage.removeItem('google_auth_state');
            console.log('🗑️ Состояние авторизации очищено');
        } catch (error) {
            console.error('❌ Ошибка очистки состояния:', error);
        }
    }

    /**
     * Проверка авторизации при инициализации
     */
    async checkExistingAuth() {
        if (this.restoreAuthState()) {
            console.log('👤 Найдена существующая авторизация');
            
            // Проверяем, что токен еще действителен
            try {
                // Простой тест токена
                const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?access_token=' + this.accessToken);
                if (response.ok) {
                    this.handleAuthSuccess();
                    return true;
                } else {
                    console.log('⚠️ Токен недействителен, очищаем состояние');
                    this.clearAuthState();
                    this.isSignedIn = false;
                    this.user = null;
                    this.accessToken = null;
                    this.credential = null;
                }
            } catch (error) {
                console.log('⚠️ Ошибка проверки токена, очищаем состояние');
                this.clearAuthState();
                this.isSignedIn = false;
                this.user = null;
                this.accessToken = null;
                this.credential = null;
            }
        }
        return false;
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoogleAuth;
} else {
    window.GoogleAuth = GoogleAuth;
}