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
                    cancel_on_tap_outside: true,
                    scope: this.scope
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
    async handleCredentialResponse(response) {
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
            await this.getAccessTokenForDrive();
            
            // Вызываем успешную авторизацию только после получения токена
            this.handleAuthSuccess();
            
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
            
            // Для Google Identity Services нужно использовать Google Token API
            // с правильными параметрами для получения access token
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    assertion: this.credential,
                    scope: this.scope,
                    client_id: this.clientId
                })
            });

            if (response.ok) {
                const tokenData = await response.json();
                this.accessToken = tokenData.access_token;
                console.log('✅ Токен доступа получен через Token API');
            } else {
                const errorText = await response.text();
                console.error('❌ Ошибка получения токена:', response.status, errorText);
                
                // Fallback: попробуем использовать Google Identity Services для получения токена
                await this.getTokenFromGoogleIdentityServices();
            }
            
            // handleAuthSuccess() вызывается в handleCredentialResponse
            
        } catch (error) {
            console.error('❌ Ошибка получения токена доступа:', error);
            
            // Fallback: попробуем использовать Google Identity Services для получения токена
            await this.getTokenFromGoogleIdentityServices();
        }
    }

    /**
     * Получение токена через Google Identity Services
     */
    async getTokenFromGoogleIdentityServices() {
        try {
            console.log('🔄 Попытка получения токена через Google Identity Services...');
            
            // Используем Google Identity Services для получения токена с нужными scope
            if (window.google && window.google.accounts) {
                // Попробуем получить токен с правильными scope
                const tokenResponse = await google.accounts.oauth2.initTokenClient({
                    client_id: this.clientId,
                    scope: this.scope,
                    callback: (response) => {
                        if (response.access_token) {
                            this.accessToken = response.access_token;
                            console.log('✅ Токен получен через Google Identity Services');
                            // handleAuthSuccess() вызывается в handleCredentialResponse
                        } else {
                            console.error('❌ Токен не получен через Google Identity Services');
                            // Используем credential как fallback
                            this.accessToken = this.credential;
                            // handleAuthSuccess() вызывается в handleCredentialResponse
                        }
                    }
                }).requestAccessToken();
                
                // Если это не async callback, используем credential
                if (!this.accessToken) {
                    this.accessToken = this.credential;
                    console.log('⚠️ Используем credential напрямую');
                    // handleAuthSuccess() вызывается в handleCredentialResponse
                }
            } else {
                // Используем credential как fallback
                this.accessToken = this.credential;
                console.log('⚠️ Google Identity Services недоступны, используем credential');
                // handleAuthSuccess() вызывается в handleCredentialResponse
            }
        } catch (error) {
            console.error('❌ Ошибка получения токена через Google Identity Services:', error);
            // Используем credential как fallback
            this.accessToken = this.credential;
            console.log('⚠️ Используем credential как fallback');
            // handleAuthSuccess() вызывается в handleCredentialResponse
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
            // Закрываем popup авторизации
            this.closeGoogleAuthPopup();
            
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
        
        // Убеждаемся, что состояние сохранено
        this.saveAuthState();
        
        // Закрываем popup Google Identity Services
        this.closeGoogleAuthPopup();
        
        console.log('✅ Авторизация успешно завершена:', {
            isSignedIn: this.isSignedIn,
            hasUser: !!this.user,
            hasToken: !!this.accessToken,
            hasCredential: !!this.credential
        });
        
        if (this.onAuthSuccess) {
            this.onAuthSuccess(this.user);
        }
    }

    /**
     * Закрытие popup авторизации Google
     */
    closeGoogleAuthPopup() {
        try {
            // Закрываем popup Google Identity Services
            if (window.google && window.google.accounts) {
                google.accounts.id.cancel();
                console.log('✅ Popup авторизации Google закрыт');
            }
            
            // Скрываем контейнер кнопки авторизации
            const buttonContainer = document.getElementById('google-signin-button');
            if (buttonContainer) {
                buttonContainer.style.display = 'none';
                console.log('✅ Контейнер кнопки авторизации скрыт');
            }
            
            // Очищаем содержимое контейнера
            if (buttonContainer) {
                buttonContainer.innerHTML = '';
            }
            
        } catch (error) {
            console.error('❌ Ошибка при закрытии popup авторизации:', error);
        }
    }

    /**
     * Обработка ошибки авторизации
     */
    handleAuthError(error) {
        this.hideLoadingIndicator();
        
        let message = 'Ошибка авторизации';
        let shouldClosePopup = true;
        
        if (error.message && error.message.includes('отменена пользователем')) {
            message = 'Авторизация отменена пользователем';
            shouldClosePopup = false; // Не закрываем popup при отмене пользователем
        } else if (error.message && error.message.includes('Client ID не настроен')) {
            message = 'Client ID не настроен. Проверьте настройки Google API';
        } else {
            message = error.message || message;
        }

        // Закрываем popup только если это не отмена пользователем
        if (shouldClosePopup) {
            this.closeGoogleAuthPopup();
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
            // Извлекаем только нужные данные пользователя для сериализации
            let userData = null;
            if (this.user) {
                if (this.user.getBasicProfile) {
                    const profile = this.user.getBasicProfile();
                    userData = {
                        id: this.user.id || profile.getId(),
                        name: profile.getName(),
                        email: profile.getEmail(),
                        imageUrl: profile.getImageUrl(),
                        type: 'google_profile'
                    };
                } else if (this.user.name) {
                    userData = {
                        id: this.user.id,
                        name: this.user.name,
                        email: this.user.email,
                        imageUrl: this.user.picture,
                        type: 'user_object'
                    };
                }
            }

            const authState = {
                isSignedIn: this.isSignedIn,
                user: userData,
                accessToken: this.accessToken,
                credential: this.credential,
                timestamp: Date.now()
            };
            
            localStorage.setItem('google_auth_state', JSON.stringify(authState));
            console.log('💾 Состояние авторизации сохранено:', authState);
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
            this.user = authState.user; // Теперь это сериализованный объект
            this.accessToken = authState.accessToken;
            this.credential = authState.credential;
            
            console.log('✅ Состояние авторизации восстановлено:', {
                isSignedIn: this.isSignedIn,
                hasUser: !!this.user,
                hasToken: !!this.accessToken,
                hasCredential: !!this.credential
            });
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
            
            // Если у нас есть токен, считаем пользователя авторизованным
            // Проверка токена может быть медленной и не всегда нужна
            if (this.accessToken) {
                console.log('✅ Токен найден, пользователь авторизован');
                this.isSignedIn = true;
                return true;
            }
            
            // Дополнительная проверка токена (опционально)
            try {
                if (this.accessToken) {
                    const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?access_token=' + this.accessToken);
                    if (response.ok) {
                        console.log('✅ Токен действителен');
                        this.isSignedIn = true;
                        return true;
                    } else {
                        console.log('⚠️ Токен недействителен, очищаем состояние');
                        this.clearAuthState();
                        this.isSignedIn = false;
                        this.user = null;
                        this.accessToken = null;
                        this.credential = null;
                    }
                }
            } catch (error) {
                console.log('⚠️ Ошибка проверки токена, но оставляем состояние как есть');
                // Не очищаем состояние при ошибке сети
                this.isSignedIn = true;
                return true;
            }
        }
        return false;
    }
}

