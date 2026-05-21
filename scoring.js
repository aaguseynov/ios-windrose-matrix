/**
 * Расчёт баллов и грейдов iOS Windrose Matrix
 *
 * Шкала по уровню (J/M/S/S+): 0.0 — 3.0
 * Итоговый грейд по среднему баллу по всем ячейкам (40 оценок × 10 компетенций × 4 уровня):
 *   J (Junior):    0.0 — 0.7
 *   M (Middle):    0.8 — 1.7
 *   S (Senior):    1.8 — 2.7
 *   S+ (Senior+):  2.8 — 3.0
 *
 * Сумма баллов = сумма всех 40 оценок (макс. 120).
 * Средний балл = сумма / 40 (или среднее по 10 компетенциям — совпадает).
 */

const WINDROSE_COMPETENCIES = [
    { key: 'design', label: 'Проектирование', icon: '🏗️' },
    { key: 'ios', label: 'iOS', icon: '🍎' },
    { key: 'threading', label: 'Многопоточность', icon: '⚡' },
    { key: 'di', label: 'Внедрение зависимостей', icon: '🔗' },
    { key: 'testing', label: 'Тестирование', icon: '🧪' },
    { key: 'tools', label: 'Инструменты', icon: '🛠️' },
    { key: 'product', label: 'Знание продукта', icon: '📊' },
    { key: 'autonomy', label: 'Самостоятельность', icon: '🎯' },
    { key: 'quality', label: 'Качество результата', icon: '⭐' },
    { key: 'teamwork', label: 'Взаимодействие с командой', icon: '👥' }
];

const LEVEL_KEYS = ['level_0', 'level_1', 'level_2', 'level_3'];

const LEVEL_LABELS = {
    level_0: 'J (Junior)',
    level_1: 'M (Middle)',
    level_2: 'S (Senior)',
    level_3: 'S+ (Senior+)'
};

const GRADE_BANDS = [
    { code: 'J', name: 'Junior', short: 'Junior', min: 0, max: 0.7, color: '#234e52', bg: '#e6fffa' },
    { code: 'M', name: 'Middle', short: 'Middle', min: 0.8, max: 1.7, color: '#c53030', bg: '#fed7d7' },
    { code: 'S', name: 'Senior', short: 'Senior', min: 1.8, max: 2.7, color: '#276749', bg: '#c6f6d5' },
    { code: 'S+', name: 'Senior+', short: 'Senior+', min: 2.8, max: 3.0, color: '#2c5282', bg: '#bee3f8' }
];

const DEVELOPER_NAMES = {
    artem: 'Артем Брагин',
    denis: 'Денис Вальщиков',
    anar: 'Анар Гусейнов'
};

function getGradeFromScore(score) {
    const s = Number(score) || 0;
    if (s <= 0.7) return GRADE_BANDS[0];
    if (s <= 1.7) return GRADE_BANDS[1];
    if (s <= 2.7) return GRADE_BANDS[2];
    return GRADE_BANDS[3];
}

function resolveScoreSource(role) {
    if (role === 'colleague') return 'manager';
    if (role === 'self') return 'self';
    return 'auto';
}

function getLevelValue(levelData, source) {
    if (!levelData) return 0;
    const self = Number(levelData.selfEvaluation) || 0;
    const manager = Number(levelData.managerEvaluation) || 0;
    if (source === 'self') return self;
    if (source === 'manager') return manager;
    return manager > 0 ? manager : self;
}

function getCompetencyLevels(compData) {
    if (!compData) return {};
    if (compData.levels) return compData.levels;
    const levels = {};
    LEVEL_KEYS.forEach(key => {
        if (compData[key]) levels[key] = compData[key];
    });
    return levels;
}

