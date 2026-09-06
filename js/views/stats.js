import { getCards, getSessions, onChange } from '../storage.js';
import { cardText } from '../card.js';
import { renderJapanese } from '../render.js';
import { sessionsIn, totals, streak, cardStats, gradeFor, activityByDay, localDay,
    RANGE_DAYS, GRADES, GRADE_LABELS, gradeCounts, groupByType, namespacesOf, groupByNamespace,
    hardest, trendingDown,
 } from '../stats.js';

const rangeSelect = document.querySelector('#stats-range');
const leadEl = document.querySelector('#stats-lead');
const gridEl = document.querySelector('#stat-grid');
const emptyEl = document.querySelector('#stats-empty');
const tileTemplate = document.querySelector('#stat-tile-template');
const legendEl = document.querySelector('#grade-legend');
const heatmapEl = document.querySelector('#heatmap');
const heatmapNote = document.querySelector('#heatmap-note');
const heatmapDesc = document.querySelector('#heatmap-desc');
const typeBarsEl = document.querySelector('#type-bars');
const tagBarsEl = document.querySelector('#tag-bars');
const hardestEl = document.querySelector('#hardest-list');
const trendEl = document.querySelector('#trend-list');

const barTemplate = document.querySelector('#bar-row-template');
const lineTemplate = document.querySelector('#card-line-template');

let onEdit = () => {};



