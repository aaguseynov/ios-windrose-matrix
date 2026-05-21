/**
 * UI Manager
 * Управление интерфейсом и связывание с данными
 * Простая и надежная система обновления UI
 */

class UIManager {
    constructor() {
        this.dataManager = null;
        this.chartManager = null;
        this.isInitialized = false;
    }
    
    /**
     * Инициализация UI Manager
     */
    initialize() {
        if (this.isInitialized) {
            console.log('⚠️ UIManager уже инициализирован');
            return;
        }
        
        console.log('🔧 Инициализация UIManager...');
        
        // Связываемся с DataManager
        this.dataManager = window.dataManager;
        
        if (!this.dataManager) {
            console.error('❌ DataManager не найден!');
            console.log('🔍 Доступные глобальные объекты:', Object.keys(window).filter(k => k.includes('Manager') || k.includes('data')));
            return;
        }
        
        console.log('✅ DataManager найден:', this.dataManager);
        
        // Привязываем обработчики
        this.dataManager.onDataChanged = (data) => this.updateUI(data);
        this.dataManager.onDataLoaded = (data) => this.onDataLoaded(data);
        
        console.log('✅ UIManager связан с DataManager');
        
        // Инициализируем обработчики событий
        this.initializeEventHandlers();
        
        // Инициализируем Chart Manager
        this.initializeChartManager();
        
        this.isInitialized = true;
        console.log('✅ UIManager инициализирован');
    }
    
    /**
     * Инициализация обработчиков событий
     */
    initializeEventHandlers() {
        console.log('🔧 Инициализация обработчиков событий...');
        
        // Обработчики для полей ввода
        document.addEventListener('input', (event) => {
            if (event.target.classList.contains('evaluation-input')) {
                this.handleInputChange(event.target);
            }
        });
        
        // Обработчик изменения разработчика
        const developerSelect = document.getElementById('developer-profile');
        if (developerSelect) {
            developerSelect.addEventListener('change', (event) => {
                this.handleDeveloperChange(event.target.value);
            });
        }
        
        console.log('✅ Обработчики событий инициализированы');
    }
    
    /**
     * Инициализация Chart Manager
     */
    initializeChartManager() {
        if (typeof ChartManager !== 'undefined') {
            this.chartManager = new ChartManager();
            console.log('✅ ChartManager инициализирован');
        } else {
            console.log('⚠️ ChartManager не найден');
        }
    }
    
    /**
     * Обработка изменения поля ввода
     */
    handleInputChange(input) {
        const competencyKey = input.dataset.competency;
        const levelKey = input.dataset.level;
        const type = input.dataset.type;
        
        if (!competencyKey || !levelKey || !type) {
            console.warn('⚠️ Поле ввода без data-атрибутов:', input);
            return;
        }
        
        const value = input.value;
        
        // Обновляем данные
        this.dataManager.updateEvaluation(competencyKey, levelKey, type, value);
        
        console.log(`📝 Обновлено ${competencyKey}.${levelKey}.${type}:`, value);
    }
    
    /**
     * Обработка изменения разработчика
     */
    handleDeveloperChange(developerKey) {
        if (!developerKey) {
            console.log('⚠️ Разработчик не выбран');
            return;
        }
        
        console.log('👤 Изменен разработчик:', developerKey);
        
        // Создаем новые данные для разработчика
        this.dataManager.createNewData(developerKey);
        
        // Обновляем UI
        this.updateDeveloperInfo(developerKey);
    }
    
    /**
     * Загрузка данных в UI
     */
    loadDataIntoUI(data) {
        console.log('📊 Загрузка данных в UI:', data);
        console.log('📊 Структура данных:', {
            developer: data.developer,
            competencies: Object.keys(data.competencies || {}),
            hasCompetencies: !!data.competencies
        });
        
        try {
            // Устанавливаем разработчика
            const developerSelect = document.getElementById('developer-profile');
            if (developerSelect && data.developer) {
                developerSelect.value = data.developer;
                this.updateDeveloperInfo(data.developer);
                console.log('✅ Разработчик установлен:', data.developer);
            } else {
                console.warn('⚠️ Селект разработчика не найден или данные разработчика отсутствуют');
            }
            
            // Загружаем данные в поля
            this.loadEvaluationsIntoFields(data);
            
            // Обновляем диаграммы
            this.updateCharts(data);
            
            // Обновляем статистику
            this.updateStatistics();
            
            // Принудительно обновляем кнопки и UI (если функция доступна)
            if (typeof updateButtons === 'function') {
                updateButtons();
                console.log('✅ Кнопки обновлены');
            }
            
            // Принудительно обновляем прогресс (если функция доступна)
            if (typeof calculateProgress === 'function') {
                calculateProgress();
                console.log('✅ Прогресс пересчитан');
            }
            
            console.log('✅ Данные успешно загружены в UI');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных в UI:', error);
            throw error;
        }
    }
    