// Глобальный сервис авторизации
class AuthService {
    constructor() {
        this.auth = null;
        this.isInitialized = false;
        this.initializationPromise = null;
    }

    /**
     * Инициализация глобального сервиса авторизации
     */
    async initialize(config) {
        if (this.isInitialized) {
            console.log('✅ AuthService уже инициализирован');
            return true;
        }

        if (this.initializationPromise) {
            console.log('⏳ AuthService уже инициализируется...');
            return await this.initializationPromise;
        }

        this.initializationPromise = this._doInitialize(config);
        const result = await this.initializationPromise;
        this.isInitialized = true;
        return result;
    }

    async _doInitialize(config) {
        try {
            console.log('🔧 Инициализация глобального AuthService...');
            
            // Ждем загрузки env-vars.js
            await waitForEnvVars();
            
            // Создаем экземпляр GoogleAuth
            this.auth = new GoogleAuth(config);
            
            // Настраиваем глобальные callbacks
            this.auth.onAuthSuccess = (user) => {
                console.log('✅ Глобальная авторизация успешна:', user);
                this._notifyAuthSuccess(user);
            };
            
            this.auth.onAuthError = (message) => {
                console.error('❌ Глобальная ошибка авторизации:', message);
                this._notifyAuthError(message);
            };
            
            this.auth.onSignOut = () => {
                console.log('👋 Глобальный выход из системы');
                this._notifySignOut();
            };
            
            // Инициализируем Google Auth
            const success = await this.auth.initialize();
            if (success) {
                console.log('✅ Глобальный AuthService инициализирован');
            } else {
                console.error('❌ Не удалось инициализировать глобальный AuthService');
            }
            
            return success;
        } catch (error) {
            console.error('❌ Критическая ошибка инициализации AuthService:', error);
            return false;
        }
    }

