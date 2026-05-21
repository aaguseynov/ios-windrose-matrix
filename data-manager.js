/**
 * Data Manager
 * Централизованное управление данными оценок
 * Упрощенная и надежная система работы с данными
 */

class DataManager {
    constructor() {
        this.currentData = null;
        this.competencies = [
            { key: 'design', name: 'Дизайн' },
            { key: 'ios', name: 'iOS разработка' },
            { key: 'threading', name: 'Многопоточность' },
            { key: 'di', name: 'Dependency Injection' },
            { key: 'testing', name: 'Тестирование' },
            { key: 'tools', name: 'Инструменты разработки' },
            { key: 'product', name: 'Продукт' },
            { key: 'autonomy', name: 'Автономность' },
            { key: 'quality', name: 'Качество' },
            { key: 'teamwork', name: 'Командная работа' }
        ];
        this.levels = ['level_0', 'level_1', 'level_2', 'level_3'];
        this.developers = [
            { key: 'artem', name: 'Артем Брагин' },
            { key: 'denis', name: 'Денис Вальщиков' },
            { key: 'anar', name: 'Анар Гусейнов' }
        ];
        
        // Callbacks
        this.onDataChanged = null;
        this.onDataLoaded = null;
        this.onDataSaved = null;
    }
    
    /**
     * Создание новой пустой структуры данных
     */
    createNewData(developerKey) {
        const developer = this.developers.find(d => d.key === developerKey);
        if (!developer) {
            throw new Error(`Разработчик ${developerKey} не найден`);
        }
        
        const data = {
            developer: developerKey,
            developerName: developer.name,
            date: new Date().toISOString(),
            competencies: {}
        };
        
        // Создаем структуру компетенций
        this.competencies.forEach(comp => {
            data.competencies[comp.key] = {
                name: comp.name,
                levels: {}
            };
            
            this.levels.forEach(level => {
                data.competencies[comp.key].levels[level] = {
                    selfEvaluation: 0,
                    managerEvaluation: 0,
                    comments: '',
                    managerComments: ''
                };
            });
        });
        
        this.currentData = data;
        this.notifyDataChanged();
        
        console.log('✅ Созданы новые данные для разработчика:', developer.name);
        return data;
    }
    
    /**
     * Загрузка данных из файла
     */
    loadFromFile(fileData) {
        try {
            console.log('📥 Загрузка данных из файла:', fileData);
            
            // Проверяем структуру данных
            if (!this.validateDataStructure(fileData)) {
                throw new Error('Неверная структура данных в файле');
            }
            
            // Нормализуем данные (приводим к единому формату)
            const normalizedData = this.normalizeData(fileData);
            
            this.currentData = normalizedData;
            this.notifyDataLoaded(normalizedData);
            
            console.log('✅ Данные успешно загружены из файла');
            return normalizedData;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
            throw error;
        }
    }
    
    /**
     * Валидация структуры данных
     */
    validateDataStructure(data) {
        if (!data || typeof data !== 'object') {
            console.error('❌ Данные не являются объектом');
            return false;
        }
        
        if (!data.developer || typeof data.developer !== 'string') {
            console.error('❌ Отсутствует поле developer');
            return false;
        }
        
        if (!data.competencies || typeof data.competencies !== 'object') {
            console.error('❌ Отсутствует поле competencies');
            return false;
        }
        
        // Проверяем наличие компетенций
        const hasValidCompetencies = this.competencies.some(comp => 
            data.competencies[comp.key] && 
            typeof data.competencies[comp.key] === 'object'
        );
        
        if (!hasValidCompetencies) {
            console.error('❌ Не найдено ни одной валидной компетенции');
            return false;
        }
        
        return true;
    }
    
    /**
     * Нормализация данных (приведение к единому формату)
     */
    normalizeData(data) {
        console.log('🔄 Нормализация данных:', data);
        console.log('🔄 Структура competencies в исходных данных:', data.competencies);
        console.log('🔄 Ожидаемые компетенции:', this.competencies.map(c => c.key));
        console.log('🔄 Ожидаемые уровни:', this.levels);
        
        const normalized = {
            developer: data.developer,
            evaluator: data.evaluator || 'Система',
            developerName: this.getDeveloperName(data.developer),
            date: data.date || new Date().toISOString(),
            status: data.status || 'completed',
            competencies: {}
        };
        
        // Нормализуем компетенции
        this.competencies.forEach(comp => {
            const compData = data.competencies[comp.key];
            
            if (compData) {
                console.log(`📋 Обрабатываем компетенцию ${comp.key}:`, compData);
                
                normalized.competencies[comp.key] = {
                    name: comp.name,
                    levels: {}
                };
                
                this.levels.forEach(level => {
                    const levelData = compData[level];
                    
                    if (levelData) {
                        normalized.competencies[comp.key].levels[level] = {
                            selfEvaluation: Number(levelData.selfEvaluation) || 0,
                            managerEvaluation: Number(levelData.managerEvaluation) || 0,
                            comments: String(levelData.comments || ''),
                            managerComments: String(levelData.managerComments || '')
                        };
                        
                        console.log(`  ✅ ${level}: self=${levelData.selfEvaluation}, manager=${levelData.managerEvaluation}`);
                    } else {
                        // Создаем пустую структуру, если данных нет
                        normalized.competencies[comp.key].levels[level] = {
                            selfEvaluation: 0,
                            managerEvaluation: 0,
                            comments: '',
                            managerComments: ''
                        };
                        
                        console.log(`  ⚠️ ${level}: данные отсутствуют, создана пустая структура`);
                    }
                });
            } else {
                console.log(`⚠️ Компетенция ${comp.key} не найдена в данных, создаем пустую структуру`);
                
                // Создаем пустую структуру компетенции
                normalized.competencies[comp.key] = {
                    name: comp.name,
                    levels: {}
                };
                
                this.levels.forEach(level => {
                    normalized.competencies[comp.key].levels[level] = {
                        selfEvaluation: 0,
                        managerEvaluation: 0,
                        comments: '',
                        managerComments: ''
                    };
                });
            }
        });
        
        console.log('✅ Нормализация завершена:', normalized);
        return normalized;
    }
    
