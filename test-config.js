// Тестовая конфигурация для локального тестирования
const config = {
    // Google OAuth Credentials - для тестирования используем пустые значения
    clientId: window.CLIENT_ID || '',
    clientSecret: window.CLIENT_SECRET || '',
    projectId: window.PROJECT_ID || '',
    
    // Google Drive Settings - используем дефолтные значения
    folderId: window.GOOGLE_DRIVE_FOLDER_ID || '14RzE0Souwr-gzb5D0sNqsPH6nMI0J3Ae',
    folderUrl: window.GOOGLE_DRIVE_FOLDER_URL || 'https://drive.google.com/drive/folders/14RzE0Souwr-gzb5D0sNqsPH6nMI0J3Ae?usp=drive_link',
    
    // File Settings
    filePrefix: 'ios-windrose-evaluation'
};

// Экспортируем конфигурацию
if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
} else {
    window.config = config;
}
