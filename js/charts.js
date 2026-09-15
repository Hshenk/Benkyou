const CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/auto/+esm';

let chartPromise = null;

export function loadChart() {
    chartPromise ??= import(CDN).then(({ Chart }) => { applyTheme(Chart); return Chart; })

    .catch((err) => {
        console.warn('Could not access chart library:', err.message);
        chartPromise = null;
        return null;
    });

    return chartPromise;
}

export function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function applyTheme(Chart) {
    const d = Chart.defaults;

    d.color = cssVar('--text-muted');
    d.borderColor = cssVar('--border');
    d.font.family = cssVar('--font-ui');
    d.font.size = 12;

    d.plugins.legend.display = false;

    const tip = d.plugins.tooltip;
    tip.backgroundColor = cssVar('--surface-2');
    tip.borderColor = cssVar('--border-strong');
    tip.borderWidth = 1;
    tip.titleColor = cssVar('--text');
    tip.bodyColor = cssVar('--text');
    tip.cornerRadius = 4;
    tip.padding = 8;
    tip.boxPadding = 4;

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        d.animation = false;
    }
}

export async function drawChart(canvas, config) {
    const Chart = await loadChart();
    if (!Chart) return null;

    const existing = Chart.getChart(canvas);

    if (existing && existing.config.type === config.type) {
        existing.data.labels = config.data.labels;

        config.data.datasets.forEach((dataset, i) => {
            existing.data.datasets[i] ??= {};
            Object.assign(existing.data.datasets[i], dataset);
        });

        existing.data.datasets.length = config.data.datasets.length;

        existing.options = config.options;
        existing.update();
        return existing;
    }

    existing?.destroy();
    return new Chart(canvas, config);
}