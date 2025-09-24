/**
 * Конфигурация Google API
 * 
 * НАСТРОЙКА:
 * 1. Перейдите в Google Cloud Console: https://console.cloud.google.com/
 * 2. Создайте новый проект или выберите существующий
 * 3. Включите Google Drive API
 * 4. Создайте OAuth 2.0 Client ID для веб-приложения
 * 5. Добавьте ваш домен в Authorized JavaScript origins
 * 
 * Для локальной разработки:
 * - env-vars.js загружается с продакшена
 * 
 * Для продакшена:
 * - Настройте GitHub Secrets в репозитории
 * - Файл env-vars.js генерируется автоматически при деплое
 */

// Функция для ожидания загрузки env-vars.js
function waitForEnvVars() {
    return new Promise((resolve) => {
        const checkEnvVars = () => {
            if (window.CLIENT_ID && !window.CLIENT_ID.includes('CLIENT_ID_PLACEHOLDER')) {
                resolve();
            } else {
                setTimeout(checkEnvVars, 100);
            }
        };
        checkEnvVars();
    });
}

const config = {
    // Google OAuth 2.0 Client ID
    // Получается из env-vars.js (генерируется автоматически при деплое)
    clientId: (typeof window !== 'undefined' && window.CLIENT_ID) || 
              'CLIENT_ID_PLACEHOLDER',
    
    // Google OAuth 2.0 Client Secret
    clientSecret: (typeof window !== 'undefined' && window.CLIENT_SECRET) || 
                  'CLIENT_SECRET_PLACEHOLDER',
    
    // Google Cloud Project ID
    projectId: (typeof window !== 'undefined' && window.PROJECT_ID) || 
               'PROJECT_ID_PLACEHOLDER',
    
    // ID папки в Google Drive для сохранения файлов
    folderId: (typeof window !== 'undefined' && window.GOOGLE_DRIVE_FOLDER_ID) || 
              '14RzE0Souwr-gzb5D0sNqsPH6nMI0J3Ae',
    
    // URL папки Google Drive (для прямых ссылок)
    folderUrl: (typeof window !== 'undefined' && window.GOOGLE_DRIVE_FOLDER_URL) || 
               'https://drive.google.com/drive/folders/14RzE0Souwr-gzb5D0sNqsPH6nMI0J3Ae?usp=drive_link',
    
    // Префикс для файлов оценок
    filePrefix: 'ios-windrose-evaluation',
    
    // Настройки приложения
    app: {
        name: 'iOS Windrose Матрица',
        version: '2.0.0',
        description: 'Система оценки технических компетенций iOS разработчиков'
    },
    
    // Настройки Google Drive API
    drive: {
        // Размер страницы для получения файлов
        pageSize: 100,
        
        // Типы файлов для загрузки
        allowedMimeTypes: [
            'application/json',
            'text/plain'
        ],
        
        // Максимальный размер файла (в байтах)
        maxFileSize: 35 * 1024 * 1024, // 35MB
    },
    
    // Настройки UI
    ui: {
        // Тема приложения
        theme: {
            primary: '#4285f4',
            success: '#48bb78',
            error: '#f56565',
            warning: '#ed8936',
            info: '#4299e1'
        },
        
        // Настройки уведомлений
        notifications: {
            duration: 4000, // 4 секунды
            position: 'top-right'
        },
        
        // Настройки модальных окон
        modals: {
            maxWidth: '600px',
            animation: 'fade'
        }
    }
};

// Валидация конфигурации
function validateConfig() {
    const errors = [];
    
    if (!config.clientId || 
        config.clientId.includes('CLIENT_ID_PLACEHOLDER') || 
        config.clientId.includes('YOUR_CLIENT_ID_HERE')) {
        errors.push('Не установлен Client ID. Получите его в Google Cloud Console.');
    }
    
    if (!config.folderId || config.folderId.includes('YOUR_FOLDER_ID_HERE')) {
        errors.push('Не установлен ID папки Google Drive.');
    }
    
    if (errors.length > 0) {
        console.error('❌ Ошибки конфигурации:');
        errors.forEach(error => console.error('  -', error));
        console.error('📖 Для локальной разработки: настройте env-vars.js');
        console.error('📖 Для продакшена: настройте GitHub Secrets');
        console.error('📖 Инструкция по настройке: https://console.cloud.google.com/');
        return false;
    }
    
    return true;
}

// Проверяем конфигурацию при загрузке
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        // Проверяем, загружен ли env-vars.js
        const hasEnvVars = window.CLIENT_ID && !window.CLIENT_ID.includes('CLIENT_ID_PLACEHOLDER');
        
        if (!hasEnvVars) {
            console.warn('⚠️ env-vars.js не найден или не настроен');
            console.log('📖 Для локальной разработки: создайте файл env-vars.js');
            console.log('📖 Для продакшена: настройте GitHub Secrets');
            
            // Показываем предупреждение пользователю
            const warning = document.createElement('div');
            warning.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                background: #f56565;
                color: white;
                padding: 10px;
                text-align: center;
                z-index: 10000;
                font-weight: 600;
            `;
            warning.innerHTML = `
                ⚠️ Google API не настроен. Проверьте конфигурацию или настройте GitHub Secrets
            `;
            document.body.appendChild(warning);
        } else if (!validateConfig()) {
            console.error('❌ Ошибка конфигурации Google API');
        } else {
            console.log('✅ Google API настроен корректно');
        }
    });
}

// Экспорт конфигурации
if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
} else {
    window.config = config;
}