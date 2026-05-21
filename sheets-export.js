/**
 * Экспорт оценок в формат Google Таблиц (CSV)
 * Колонки: Компетенция | Было | Стало | Изменение
 */

function csvCell(value) {
    const s = String(value ?? '').replace(/\r?\n/g, ' ').trim();
    if (s.includes('"') || s.includes(',') || s.includes(';')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

function formatScoreWithGrade(avg) {
    if (avg == null || Number.isNaN(avg)) return '—';
    const g = WindroseScoring.getGradeFromScore(avg);
    return `${avg.toFixed(1)} (${g.code})`;
}

function formatDelta(was, now) {
    if (was == null || Number.isNaN(was)) return '—';
    const d = now - was;
    const sign = d > 0 ? '+' : '';
    return `${sign}${d.toFixed(1)}`;
}

/**
 * Сравнение двух оценок → структура для листа
 */
function buildSheetComparison(currentData, previousData) {
    const metricsNow = WindroseScoring.computeMetricsFromEvaluation(currentData, { scoreSource: 'manager' });
    const metricsWas = previousData
        ? WindroseScoring.computeMetricsFromEvaluation(previousData, { scoreSource: 'manager' })
        : null;

    const devName = WindroseScoring.getDeveloperName(currentData.developer)
        || currentData.developerName
        || currentData.developer;

    const rows = [];
    rows.push(['Сотрудник', devName]);
    rows.push(['Дата оценки (стало)', currentData.date ? new Date(currentData.date).toLocaleDateString('ru-RU') : '—']);
    rows.push(['Дата оценки (было)', previousData?.date ? new Date(previousData.date).toLocaleDateString('ru-RU') : '—']);
    rows.push(['Оценщик', currentData.evaluator || '—']);
    rows.push(['Статус', currentData.status === 'completed' ? 'Завершена' : (currentData.status || '—')]);
    rows.push([]);

    rows.push([
        'Итоговый грейд (было)',
        metricsWas ? `${metricsWas.grade.name} (${metricsWas.overallAverage.toFixed(1)})` : '—',
        'Итоговый грейд (стало)',
        `${metricsNow.grade.name} (${metricsNow.overallAverage.toFixed(1)})`
    ]);
    rows.push([
        'Сумма баллов (было)',
        metricsWas ? metricsWas.totalSum.toFixed(1) : '—',
        'Сумма баллов (стало)',
        metricsNow.totalSum.toFixed(1)
    ]);
    rows.push([]);

    rows.push(['Компетенция', 'Было', 'Стало', 'Изменение', 'Комментарии менеджера (текущая оценка)']);

    WindroseScoring.COMPETENCIES.forEach(({ key, label, icon }) => {
        const nowAvg = metricsNow.competencies[key].average;
        const wasAvg = metricsWas?.competencies[key]?.average ?? null;
        const managerNotes = collectManagerNotesForCompetency(currentData, key);

        rows.push([
            `${icon} ${label}`,
            wasAvg != null ? formatScoreWithGrade(wasAvg) : '—',
            formatScoreWithGrade(nowAvg),
            formatDelta(wasAvg, nowAvg),
            managerNotes || '—'
        ]);
    });

    rows.push([]);
    rows.push(['Резюме изменений с прошлой оценки']);
    rows.push([generateChangeSummary(currentData, metricsNow, metricsWas)]);

    return { rows, metricsNow, metricsWas, devName };
}

function collectManagerNotesForCompetency(data, compKey) {
    const blocks = WindroseScoring.extractManagerComments(data);
    const block = blocks.find(b => b.key === compKey);
    if (!block || !block.items.length) return '';
    return block.items
        .map(i => `[${i.levelLabel.split(' ')[0]}] ${i.text}`)
        .join(' ');
}

function generateChangeSummary(currentData, metricsNow, metricsWas) {
    const parts = [];

    if (metricsWas) {
        const gradeDelta = metricsNow.overallAverage - metricsWas.overallAverage;
        if (gradeDelta > 0.15) {
            parts.push(
                `По сравнению с прошлой оценкой средний балл вырос с ${metricsWas.overallAverage.toFixed(1)} до ${metricsNow.overallAverage.toFixed(1)} ` +
                `(грейд: ${metricsWas.grade.name} → ${metricsNow.grade.name}).`
            );
        } else if (gradeDelta < -0.15) {
            parts.push(
                `Средний балл снизился с ${metricsWas.overallAverage.toFixed(1)} до ${metricsNow.overallAverage.toFixed(1)}.`
            );
        } else {
            parts.push(
                `Уровень в целом стабилен: грейд ${metricsNow.grade.name}, средний балл ${metricsNow.overallAverage.toFixed(1)}.`
            );
        }

        const improved = [];
        const declined = [];
        WindroseScoring.COMPETENCIES.forEach(({ key, label }) => {
            const was = metricsWas.competencies[key].average;
            const now = metricsNow.competencies[key].average;
            const d = now - was;
            if (d >= 0.5) improved.push(label);
            if (d <= -0.5) declined.push(label);
        });
        if (improved.length) {
            parts.push(`Заметный рост: ${improved.join(', ')}.`);
        }
        if (declined.length) {
            parts.push(`Снижение оценки: ${declined.join(', ')}.`);
        }
    } else {
        parts.push(
            `Текущий грейд: ${metricsNow.grade.name}, средний балл ${metricsNow.overallAverage.toFixed(1)} из 3.0, сумма баллов ${metricsNow.totalSum.toFixed(0)}.`
        );
    }

    const commentBlocks = WindroseScoring.extractManagerComments(currentData).filter(b => b.items.length);
    if (commentBlocks.length) {
        parts.push('');
        parts.push('Комментарии оценивающего:');
        commentBlocks.forEach(block => {
            const text = block.items.map(i => i.text).join(' ');
            parts.push(`${block.label}: ${text}`);
        });
    }

    const gradeLine = buildGradeRecommendation(metricsNow);
    if (gradeLine) {
        parts.push('');
        parts.push(gradeLine);
    }

    return parts.join('\n');
}

function buildGradeRecommendation(metrics) {
    const g = metrics.grade;
    if (g.code === 'S+' || g.code === 'S') {
        return `Сотрудник соответствует требованиям уровня ${g.name} (средний балл ${metrics.overallAverage.toFixed(1)}).`;
    }
    if (g.code === 'M') {
        return `Сотрудник соответствует требованиям, предъявляемым специалисту уровня ${g.name}.`;
    }
    return `Текущий профиль соответствует уровню ${g.name}; есть зоны для развития до следующего грейда.`;
}

function rowsToCsv(rows) {
    return rows.map(row => row.map(csvCell).join(',')).join('\n');
}

function downloadCsv(filename, rows) {
    const bom = '\uFEFF';
    const blob = new Blob([bom + rowsToCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

const SheetsExport = {
    buildSheetComparison,
    rowsToCsv,
    downloadCsv,
    generateChangeSummary
};

if (typeof window !== 'undefined') {
    window.SheetsExport = SheetsExport;
}
