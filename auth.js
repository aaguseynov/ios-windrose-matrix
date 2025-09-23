/**
 * Google OAuth 2.0 Authorization Module
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
        
        // Callbacks
        this.onAuthSuccess = null;
        this.onAuthError = null;
        this.onSignOut = null;
    }

    /**
     * Инициализация Google API
     */
    async initialize() {
        try {
            console.log('🔧 Инициализация Google Auth API...');
            
            // Проверяем наличие Client ID
            if (!this.clientId || this.clientId.includes('CLIENT_ID_PLACEHOLDER') || this.clientId.includes('YOUR_CLIENT_ID_HERE')) {
                throw new Error('Client ID не настроен. Убедитесь, что env-vars.js загружен корректно.');
            }
            
            // Загружаем Google API
            await this.loadGoogleAPI();
            
            // Инициализируем gapi
            await this.initGapi();
            
            this.isInitialized = true;
            console.log('✅ Google Auth API инициализирован');
            
            return true;
        } catch (error) {
            console.error('❌ Ошибка инициализации Google Auth:', error);
            this.handleAuthError(error);
            return false;
        }
    }

    /**
     * Загрузка Google API скрипта
     */
    loadGoogleAPI() {
        return new Promise((resolve, reject) => {
            // Проверяем, не загружен ли уже
            if (window.gapi) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Инициализация gapi
     */
    initGapi() {
        return new Promise((resolve, reject) => {
            gapi.load('client:auth2', {
                callback: async () => {
                    try {
                        await gapi.client.init({
                            clientId: this.clientId,
                            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
                            scope: this.scope
                        });
                        
                        // Получаем экземпляр авторизации
                        this.authInstance = gapi.auth2.getAuthInstance();
                        
                        // Проверяем текущий статус авторизации
                        this.updateAuthStatus();
                        
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                },
                onerror: reject
            });
        });
    }

    /**
     * Обновление статуса авторизации
     */
    updateAuthStatus() {
        if (!this.authInstance) return;
        
        this.isSignedIn = this.authInstance.isSignedIn.get();
        
        if (this.isSignedIn) {
            this.user = this.authInstance.currentUser.get();
            this.accessToken = this.user.getAuthResponse().access_token;
            console.log('👤 Пользователь авторизован:', this.user.getBasicProfile().getName());
        } else {
            this.user = null;
            this.accessToken = null;
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

            if (!this.authInstance) {
                throw new Error('Google Auth не инициализирован');
            }

            if (this.isSignedIn) {
                console.log('👤 Пользователь уже авторизован');
                this.handleAuthSuccess();
                return true;
            }

            console.log('🔐 Запрос авторизации...');
            this.showLoadingIndicator('Авторизация в Google...');

            const user = await this.authInstance.signIn();
            this.updateAuthStatus();
            
            console.log('✅ Авторизация успешна:', user.getBasicProfile().getName());
            this.hideLoadingIndicator();
            this.handleAuthSuccess();
            
            return true;
        } catch (error) {
            console.error('❌ Ошибка авторизации:', error);
            this.hideLoadingIndicator();
            this.handleAuthError(error);
            return false;
        }
    }

    /**
     * Выход из системы
     */
    async signOut() {
        try {
            if (!this.authInstance) return;
            
            await this.authInstance.signOut();
            this.updateAuthStatus();
            
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
        if (!this.isSignedIn || !this.user) {
            throw new Error('Пользователь не авторизован');
        }

        const authResponse = this.user.getAuthResponse();
        
        // Проверяем, не истек ли токен
        if (authResponse.expires_at && Date.now() >= authResponse.expires_at) {
            console.log('🔄 Токен истек, обновляем...');
            return this.refreshToken();
        }

        return authResponse.access_token;
    }

    /**
     * Обновление токена
     */
    async refreshToken() {
        try {
            await this.user.reloadAuthResponse();
            this.updateAuthStatus();
            return this.accessToken;
        } catch (error) {
            console.error('❌ Ошибка обновления токена:', error);
            throw error;
        }
    }

    /**
     * Обработка успешной авторизации
     */
    handleAuthSuccess() {
        if (this.onAuthSuccess) {
            this.onAuthSuccess(this.user);
        }
    }

    /**
     * Обработка ошибки авторизации
     */
    handleAuthError(error) {
        let message = 'Ошибка авторизации';
        
        if (error.error === 'popup_closed_by_user') {
            message = 'Авторизация отменена пользователем';
        } else if (error.error === 'access_denied') {
            message = 'Доступ запрещен. Проверьте настройки Google API';
        } else if (error.error === 'invalid_client') {
            message = 'Неверный Client ID. Проверьте настройки в config.js';
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
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoogleAuth;
} else {
    window.GoogleAuth = GoogleAuth;
}
