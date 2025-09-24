/**
 * Google Authentication Module
 * Модуль авторизации Google
 */

/**
 * Google Authentication Class
 * Класс для работы с Google Identity Services
 */
class GoogleAuth {
    constructor(config) {
        this.config = config;
        this.clientId = config.clientId;
        this.isSignedIn = false;
        this.user = null;
        this.accessToken = null;
        this.credential = null;
        this.isInitialized = false;
        
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
            return false;
        }
    }

    /**
     * Загрузка Google Identity Services
     */
    async loadGoogleIdentityServices() {
        return new Promise((resolve, reject) => {
            if (window.google && window.google.accounts) {
                console.log('✅ Google Identity Services уже загружены');
                resolve();
                return;
            }

            console.log('📥 Загрузка Google Identity Services...');
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = () => {
                console.log('✅ Google Identity Services загружены');
                resolve();
            };
            script.onerror = () => {
                console.error('❌ Ошибка загрузки Google Identity Services');
                reject(new Error('Не удалось загрузить Google Identity Services'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Инициализация Google Identity Services
     */
    async initGoogleIdentityServices() {
        return new Promise((resolve, reject) => {
            try {
                console.log('🔧 Инициализация Google Identity Services...');
                
                window.google.accounts.id.initialize({
                    client_id: this.clientId,
                    callback: (response) => this.handleCredentialResponse(response),
                    auto_select: false,
                    cancel_on_tap_outside: true
                });
                
                console.log('✅ Google Identity Services инициализированы');
                resolve();
            } catch (error) {
                console.error('❌ Ошибка инициализации Google Identity Services:', error);
                reject(error);
            }
        });
    }

    /**
     * Обработка ответа авторизации
     */
    async handleCredentialResponse(response) {
        try {
            console.log('🔑 Получен ответ авторизации');
            
            if (!response.credential) {
                throw new Error('Не получен credential');
            }
            
            this.credential = response.credential;
            this.isSignedIn = true;
            
            // Декодируем JWT токен для получения информации о пользователе
            const payload = this.decodeJWT(response.credential);
            this.user = payload;
            
            console.log('✅ Пользователь авторизован:', payload.name);
            
            // Получаем токен доступа для Google Drive API
            await this.getAccessTokenForDrive();
            
            // Сохраняем состояние в localStorage ПОСЛЕ получения токена
            this.saveAuthState();
            
            // Вызываем успешную авторизацию только после получения токена
            this.handleAuthSuccess();
            
        } catch (error) {
            console.error('❌ Ошибка обработки авторизации:', error);
            this.handleAuthError(error.message);
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
            const tokenResponse = await this.getTokenFromGoogleIdentityServices();
            
            if (tokenResponse && tokenResponse.access_token) {
                this.accessToken = tokenResponse.access_token;
                console.log('✅ Токен доступа получен для Google Drive API');
            } else {
                throw new Error('Не удалось получить токен доступа');
            }
            
        } catch (error) {
            console.error('❌ Ошибка получения токена доступа:', error);
            throw error;
        }
    }

    /**
     * Получение токена через Google Identity Services
     */
    async getTokenFromGoogleIdentityServices() {
        return new Promise((resolve, reject) => {
            try {
                const tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: this.clientId,
                    scope: 'https://www.googleapis.com/auth/drive.file',
                    callback: (response) => {
                        if (response.access_token) {
                            console.log('✅ Токен получен через Google Identity Services');
                            resolve(response);
                        } else {
                            console.error('❌ Токен не получен');
                            reject(new Error('Не удалось получить токен доступа'));
                        }
                    }
                });
                
                tokenClient.requestAccessToken();
            } catch (error) {
                console.error('❌ Ошибка запроса токена:', error);
                reject(error);
            }
        });
    }

    /**
     * Декодирование JWT токена
     */
    decodeJWT(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            
            return JSON.parse(jsonPayload);
        } catch (error) {
            console.error('❌ Ошибка декодирования JWT:', error);
            return null;
        }
    }

    /**
     * Обработка успешной авторизации
     */
    handleAuthSuccess() {
        console.log('✅ Авторизация успешна');
        
        // Закрываем попап авторизации
        this.closeGoogleAuthPopup();
        
        // Сохраняем состояние
        this.saveAuthState();
        
        // Уведомляем о успешной авторизации
        if (this.onAuthSuccess) {
            this.onAuthSuccess(this.user);
        }
    }

    /**
     * Обработка ошибки авторизации
     */
    handleAuthError(message) {
        console.error('❌ Ошибка авторизации:', message);
        
        // Закрываем попап авторизации (кроме отмены пользователем)
        if (!message.includes('пользователь отменил') && !message.includes('popup_closed_by_user')) {
            this.closeGoogleAuthPopup();
        }
        
        // Уведомляем об ошибке
        if (this.onAuthError) {
            this.onAuthError(message);
        }
    }

    /**
     * Закрытие попапа авторизации Google
     */
    closeGoogleAuthPopup() {
        try {
            if (window.google && window.google.accounts && window.google.accounts.id) {
                window.google.accounts.id.cancel();
            }
            
            // Скрываем контейнер кнопки авторизации
            const signInContainer = document.getElementById('google-signin-container');
            if (signInContainer) {
                signInContainer.style.display = 'none';
                signInContainer.innerHTML = '';
            }
        } catch (error) {
            console.error('❌ Ошибка закрытия попапа:', error);
        }
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
     * Очистка состояния авторизации
     */
    clearAuthState() {
        this.isSignedIn = false;
        this.user = null;
        this.accessToken = null;
        this.credential = null;
        localStorage.removeItem('google_auth_state');
        console.log('🗑️ Состояние авторизации очищено');
    }

    /**
     * Проверка существующей авторизации
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

    /**
     * Вход в систему
     */
    async signIn() {
        try {
            if (!this.isInitialized) {
                throw new Error('Google Auth не инициализирован');
            }

            console.log('🔐 Запуск авторизации...');
            
            // Показываем контейнер для кнопки авторизации
            const signInContainer = document.getElementById('google-signin-container');
            if (signInContainer) {
                signInContainer.style.display = 'block';
            }
            
            // Создаем кнопку авторизации
            this.createSignInButton();
            
            // Показываем попап авторизации
            window.google.accounts.id.prompt();
            
        } catch (error) {
            console.error('❌ Ошибка входа в систему:', error);
            this.handleAuthError(error.message);
        }
    }

    /**
     * Создание кнопки авторизации Google
     */
    createSignInButton() {
        const signInContainer = document.getElementById('google-signin-container');
        if (!signInContainer) {
            console.error('❌ Контейнер для кнопки авторизации не найден');
            return;
        }

        try {
            window.google.accounts.id.renderButton(signInContainer, {
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                shape: 'rectangular',
                logo_alignment: 'left'
            });
        } catch (error) {
            console.error('❌ Ошибка создания кнопки авторизации:', error);
        }
    }

    /**
     * Выход из системы
     */
    signOut() {
        try {
            console.log('👋 Выход из системы...');
            
            // Очищаем состояние
            this.clearAuthState();
            
            // Закрываем попап авторизации
            this.closeGoogleAuthPopup();
            
            // Уведомляем о выходе
            if (this.onSignOut) {
                this.onSignOut();
            }
            
            console.log('✅ Выход из системы выполнен');
        } catch (error) {
            console.error('❌ Ошибка выхода из системы:', error);
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
     * Получение пользователя
     */
    getUser() {
        return this.user;
    }

    /**
     * Получение имени пользователя
     */
    getUserName() {
        if (this.user) {
            if (this.user.getBasicProfile) {
                return this.user.getBasicProfile().getName();
            } else if (this.user.name) {
                return this.user.name;
            }
        }
        return 'Пользователь';
    }
}

/**
 * Глобальный сервис авторизации
 * Управляет единым экземпляром GoogleAuth для всего приложения
 */
class AuthService {
    constructor() {
        this.auth = null;
        this.isInitialized = false;
        this.initializationPromise = null;
        
        // Callbacks
        this._authSuccessCallbacks = [];
        this._authErrorCallbacks = [];
        this._signOutCallbacks = [];
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
            
            // Проверяем доступность функции waitForEnvVars
            if (typeof waitForEnvVars === 'function') {
                // Ждем загрузки env-vars.js
                await waitForEnvVars();
            } else {
                console.warn('⚠️ Функция waitForEnvVars недоступна, пропускаем ожидание');
            }
            
            // Проверяем конфигурацию
            if (!config || !config.clientId) {
                throw new Error('Конфигурация не найдена или Client ID отсутствует');
            }
            
            if (config.clientId.includes('CLIENT_ID_PLACEHOLDER') || config.clientId.includes('YOUR_CLIENT_ID_HERE')) {
                throw new Error('Client ID не настроен. Проверьте env-vars.js и config.js');
            }
            
            console.log('✅ Конфигурация проверена, Client ID:', config.clientId.substring(0, 20) + '...');
            
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
                return true;
            } else {
                console.error('❌ Ошибка инициализации Google Auth');
                return false;
            }
            
        } catch (error) {
            console.error('❌ Критическая ошибка инициализации AuthService:', error);
            return false;
        }
    }

    /**
     * Получить экземпляр GoogleAuth
     */
    getAuth() {
        if (!this.isInitialized) {
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
        const user = this.getUser();
        if (user) {
            if (user.getBasicProfile) {
                return user.getBasicProfile().getName();
            } else if (user.name) {
                return user.name;
            }
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
                    // Восстанавливаем токен в auth для будущих вызовов
                    if (this.auth) {
                        this.auth.accessToken = authState.accessToken;
                    }
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
        if (!this.isInitialized) {
            throw new Error('AuthService не инициализирован');
        }
        return await this.auth.signIn();
    }

    /**
     * Выйти из системы
     */
    signOut() {
        if (!this.isInitialized) {
            throw new Error('AuthService не инициализирован');
        }
        this.auth.signOut();
    }

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

// Функция waitForEnvVars определена в config.js

// Создаем глобальный экземпляр AuthService
window.authService = new AuthService();

// Экспорт для использования в модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GoogleAuth, AuthService };
}
