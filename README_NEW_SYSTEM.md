# 🚀 iOS Windrose Матрица - Новая система с Google Drive API

## 📋 Обзор

Новая модульная система для работы с Google Drive API, созданная на чистом JavaScript. Поддерживает авторизацию через OAuth 2.0, загрузку и сохранение файлов оценок.

## 🏗️ Архитектура

### Модули:
- **`auth.js`** - Авторизация через Google OAuth 2.0
- **`drive.js`** - Операции с Google Drive API
- **`file-manager.js`** - UI компонент для работы с файлами
- **`config.js`** - Конфигурация системы
- **`env-vars.js`** - Переменные окружения

### Страницы:
- **`instructions.html`** - Инструкции с авторизацией
- **`evaluation.html`** - Форма оценки с интеграцией Google Drive

## 🔧 Настройка

### 1. Google Cloud Console

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект или выберите существующий
3. Включите Google Drive API:
   - APIs & Services > Library
   - Найдите "Google Drive API"
   - Нажмите "Enable"

### 2. OAuth 2.0 Credentials

1. Перейдите в APIs & Services > Credentials
2. Нажмите "Create Credentials" > "OAuth 2.0 Client ID"
3. Выберите "Web application"
4. Добавьте Authorized JavaScript origins:
   - `https://yourdomain.com`
   - `http://localhost` (для разработки)
5. Сохраните Client ID

### 3. Настройка файлов

#### Для локальной разработки (env-vars.js):
```javascript
window.CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
window.CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
window.PROJECT_ID = 'YOUR_PROJECT_ID';
window.GOOGLE_DRIVE_FOLDER_ID = 'your-folder-id';
window.GOOGLE_DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/your-folder-id';
```

#### Для продакшена (GitHub Secrets):
Настройте секреты в GitHub Repository Settings > Secrets and variables > Actions:
- `CLIENT_ID` - ваш Google OAuth Client ID
- `CLIENT_SECRET` - ваш Google OAuth Client Secret  
- `PROJECT_ID` - ваш Google Cloud Project ID

Файл `env-vars.js` автоматически генерируется при деплое из этих секретов.

#### config.js (автоматически работает):
```javascript
const config = {
    clientId: window.CLIENT_ID,        // Из env-vars.js
    clientSecret: window.CLIENT_SECRET, // Из env-vars.js
    projectId: window.PROJECT_ID,      // Из env-vars.js
    folderId: window.GOOGLE_DRIVE_FOLDER_ID,
    folderUrl: window.GOOGLE_DRIVE_FOLDER_URL,
    filePrefix: 'ios-windrose-evaluation'
};
```

## 🎯 Функциональность

### 1. Авторизация
- Кнопка "🔐 Авторизоваться и начать оценку" на странице инструкций
- OAuth 2.0 авторизация через Google
- Автоматический переход на страницу оценки после авторизации
- Обработка ошибок авторизации

### 2. Загрузка файлов
- Кнопка "📥 Загрузить файл оценки" на странице оценки
- Модальное окно с списком файлов из Google Drive
- Фильтрация по типу файлов (JSON)
- Прямая загрузка и заполнение формы
- Индикатор загрузки

### 3. Сохранение файлов
- Кнопка "📤 Сохранить файл оценки" на странице оценки
- Прямая загрузка в указанную папку Google Drive
- Автоматическое именование файлов
- Обработка ошибок сохранения

## 🎨 UI/UX

### Дизайн:
- Современный Material Design
- Адаптивная верстка
- Анимации и переходы
- Индикаторы загрузки
- Уведомления об ошибках

### Компоненты:
- Модальные окна
- Селектор файлов
- Индикаторы прогресса
- Система уведомлений

## 🔒 Безопасность

- OAuth 2.0 авторизация
- Токены доступа с ограниченным временем жизни
- Автоматическое обновление токенов
- Обработка ошибок авторизации
- Валидация конфигурации

## 📱 Совместимость

- Все современные браузеры
- Мобильные устройства
- Планшеты
- Десктоп

## 🐛 Отладка

### Консоль браузера:
```javascript
// Проверка авторизации
console.log('Auth status:', auth.isSignedIn);

// Проверка токена
console.log('Access token:', auth.getAccessToken());

// Проверка конфигурации
console.log('Config:', config);
```

### Частые ошибки:
- **401 Unauthorized**: Проверьте Client ID и настройки OAuth
- **403 Forbidden**: Проверьте права доступа к папке
- **CORS ошибки**: Проверьте Authorized JavaScript origins

## 🚀 Развертывание

### Локальная разработка:
```bash
# Запустите локальный сервер
python -m http.server 8000
# или
npx serve .
```

### Продакшн:
1. Загрузите файлы на веб-сервер
2. Настройте HTTPS (обязательно для OAuth)
3. Обновите Authorized JavaScript origins
4. Проверьте работу авторизации

## 📚 API Документация

### GoogleAuth
```javascript
const auth = new GoogleAuth(config);
await auth.initialize();
await auth.signIn();
const token = auth.getAccessToken();
```

### GoogleDrive
```javascript
const drive = new GoogleDrive(config, auth);
await drive.getFiles();
await drive.uploadFile(content, filename);
await drive.downloadFile(fileId);
```

### FileManager
```javascript
const fileManager = new FileManager(drive);
await fileManager.showFileSelector();
fileManager.onFileLoaded = (data) => { /* обработка */ };
```

## 🤝 Поддержка

При возникновении проблем:
1. Проверьте консоль браузера на ошибки
2. Убедитесь в правильности настройки Google API
3. Проверьте права доступа к папке Google Drive
4. Обратитесь к документации Google Drive API

## 📄 Лицензия

MIT License - используйте свободно для своих проектов.