const RANGE_LABELS = {
    month: 'the past month',
    quarter: 'the past 3 months',
    year: 'the past year',
    all: 'all time',
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function duration(minutes) {
    if (minutes < 1) return '—';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    return `${(minutes / 60).toFixed(1)} h`;
}

function note(text) {
    const p = document.createElement('p');
    p.className = 'stat-panel__empty';
    p.textContent = text;
    return p;
}

function tile(label, value, note) {
    const node = tileTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('[data-field="label"]').textContent = label;
    node.querySelector('[data-field="value"]').textContent = value;
    node.querySelector('[data-field="note"]').textContent = note ?? '';
    return node;
}

function render() {
    const range = rangeSelect.value;
    const log = getSessions();
    const sessions = sessionsIn(log, range);

    const t = totals(sessions);
    const byCard = cardStats(sessions);
    const cards = getCards();

    const s = streak(log);

    const mastered = cards.filter((c) => gradeFor(byCard.get(c.id)) === 'mastered').length;

    emptyEl.hidden = sessions.length > 0;
    leadEl.textContent = sessions.length
        ? `In ${RANGE_LABELS[range]} you studied ${plural(t.uniqueCards, 'card')} `
          + `across ${plural(t.sessions, 'session')} on ${plural(t.days, 'day')}.`
        : '';
    
    gridEl.replaceChildren(
        tile('Sessions',       t.sessions,     RANGE_LABELS[range]),
        tile('Days studied',   t.days,         RANGE_LABELS[range]),
        tile('Time studied',   duration(t.minutes), RANGE_LABELS[range]),
        tile('Cards seen',     t.uniqueCards,  `${plural(t.reps, 'rep')} in total`),
        tile('Mastered',       `${mastered} / ${cards.length}`, 'of your collection'),
        tile('Current streak', plural(s.current, 'day'), `longest ${s.longest}, all time`),
    );

    const byId = new Map(cards.map((c) => [c.id, c]));

    renderHeatmap(sessions, range);
    renderTypeBars(cards, byCard);
    renderTagBars(cards, byCard);
    renderHardest(byId, byCard);
    renderTrend(byId, byCard);
}

export function initStats(options = {}) {
    onEdit = options.onEdit ?? (() => {});

    renderLegend();

    rangeSelect.addEventListener('change', render);

    for (const list of [hardestEl, trendEl]) {
        list.addEventListener('click', (event) => {
            const line = event.target.closest('.card-line');
            if (line) onEdit(line.dataset.id);
        });
    }

    onChange(render);
    render();
}

function stackedBar(counts, total) {
    const bar = document.createElement('div');
    bar.className = 'bar';

    for (const grade of GRADES) {
        const n = counts[grade];
        if (!n) continue;

        const seg = document.createElement('span');
        seg.className = 'bar__seg';
        seg.dataset.grade = grade;
        seg.style.width = `${(n / total) * 100}%`;
        seg.title = `${GRADE_LABELS[grade]}: ${n}`;
        bar.append(seg);
    }

    return bar;
}

// One labelled row
function barRow(label, cards, byCard) {
    const row = barTemplate.content.firstElementChild.cloneNode(true);
    const counts = gradeCounts(cards, byCard);

    row.querySelector('[data-field="label"]').textContent = label;
    row.querySelector('[data-field="bar"]').replaceWith(stackedBar(counts, cards.length));
    row.querySelector('[data-field="note"]').textContent = `${counts.mastered}/${cards.length}`;

    row.title = GRADES
        .filter((g) => counts[g])
        .map((g) => `${GRADE_LABELS[g]}: ${counts[g]}`)
        .join(' · ');

    return row;
}

function renderLegend() {
    legendEl.replaceChildren(...GRADES.map((grade) => {
        const item = document.createElement('span');
        item.className = 'legend__item';
        item.dataset.grade = grade;
        item.textContent = GRADE_LABELS[grade];
        return item;
    }));
}


const LEVELS = 4;

function levelFor(reps, max) {
    if (!reps) return 0;
    return Math.min(LEVELS, Math.ceil((reps / max) * LEVELS));
}

function renderHeatmap(sessions, range) {
    const byDay = activityByDay(sessions);

    if (byDay.size === 0) {
        heatmapEl.replaceChildren(note('Nothing studied in this period.'));
        heatmapNote.textContent = '';
        heatmapDesc.textContent = '';
        return;
    }

    const span = RANGE_DAYS[range] ?? 365;
    const today = new Date();

    const start = new Date(today);
    start.setDate(today.getDate() - (span - 1));

    let max = 0;
    for (const entry of byDay.values()) max = Math.max(max, entry.reps);

    const cells = [];

    // Blank leaders so the first real day lands on itws own weekday row
    for (let i = 0; i < start.getDay(); i++) {
        const pad = document.createElement('div');
        pad.className = 'heatmap__pad';
        cells.push(pad);
    }

    for (let i = 0; i < span; i++) {
        const day = new Date(start);
        day.setDate(start.getDate() + i);

        const key = localDay(day);
        const entry = byDay.get(key);

        const cell = document.createElement('div');
        cell.className = 'heatmap__day';
        cell.dataset.level = levelFor(entry?.reps ?? 0, max);
        cell.title = entry
            ? `${key} — ${entry.reps} reps over ${entry.cards} cards`
            : `${key} — nothing`;
        
        cells.push(cell);
    }

    heatmapEl.replaceChildren(...cells);
    heatmapNote.textContent = `Busiest day: ${max} reps.`;

    const active = [...byDay].sort();
    heatmapDesc.textContent =
        `Study activity over the last ${span} days. `
        + active.map(([day, e]) => `${day}: ${e.reps} reps`).join('; ') + '.';
}

function renderTypeBars(cards, byCard) {
    const groups = groupByType(cards);

    if (groups.length === 0) {
        typeBarsEl.replaceChildren(note('No cards yet.'));
        return;
    }

    typeBarsEl.replaceChildren(
        ...groups.map(([label, group]) => barRow(label, group, byCard))
    );
}

function renderTagBars(cards, byCard) {
    const namespaces = namespacesOf(cards);

    if (namespaces.length === 0) {
        tagBarsEl.replaceChildren(note('Not tags yet.'));
        return;
    }

    const fragment = document.createDocumentFragment();

    for (const namespace of namespaces) {
        const heading = document.createElement('h4');
        heading.className = 'bar-group__name';
        heading.textContent = namespace;
        fragment.append(heading);

        const rows = groupByNamespace(cards, namespace)
            .map(([value, group]) => {
                    const counts = gradeCounts(group, byCard);
                    return { value, group, share: counts.mastered / group.length };
                })
            .sort((a, b) => b.share - a.share || b.group.length - a.group.length);
        
        for (const { value, group } of rows) {
            fragment.append(barRow(value, group, byCard));
        }
    }

    tagBarsEl.replaceChildren(fragment);
}

function cardLine(card, statText) {
    const line = lineTemplate.content.firstElementChild.cloneNode(true);
    line.dataset.id = card.id;

    renderJapanese(line.querySelector('[data-field="expression"]'), cardText(card), { links: false });
    line.querySelector('[data-field="meaning"]').textContent = card.meaning;
    line.querySelector('[data-field="stat"]').textContent = statText;

    return line;
}

function renderHardest(byId, byCard) {
    const rows = hardest(byCard);

    if (rows.length === 0) {
        hardestEl.replaceChildren(note(
            'No card has been studied three times in this period yet — '
            + 'there is not enough history to call anything hard.'
        ));
        return;
    }

    hardestEl.replaceChildren(...rows.flatMap(([id, entry]) => {
        const card = byId.get(id);
        if (!card) return [];       // studied, then deleted
        return [cardLine(card, `${Math.round(entry.score * 100)}% over ${entry.sessions} sessions`)];
    }));
}

function renderTrend(byId, byCard) {
    const rows = trendingDown(byCard);

    if (rows.length === 0) {
        trendEl.replaceChildren(note('Nothing is sliding. Cards need four sessions before a trend counts.'));
        return;
    }

    trendEl.replaceChildren(...rows.flatMap(([id, entry]) => {
        const card = byId.get(id);
        if (!card) return [];
        return [cardLine(card,
            `${Math.round(entry.earlier * 100)}% → ${Math.round(entry.recent * 100)}%`)];
    }));
}
