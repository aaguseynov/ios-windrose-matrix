// Конфигурация для Google Drive API
// Использует только переменные окружения - никаких дефолтных значений

const config = {
    // Google OAuth Credentials
    // Только из переменных окружения
    clientId: process.env.CLIENT_ID || 
              (typeof window !== 'undefined' && window.CLIENT_ID),
              
    clientSecret: process.env.CLIENT_SECRET || 
                  (typeof window !== 'undefined' && window.CLIENT_SECRET),
                  
    projectId: process.env.PROJECT_ID || 
               (typeof window !== 'undefined' && window.PROJECT_ID),
    
    // Google Drive Settings
    // Эти значения не секретные, можно использовать дефолтные
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || 
              (typeof window !== 'undefined' && window.GOOGLE_DRIVE_FOLDER_ID) ||
              '14RzE0Souwr-gzb5D0sNqsPH6nMI0J3Ae',
              
    folderUrl: process.env.GOOGLE_DRIVE_FOLDER_URL || 
               (typeof window !== 'undefined' && window.GOOGLE_DRIVE_FOLDER_URL) ||
               'https://drive.google.com/drive/folders/14RzE0Souwr-gzb5D0sNqsPH6nMI0J3Ae?usp=drive_link',
    
    // File Settings
    filePrefix: 'ios-windrose-evaluation'
};

// Экспортируем конфигурацию
if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
} else {
    window.config = config;
}