    /**
     * Обновление значения оценки
     */
    updateEvaluation(competencyKey, levelKey, type, value) {
        if (!this.currentData) {
            console.warn('⚠️ Нет текущих данных для обновления');
            return;
        }
        
        const comp = this.currentData.competencies[competencyKey];
        if (!comp || !comp.levels[levelKey]) {
            console.error('❌ Не найдена компетенция или уровень:', competencyKey, levelKey);
            return;
        }
        
        const level = comp.levels[levelKey];
        
        switch (type) {
            case 'self':
                level.selfEvaluation = Number(value) || 0;
                break;
            case 'manager':
                level.managerEvaluation = Number(value) || 0;
                break;
            case 'comments':
                level.comments = String(value || '');
                break;
            case 'manager-comments':
                level.managerComments = String(value || '');
                break;
            default:
                console.error('❌ Неизвестный тип оценки:', type);
                return;
        }
        
        this.notifyDataChanged();
        console.log(`✅ Обновлено ${competencyKey}.${levelKey}.${type}:`, value);
    }
    
    /**
     * Получение значения оценки
     */
    getEvaluation(competencyKey, levelKey, type) {
        if (!this.currentData) {
            return this.getDefaultValue(type);
        }
        
        const comp = this.currentData.competencies[competencyKey];
        if (!comp || !comp.levels[levelKey]) {
            return this.getDefaultValue(type);
        }
        
        const level = comp.levels[levelKey];
        
        switch (type) {
            case 'self':
                return level.selfEvaluation || 0;
            case 'manager':
                return level.managerEvaluation || 0;
            case 'comments':
                return level.comments || '';
            case 'manager-comments':
                return level.managerComments || '';
            default:
                return this.getDefaultValue(type);
        }
    }
    
    /**
     * Получение значения по умолчанию
     */
    getDefaultValue(type) {
        switch (type) {
            case 'self':
            case 'manager':
                return 0;
            case 'comments':
            case 'manager-comments':
                return '';
            default:
                return 0;
        }
    }
    
    /**
     * Получение текущих данных
     */
    getCurrentData() {
        return this.currentData;
    }
    
    /**
     * Получение данных для сохранения
     */
    getDataForSave() {
        if (!this.currentData) {
            throw new Error('Нет данных для сохранения');
        }
        
        // Создаем структуру для сохранения в формате, соответствующем реальному JSON
        const saveData = {
            developer: this.currentData.developer,
            evaluator: this.currentData.evaluator || 'Система',
            date: this.currentData.date,
            status: this.currentData.status || "completed",
            competencies: {}
        };
        
        Object.keys(this.currentData.competencies).forEach(compKey => {
            saveData.competencies[compKey] = {};
            
            Object.keys(this.currentData.competencies[compKey].levels).forEach(levelKey => {
                const level = this.currentData.competencies[compKey].levels[levelKey];
                saveData.competencies[compKey][levelKey] = {
                    selfEvaluation: level.selfEvaluation,
                    managerEvaluation: level.managerEvaluation,
                    comments: level.comments,
                    managerComments: level.managerComments || ''
                };
            });
        });
        
        return saveData;
    }
    
    /**
     * Получение имени разработчика
     */
    getDeveloperName(developerKey) {
        const developer = this.developers.find(d => d.key === developerKey);
        return developer ? developer.name : developerKey;
    }
    
    /**
     * Получение статистики по данным
     */
    getStatistics() {
        if (!this.currentData) {
            return null;
        }
        
        let totalEvaluations = 0;
        let completedEvaluations = 0;
        let averageScore = 0;
        let totalScore = 0;
        
        Object.keys(this.currentData.competencies).forEach(compKey => {
            const comp = this.currentData.competencies[compKey];
            
            Object.keys(comp.levels).forEach(levelKey => {
                const level = comp.levels[levelKey];
                
                // Считаем самооценку
                if (level.selfEvaluation > 0) {
                    totalScore += level.selfEvaluation;
                    completedEvaluations++;
                }
                totalEvaluations++;
                
                // Считаем оценку менеджера
                if (level.managerEvaluation > 0) {
                    totalScore += level.managerEvaluation;
                    completedEvaluations++;
                }
                totalEvaluations++;
            });
        });
        
        if (completedEvaluations > 0) {
            averageScore = totalScore / completedEvaluations;
        }
        
        return {
            totalEvaluations,
            completedEvaluations,
            completionPercentage: totalEvaluations > 0 ? (completedEvaluations / totalEvaluations) * 100 : 0,
            averageScore: Math.round(averageScore * 100) / 100
        };
    }
    
    /**
     * Уведомление об изменении данных
     */
    notifyDataChanged() {
        if (this.onDataChanged) {
            this.onDataChanged(this.currentData);
        }
    }
    
    /**
     * Уведомление о загрузке данных
     */
    notifyDataLoaded(data) {
        if (this.onDataLoaded) {
            this.onDataLoaded(data);
        }
    }
    
    /**
     * Уведомление о сохранении данных
     */
    notifyDataSaved(data) {
        if (this.onDataSaved) {
            this.onDataSaved(data);
        }
    }
    
    /**
     * Очистка данных
     */
    clearData() {
        this.currentData = null;
        this.notifyDataChanged();
        console.log('🗑️ Данные очищены');
    }
}

// Создаем глобальный экземпляр
window.dataManager = new DataManager();