    /**
     * Загрузка оценок в поля ввода
     */
    loadEvaluationsIntoFields(data) {
        if (!data.competencies) {
            console.warn('⚠️ Нет компетенций для загрузки');
            return;
        }
        
        console.log('📝 Начинаем загрузку оценок в поля...');
        
        // Диагностика: проверяем, сколько полей найдено
        const allInputs = document.querySelectorAll('.evaluation-input');
        console.log(`🔍 Всего найдено полей с классом 'evaluation-input': ${allInputs.length}`);
        
        const selfInputs = document.querySelectorAll('.evaluation-input[data-type="self"]');
        console.log(`🔍 Найдено полей самооценки: ${selfInputs.length}`);
        
        const managerInputs = document.querySelectorAll('.evaluation-input[data-type="manager"]');
        console.log(`🔍 Найдено полей оценки менеджера: ${managerInputs.length}`);
        
        const commentsInputs = document.querySelectorAll('.evaluation-input[data-type="comments"]');
        console.log(`🔍 Найдено полей комментариев: ${commentsInputs.length}`);
        
        let loadedCount = 0;
        
        Object.keys(data.competencies).forEach(compKey => {
            const comp = data.competencies[compKey];
            console.log(`📋 Обрабатываем компетенцию ${compKey}:`, comp);
            
            if (comp.levels) {
                Object.keys(comp.levels).forEach(levelKey => {
                    const level = comp.levels[levelKey];
                    console.log(`  📊 Обрабатываем уровень ${levelKey}:`, level);
                    
                    // Самооценка
                    const selfInput = this.findInput(compKey, levelKey, 'self');
                    if (selfInput) {
                        selfInput.value = level.selfEvaluation || 0;
                        console.log(`    ✅ Самооценка установлена: ${level.selfEvaluation}`);
                        loadedCount++;
                    } else {
                        console.warn(`    ⚠️ Поле самооценки не найдено: ${compKey}.${levelKey}.self`);
                    }
                    
                    // Оценка менеджера
                    const managerInput = this.findInput(compKey, levelKey, 'manager');
                    if (managerInput) {
                        managerInput.value = level.managerEvaluation || 0;
                        console.log(`    ✅ Оценка менеджера установлена: ${level.managerEvaluation}`);
                        loadedCount++;
                    } else {
                        console.warn(`    ⚠️ Поле оценки менеджера не найдено: ${compKey}.${levelKey}.manager`);
                    }
                    
                    // Комментарии разработчика
                    const commentsInput = this.findInput(compKey, levelKey, 'comments');
                    if (commentsInput) {
                        commentsInput.value = level.comments || '';
                        console.log(`    ✅ Комментарии установлены: "${level.comments}"`);
                        loadedCount++;
                    } else {
                        console.warn(`    ⚠️ Поле комментариев не найдено: ${compKey}.${levelKey}.comments`);
                    }
                    
                    // Комментарии оценивающего
                    const managerCommentsInput = this.findInput(compKey, levelKey, 'manager-comments');
                    if (managerCommentsInput) {
                        managerCommentsInput.value = level.managerComments || '';
                        loadedCount++;
                    }
                });
            }
        });
        
        console.log(`✅ Загружено ${loadedCount} значений в поля ввода`);
        
        if (loadedCount === 0) {
            console.error('❌ Ни одно поле не было найдено! Проверьте структуру HTML и data-атрибуты');
        }
    }
    
    /**
     * Поиск поля ввода по атрибутам
     */
    findInput(competencyKey, levelKey, type) {
        // Ищем по data-атрибутам
        const selector = `.evaluation-input[data-competency="${competencyKey}"][data-level="${levelKey}"][data-type="${type}"]`;
        console.log(`🔍 Ищем поле с селектором: ${selector}`);
        
        const input = document.querySelector(selector);
        
        if (input) {
            console.log(`✅ Найдено: ${competencyKey}.${levelKey}.${type}`, input);
            return input;
        }
        
        // Дополнительная диагностика
        const allInputs = document.querySelectorAll('.evaluation-input');
        console.log(`🔍 Всего найдено полей с классом 'evaluation-input': ${allInputs.length}`);
        
        const competencyInputs = document.querySelectorAll(`[data-competency="${competencyKey}"]`);
        console.log(`🔍 Полей с data-competency="${competencyKey}": ${competencyInputs.length}`);
        
        const levelInputs = document.querySelectorAll(`[data-level="${levelKey}"]`);
        console.log(`🔍 Полей с data-level="${levelKey}": ${levelInputs.length}`);
        
        const typeInputs = document.querySelectorAll(`[data-type="${type}"]`);
        console.log(`🔍 Полей с data-type="${type}": ${typeInputs.length}`);
        
        // Попробуем найти поле с частичным совпадением
        const partialInputs = document.querySelectorAll(`[data-competency*="${competencyKey}"], [data-level*="${levelKey}"], [data-type*="${type}"]`);
        console.log(`🔍 Полей с частичным совпадением: ${partialInputs.length}`);
        
        // Если ничего не найдено, попробуем создать поле программно
        if (allInputs.length === 0) {
            console.warn(`⚠️ Поля ввода не найдены на странице! Проверьте HTML структуру.`);
        }
        
        console.warn(`⚠️ Поле не найдено: ${competencyKey}.${levelKey}.${type}`);
        return null;
    }
    