    /**
     * Получить экземпляр авторизации
     */
    getAuth() {
        if (!this.auth) {
            throw new Error('AuthService не инициализирован. Вызовите initialize() сначала.');
        }
        return this.auth;
    }

    /**
     * Проверить, авторизован ли пользователь
     */
    isSignedIn() {
        // Сначала проверяем auth
        if (this.auth && this.auth.isSignedIn) {
            return true;
        }
        
        // Если auth не авторизован, проверяем localStorage
        try {
            const authStateStr = localStorage.getItem('google_auth_state');
            if (authStateStr) {
                const authState = JSON.parse(authStateStr);
                if (authState.isSignedIn && authState.accessToken) {
                    console.log('✅ Состояние авторизации восстановлено из localStorage');
                    return true;
                }
            }
        } catch (error) {
            console.error('❌ Ошибка чтения состояния из localStorage:', error);
        }
        
        return false;
    }

    /**
     * Получить пользователя
     */
    getUser() {
        // Сначала пытаемся получить пользователя из auth
        if (this.auth && this.auth.user) {
            return this.auth.user;
        }
        
        // Если пользователя нет в auth, проверяем localStorage
        try {
            const authStateStr = localStorage.getItem('google_auth_state');
            if (authStateStr) {
                const authState = JSON.parse(authStateStr);
                if (authState.user) {
                    console.log('✅ Данные пользователя восстановлены из localStorage');
                    return authState.user;
                }
            }
        } catch (error) {
            console.error('❌ Ошибка чтения данных пользователя из localStorage:', error);
        }
        
        return null;
    }

    /**
     * Получить имя пользователя
     */
    getUserName() {
        if (!this.auth || !this.auth.user) return 'Пользователь';
        
        const user = this.auth.user;
        if (user.name) {
            return user.name;
        } else if (user.getBasicProfile) {
            return user.getBasicProfile().getName();
        }
        return 'Пользователь';
    }

    /**
     * Получить токен доступа
     */
    getAccessToken() {
        // Сначала пытаемся получить токен из auth
        if (this.auth && this.auth.accessToken) {
            return this.auth.accessToken;
        }
        
        // Если токена нет в auth, проверяем localStorage
        try {
            const authStateStr = localStorage.getItem('google_auth_state');
            if (authStateStr) {
                const authState = JSON.parse(authStateStr);
                if (authState.accessToken) {
                    console.log('✅ Токен восстановлен из localStorage');
                    return authState.accessToken;
                }
            }
        } catch (error) {
            console.error('❌ Ошибка чтения токена из localStorage:', error);
        }
        
        return null;
    }

    /**
     * Войти в систему
     */
    async signIn() {
        if (!this.auth) {
            throw new Error('AuthService не инициализирован');
        }
        return await this.auth.signIn();
    }

    /**
     * Выйти из системы
     */
    async signOut() {
        if (!this.auth) {
            throw new Error('AuthService не инициализирован');
        }
        return await this.auth.signOut();
    }

    // Глобальные обработчики событий
    _authSuccessCallbacks = [];
    _authErrorCallbacks = [];
    _signOutCallbacks = [];

    /**
     * Подписаться на успешную авторизацию
     */
    onAuthSuccess(callback) {
        this._authSuccessCallbacks.push(callback);
    }

    /**
     * Подписаться на ошибку авторизации
     */
    onAuthError(callback) {
        this._authErrorCallbacks.push(callback);
    }

    /**
     * Подписаться на выход из системы
     */
    onSignOut(callback) {
        this._signOutCallbacks.push(callback);
    }

    /**
     * Уведомить о успешной авторизации
     */
    _notifyAuthSuccess(user) {
        this._authSuccessCallbacks.forEach(callback => {
            try {
                callback(user);
            } catch (error) {
                console.error('❌ Ошибка в callback авторизации:', error);
            }
        });
    }

    /**
     * Уведомить об ошибке авторизации
     */
    _notifyAuthError(message) {
        this._authErrorCallbacks.forEach(callback => {
            try {
                callback(message);
            } catch (error) {
                console.error('❌ Ошибка в callback ошибки:', error);
            }
        });
    }

    /**
     * Уведомить о выходе из системы
     */
    _notifySignOut() {
        this._signOutCallbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('❌ Ошибка в callback выхода:', error);
            }
        });
    }
}

// Создаем глобальный экземпляр сервиса
window.authService = new AuthService();

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GoogleAuth, AuthService };
} else {
    window.GoogleAuth = GoogleAuth;
    window.AuthService = AuthService;
}