function computeMetricsFromEvaluation(evaluationData, options = {}) {
    const source = options.scoreSource || resolveScoreSource(options.role);
    const competencies = evaluationData?.competencies || {};
    const result = {
        scoreSource: source,
        competencies: {},
        windroseLabels: WINDROSE_COMPETENCIES.map(c => c.label),
        windroseSelf: [],
        windroseManager: [],
        windrosePrimary: []
    };

    let totalSum = 0;
    let cellCount = 0;
    const compAverages = [];

    WINDROSE_COMPETENCIES.forEach(({ key, label }) => {
        const levels = getCompetencyLevels(competencies[key]);
        const levelScores = [];
        const selfScores = [];
        const managerScores = [];

        LEVEL_KEYS.forEach(levelKey => {
            const level = levels[levelKey] || {};
            const self = Number(level.selfEvaluation) || 0;
            const manager = Number(level.managerEvaluation) || 0;
            const primary = getLevelValue(level, source);
            levelScores.push(primary);
            selfScores.push(self);
            managerScores.push(manager);
            totalSum += primary;
            cellCount++;
        });

        const average = levelScores.length
            ? levelScores.reduce((a, b) => a + b, 0) / levelScores.length
            : 0;
        const sum = levelScores.reduce((a, b) => a + b, 0);
        const grade = getGradeFromScore(average);
        const selfAvg = selfScores.reduce((a, b) => a + b, 0) / (selfScores.length || 1);
        const managerAvg = managerScores.reduce((a, b) => a + b, 0) / (managerScores.length || 1);

        result.competencies[key] = {
            key,
            label,
            average,
            sum,
            grade,
            levelScores,
            selfAverage: selfAvg,
            managerAverage: managerAvg
        };
        compAverages.push(average);
        result.windrosePrimary.push(average);
        result.windroseSelf.push(selfAvg);
        result.windroseManager.push(managerAvg);
    });

    result.overallAverage = compAverages.length
        ? compAverages.reduce((a, b) => a + b, 0) / compAverages.length
        : 0;
    result.totalSum = totalSum;
    result.maxSum = WINDROSE_COMPETENCIES.length * LEVEL_KEYS.length * 3;
    result.cellCount = cellCount;
    result.grade = getGradeFromScore(result.overallAverage);
    result.progressPercent = (result.overallAverage / 3) * 100;

    return result;
}

function collectMetricsFromDOM(role) {
    const source = resolveScoreSource(role);
    const competencies = {};

    WINDROSE_COMPETENCIES.forEach(({ key }) => {
        competencies[key] = { levels: {} };
        LEVEL_KEYS.forEach(levelKey => {
            const selfEl = document.querySelector(
                `.evaluation-input[data-competency="${key}"][data-level="${levelKey}"][data-type="self"]`
            );
            const managerEl = document.querySelector(
                `.evaluation-input[data-competency="${key}"][data-level="${levelKey}"][data-type="manager"]`
            );
            competencies[key].levels[levelKey] = {
                selfEvaluation: parseFloat(selfEl?.value) || 0,
                managerEvaluation: parseFloat(managerEl?.value) || 0
            };
        });
    });

    return computeMetricsFromEvaluation({ competencies }, { role, scoreSource: source });
}

/**
 * Комментарии менеджера по компетенциям (для PDF-отчёта)
 */
function extractManagerComments(evaluationData) {
    const competencies = evaluationData?.competencies || {};
    return WINDROSE_COMPETENCIES.map(({ key, label, icon }) => {
        const levels = getCompetencyLevels(competencies[key]);
        const items = LEVEL_KEYS.map(levelKey => {
            const level = levels[levelKey] || {};
            const text = String(level.managerComments || '').trim();
            const score = Number(level.managerEvaluation) || 0;
            return {
                levelKey,
                levelLabel: LEVEL_LABELS[levelKey],
                text,
                score
            };
        }).filter(item => item.text.length > 0);

        return { key, label, icon, items };
    });
}

function formatGradeBadge(grade, large = false) {
    const g = grade || GRADE_BANDS[0];
    const size = large ? 'grade-badge-lg' : 'grade-badge';
    return `<span class="${size}" style="background:${g.bg};color:${g.color}">${g.code} · ${g.name}</span>`;
}

const WindroseScoring = {
    COMPETENCIES: WINDROSE_COMPETENCIES,
    GRADE_BANDS,
    DEVELOPER_NAMES,
    getGradeFromScore,
    resolveScoreSource,
    computeMetricsFromEvaluation,
    collectMetricsFromDOM,
    formatGradeBadge,
    extractManagerComments,
    LEVEL_LABELS,
    getDeveloperName: (key) => DEVELOPER_NAMES[key] || key
};

if (typeof window !== 'undefined') {
    window.WindroseScoring = WindroseScoring;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WindroseScoring;
}