    /**
     * Обновление информации о разработчике
     */
    updateDeveloperInfo(developerKey) {
        const developerName = this.dataManager.getDeveloperName(developerKey);
        
        // Обновляем отображение имени разработчика
        const currentDeveloperEl = document.getElementById('current-developer');
        if (currentDeveloperEl) {
            currentDeveloperEl.textContent = developerName;
        }
        
        console.log(`👤 Обновлена информация о разработчике: ${developerName}`);
    }
    
    /**
     * Обновление UI при изменении данных
     */
    updateUI(data) {
        if (!data) {
            console.log('⚠️ Нет данных для обновления UI');
            return;
        }
        
        // Обновляем диаграммы
        this.updateCharts(data);
        
        // Обновляем статистику
        this.updateStatistics();
        
        // Обновляем информацию об оценке
        this.updateEvaluationInfo(data);
    }
    
    /**
     * Обновление диаграмм
     */
    updateCharts(data) {
        console.log('📊 Обновляем диаграммы...', data);
        
        if (this.chartManager && this.chartManager.updateCharts) {
            try {
                this.chartManager.updateCharts(data);
                console.log('📊 Диаграммы обновлены через ChartManager');
            } catch (error) {
                console.error('❌ Ошибка обновления диаграмм через ChartManager:', error);
                // Fallback к глобальной функции
                this.updateChartsFallback();
            }
        } else {
            // Если ChartManager недоступен, вызываем глобальную функцию
            this.updateChartsFallback();
        }
    }
    
    updateChartsFallback() {
        if (typeof calculateProgress === 'function') {
            console.log('📊 Вызываем calculateProgress()...');
            calculateProgress();
            console.log('📊 Прогресс пересчитан через глобальную функцию calculateProgress');
        } else {
            console.warn('⚠️ Функция calculateProgress не найдена');
        }
    }
    
    /**
     * Обновление статистики
     */
    updateStatistics() {
        const stats = this.dataManager.getStatistics();
        
        if (!stats) {
            console.log('⚠️ Нет статистики для обновления');
            return;
        }
        
        // Обновляем отображение статистики
        const statsElements = {
            'total-evaluations': stats.totalEvaluations,
            'completed-evaluations': stats.completedEvaluations,
            'completion-percentage': Math.round(stats.completionPercentage),
            'average-score': stats.averageScore
        };
        
        Object.keys(statsElements).forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = statsElements[elementId];
            }
        });
        
        console.log('📊 Статистика обновлена:', stats);
    }
    
    /**
     * Обновление информации об оценке
     */
    updateEvaluationInfo(data) {
        const evaluationDate = document.getElementById('evaluation-date');
        const evaluationStatus = document.getElementById('evaluation-status');
        
        if (evaluationDate && data.date) {
            evaluationDate.textContent = new Date(data.date).toLocaleDateString('ru-RU');
        }
        
        if (evaluationStatus) {
            const stats = this.dataManager.getStatistics();
            if (stats) {
                evaluationStatus.textContent = `Завершено: ${Math.round(stats.completionPercentage)}%`;
            }
        }
    }
    
    /**
     * Обработка загрузки данных
     */
    onDataLoaded(data) {
        console.log('📥 onDataLoaded вызван с данными:', data);
        console.log('📥 Данные загружены, обновляем UI...', data);
        
        try {
            // Загружаем данные в UI
            console.log('🔄 Вызываем loadDataIntoUI...');
            this.loadDataIntoUI(data);
            
            // Показываем уведомление
            this.showNotification('Данные успешно загружены!', 'success');
            
            console.log('✅ UI обновлен после загрузки данных');
        } catch (error) {
            console.error('❌ Ошибка обновления UI после загрузки:', error);
            this.showNotification('Ошибка обновления UI: ' + error.message, 'error');
        }
    }
    
    /**
     * Показ уведомления
     */
    showNotification(message, type = 'info') {
        // Используем глобальную функцию, если она доступна
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            console.log(`🔔 ${type.toUpperCase()}: ${message}`);
        }
    }
    
    /**
     * Очистка UI
     */
    clearUI() {
        // Очищаем поля ввода
        const inputs = document.querySelectorAll('.evaluation-input');
        inputs.forEach(input => {
            input.value = '';
        });
        
        // Очищаем селект разработчика
        const developerSelect = document.getElementById('developer-profile');
        if (developerSelect) {
            developerSelect.value = '';
        }
        
        // Очищаем статистику
        const statsElements = ['total-evaluations', 'completed-evaluations', 'completion-percentage', 'average-score'];
        statsElements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = '0';
            }
        });
        
        console.log('🗑️ UI очищен');
    }
}

// Создаем глобальный экземпляр
window.uiManager = new UIManager();
