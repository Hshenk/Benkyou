import { getCards, getSessions, onChange } from '../storage.js';
import { cardText } from '../card.js';
import { renderJapanese } from '../render.js';
import { loadKanjiSheet, inTop2500, inJoyo, schoolGradeName, schoolGradeShort } from '../kanji.js';
import { drawChart, cssVar, withAlpha } from '../charts.js';
import { sessionsIn, sessionsBefore, totals, streak, cardStats, activityByDay,
    localDay, dayNumber, RANGE_DAYS, GRADES, GRADE_LABELS, gradeCounts, groupByType,
    namespacesOf, groupByNamespace, hardest, trendingDown, bestGradeByCharacter,
    listProgress, wallCells, wallGroups, studiedOverTime, lastStudied, gradeChanges,
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
const donutCanvas = document.querySelector('#kanji-donut');
const donutValue = document.querySelector('#kanji-donut-value');
const donutLegend = document.querySelector('#kanji-donut-legend');
const donutNote = document.querySelector('#kanji-donut-note');
const wallEl = document.querySelector('#kanji-wall');
const wallLegend = document.querySelector('#wall-legend');
const wallDesc = document.querySelector('#wall-desc');
const wallNote = document.querySelector('#wall-note');
const studiedCanvas = document.querySelector('#studied-chart');
const studiedDesc = document.querySelector('#studied-desc');
const studiedNote = document.querySelector('#studied-note');
const promotionsScope = document.querySelector('#promotions-scope');
const promotedEl = document.querySelector('#promoted-count');
const demotedEl = document.querySelector('#demoted-count');
const startedEl = document.querySelector('#started-count');
const shiftList = document.querySelector('#shift-list');





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

function sinceLabel(iso, now = new Date()) {
    if (!iso) return 'never';

    const days = dayNumber(localDay(now)) - dayNumber(localDay(iso));

    if (days <= 0) return 'today';
    if (days < 14) return `${days}d ago`;
    if (days < 63) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
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
    const cards = getCards();

    const t = totals(sessions);
    const byCard = cardStats(sessions); // This period
    const allByCards = cardStats(log);  // All time
    const beforeByCard = cardStats(sessionsBefore(log, range));

    const s = streak(log);
    const changes = gradeChanges(cards, beforeByCard, allByCards);

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
        tile('Promoted',       changes.promoted, `${changes.demoted} demoted, ${changes.started} started`),
        tile('Current streak', plural(s.current, 'day'), `longest ${s.longest}, all time`),
    );


    const byId = new Map(cards.map((c) => [c.id, c]));

    // All time
    renderKanjiDonut(cards, allByCards);
    renderKanjiWall(cards, allByCards);

    // In a period
    renderStudied(log, range);
    renderPromotions(changes, range);
    renderHeatmap(sessions, range);
    renderTypeBars(cards, byCard, allByCards);
    renderTagBars(cards, byCard, allByCards);
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

    // Kanji wall: open a card, and highlight a school grade from the legend
    wallEl.addEventListener('click', (event) => {
        const cell = event.target.closest('.wall__cell[data-card]');
        if (cell) onEdit(cell.dataset.card);
    });

    wallLegend.addEventListener('mouseover', (event) => {
        const item = event.target.closest('.wall-legend__item');
        if (item) wallEl.dataset.focus = item.dataset.school;
    });

    wallLegend.addEventListener('mouseleave', () => {
        delete wallEl.dataset.focus;
    });

    // Promotions
    shiftList.addEventListener('click', (event) => {
        const btn = event.target.closest('.shift-row__card');
        if (btn) onEdit(btn.dataset.id);
    });

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

// One labeled row
function barRow(label, cards, byCard, allByCard) {
    const row = barTemplate.content.firstElementChild.cloneNode(true);
    const counts = gradeCounts(cards, byCard);
    const { lastAt, never } = lastStudied(cards, allByCard);

    row.querySelector('[data-field="label"]').textContent = label;
    row.querySelector('[data-field="bar"]').replaceWith(stackedBar(counts, cards.length));
    row.querySelector('[data-field="note"]').textContent =
        `${counts.mastered}/${cards.length} · ${sinceLabel(lastAt)}`;

    const details = GRADES
        .filter((g) => counts[g])
        .map((g) => `${GRADE_LABELS[g]}: ${counts[g]}`);

    if (lastAt) {
        const date = new Date(lastAt).toLocaleDateString(undefined,
            { month: 'short', day: 'numeric', year: 'numeric' });
        details.push(`Last studied ${date}`);

        if (never > 0) details.push(`${never} never studied`);
    } else {
        details.push('Never studied');
    }

    row.title = details.join(' · ');

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

// --- Kanji Donut ---
const DONUT_ORDER = ['mastered', 'familiar', 'shaky', 'learning', 'unstudied', 'empty'];
const DONUT_LABELS = { ...GRADE_LABELS, empty: 'Not in your collection' };

const tokenFor = (slot) => (slot === 'empty' ? '--kanji-empty' : `--grade-${slot}`);


function donutLegendItem(slot, value) {
    const item = document.createElement('li');
    item.className = 'legend__item';
    item.dataset.grade = slot;
    item.append(DONUT_LABELS[slot]);

    const count = document.createElement('span');
    count.className = 'legend__count';
    count.textContent = value.toLocaleString();
    item.append(count);

    return item;
}

async function renderKanjiDonut(cards, byCard) {
    const sheet = await loadKanjiSheet();

    if (!sheet) {
        donutLegend.replaceChildren();
        donutValue.textContent = '—';
        donutNote.textContent = "Could not load Kanji data.";
        return;
    }

    const progress = listProgress(bestGradeByCharacter(cards, byCard), sheet, inTop2500);
    const values = DONUT_ORDER.map((slot) =>
        slot === 'empty' ? progress.missing : progress.counts[slot]);

    // --- Text ---
    donutValue.textContent = progress.owned.toLocaleString();

    donutLegend.replaceChildren(
        ...DONUT_ORDER.map((slot, i) => donutLegendItem(slot, values[i])),
    );

    donutNote.textContent = progress.outside
        ? `+${plural(progress.outside, 'kanji card')} outside the 2,500.`
        : '';

    donutCanvas.setAttribute('aria-label',
        `Kanji progress: ${progress.owned} of ${progress.total.toLocaleString()} `
        + `in your collection, ${progress.counts.mastered} mastered.`);
    
    // --- The Chart ---
    const chart = await drawChart(donutCanvas, {
        type: 'doughnut',
        data: {
            labels: DONUT_ORDER.map((slot) => DONUT_LABELS[slot]),
            datasets: [{
                data: values,
                backgroundColor: DONUT_ORDER.map((slot) => cssVar(tokenFor(slot))),
                borderWidth: 0,
                hoverOffset: 6,
            }],
        },
        options: {
            aspectRatio: 1,
            cutout: '74%',
            layout: { padding: 6 },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const pct = (ctx.parsed / progress.total) * 100;
                            const shown = ctx.parsed > 0 && pct < 0.1 ? '<0.1' : pct.toFixed(1);
                            return ` ${ctx.label}: ${ctx.parsed.toLocaleString()} (${shown}%)`;
                        },
                    },
                },
            },
        },
    });

    if (!chart) {
        donutNote.textContent = `${donutNote.textContent} Chart unavailable — the counts beside it are complete.`.trim();
    }

}

// --- Kanji Wall ---
let wallCellEls = [];
let wallColumns = 0;

// Character -> id of a kanji for it
function kanjiCardIds(cards) {
    const ids = new Map();

    for (const card of cards) {
        if (card.type !== 'kanji') continue;

        const character = card.data?.character?.trim();
        if (character && !ids.has(character)) ids.set(character, card.id);
    }

    return ids;
}

function buildWall(cells) {
    wallCellEls = cells.map(({ character, school }) => {
        const el = document.createElement('span');
        el.className = 'wall__cell';
        el.textContent = character;
        el.dataset.school = school;
        return el;
    });

    wallEl.replaceChildren(...wallCellEls);

    new ResizeObserver(outlineWall).observe(wallEl);
}

function wallColumnCount() {
    if (wallEl.clientWidth === 0) return 0;

    return getComputedStyle(wallEl).gridTemplateColumns.split(' ').length;
}

function outlineWall() {
    const cols = wallColumnCount();
    if (cols === 0 || cols === wallColumns) return;
    wallColumns = cols;

    const n = wallCellEls.length;
    const schoolAt = (i) => wallCellEls[i]?.dataset.school;

    wallCellEls.forEach((el, i) => {
        const school = schoolAt(i);
        const col = i % cols;

        el.toggleAttribute('data-edge-top',    i < cols || schoolAt(i - cols) !== school);
        el.toggleAttribute('data-edge-bottom', i + cols >= n || schoolAt(i + cols) !== school);
        el.toggleAttribute('data-edge-left',   col === 0 || schoolAt(i - 1) !== school);
        el.toggleAttribute('data-edge-right',  col === cols - 1 || i === n - 1 || schoolAt(i + 1) !== school);
    });
}

function paintWall(cells, cardIds) {
    cells.forEach((cell, i) => {
        const el = wallCellEls[i];
        const cardId = cardIds.get(cell.character);

        el.dataset.grade = cell.grade;

        if (cardId) {
            el.dataset.card = cardId;
        } else {
            delete el.dataset.card;
        }

        const status = cell.grade === 'empty' ? 'Not in your collection' : GRADE_LABELS[cell.grade];
        el.title = [cell.character, cell.meaning, schoolGradeName(cell.school), status]
            .filter(Boolean)
            .join(' · ');

    });
}

function wallLegendItem(school, { owned, total }) {
    const item = document.createElement('li');
    item.className = 'wall-legend__item';
    item.dataset.school = school;
    item.title = schoolGradeName(school);

    const label = document.createElement('span');
    label.lang = 'ja';
    label.textContent = schoolGradeShort(school);

    const count = document.createElement('span');
    count.className = 'wall-legend__count';
    count.textContent = `${owned}/${total}`;

    item.append(label, count);
    return item;
}

async function renderKanjiWall(cards, byCard) {
    const sheet = await loadKanjiSheet();

    if (!sheet) {
        wallNote.textContent = 'Could not load Kanji data.';
        return;
    }

    const best = bestGradeByCharacter(cards, byCard);
    const cells = wallCells(best, sheet, inJoyo);

    if (wallCellEls.length === 0) buildWall(cells);
    paintWall(cells, kanjiCardIds(cards));

    const groups = [...wallGroups(cells)];

    wallLegend.replaceChildren(
        ...groups.map(([school, group]) => wallLegendItem(school, group)),
    );

    const { owned, total, outside } = listProgress(best, sheet, inJoyo);

    wallNote.textContent =
        `${owned.toLocaleString()} of ${total.toLocaleString()} Jōyō kanji in your collection.`
        + (outside ? ` +${plural(outside, 'kanji card')} outside the Jōyō list.` : '');

    wallDesc.textContent = 'Jōyō kanji by school grade. '
        + groups.map(([school, g]) => `${schoolGradeName(school)}: ${g.owned} of ${g.total}`).join('; ')
        + '.';
}

// --- Cards studied over time ---
function bucketLabel(start, size) {
    if (size === 'month') {
        return start.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    }
    return start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function bucketTitle(start, size) {
    if (size === 'week') return `Week of ${bucketLabel(start, size)}`;
    if (size === 'month') {
        return start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    return start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

async function renderStudied(log, range) {
    const { size, buckets } = studiedOverTime(log, range);

    const newCards = buckets.map((b) => b.newCards);
    const reviews = buckets.map((b) => b.reviews);

    const totalNew = newCards.reduce((sum, n) => sum + n, 0);
    const totalReviews = reviews.reduce((sum, n) => sum + n, 0);

    // --- Text ---
    const busiest = buckets.reduce((best, b) =>
        b.newCards + b.reviews > best.newCards + best.reviews ? b : best);
    const busiestTotal = busiest.newCards + busiest.reviews;

    studiedNote.textContent = busiestTotal === 0
        ? 'Nothing studied in this period.'
        : `${plural(totalNew, 'new card')} and ${plural(totalReviews, 'review')}, one point per ${size}. `
          + `Busiest: ${bucketTitle(busiest.start, size)}, ${plural(busiestTotal, 'card')}.`;

    studiedCanvas.setAttribute('aria-label',
        `Cards studied per ${size}: ${totalNew} new, ${totalReviews} reviews.`);

    studiedDesc.textContent = `Cards studied per ${size}. `
        + buckets
            .filter((b) => b.newCards + b.reviews > 0)
            .map((b) => `${bucketTitle(b.start, size)}: ${b.newCards} new, ${b.reviews} reviews`)
            .join('; ');

    // --- The chart ---
    const newColor = cssVar('--series-new');
    const reviewColor = cssVar('--series-review');

    const chart = await drawChart(studiedCanvas, {
        type: 'line',
        data: {
            labels: buckets.map((b) => bucketLabel(b.start, size)),
            datasets: [
                {
                    label: 'Review',
                    data: reviews,
                    borderColor: reviewColor,
                    backgroundColor: withAlpha(reviewColor, 0.18),
                    fill: 'origin',
                },
                {
                    label: 'New',
                    data: newCards,
                    borderColor: newColor,
                    backgroundColor: withAlpha(newColor, 0.22),
                    fill: '-1',
                },
            ],
        },
        options: {
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            elements: {
                line: { borderWidth: 2, tension: 0 },
                point: { radius: buckets.length === 1 ? 4 : 0, hoverRadius: 4, hitRadius: 12 },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { autoSkip: true, maxTicksLimit: 8, maxRotation: 0 },
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    border: { display: false },
                    grid: { color: cssVar('--border') },
                    ticks: { precision: 0, maxTicksLimit: 5 },
                },
            },
            plugins: {
                tooltip: {
                    // New is drawn on top, so list it first
                    itemSort: (a, b) => b.datasetIndex - a.datasetIndex,
                    footerColor: cssVar('--text-muted'),
                    footerFont: { weight: 'normal' },
                    callbacks: {
                        title: (items) => bucketTitle(buckets[items[0].dataIndex].start, size),
                        label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}`,
                        labelColor: (ctx) => ({
                            borderColor: ctx.dataset.borderColor,
                            backgroundColor: ctx.dataset.borderColor,
                        }),
                        footer: (items) => `Total: ${items.reduce((sum, i) => sum + i.parsed.y, 0)}`,
                    },
                },
            },
        },
    });

    if (!chart) {
        studiedNote.textContent = `${studiedNote.textContent} Chart unavailable.`.trim();
    }
}

// --- Promotions ---
const SHIFT_EXAMPLES = 5;

function shiftGrade(grade) {
    const span = document.createElement('span');
    span.className = 'legend__item';
    span.dataset.grade = grade;
    span.textContent = GRADE_LABELS[grade];
    return span;
}

function shiftRow({ from, to, cards }) {
    const row = document.createElement('li');
    row.className = 'shift-row';

    const grades = document.createElement('span');
    grades.className = 'shift-row__grades';
    grades.append(shiftGrade(from), '→', shiftGrade(to));

    const count = document.createElement('span');
    count.className = 'shift-row__count';
    count.textContent = `×${cards.length}`;

    const examples = document.createElement('span');
    examples.className = 'shift-row__cards';

    for (const card of cards.slice(0, SHIFT_EXAMPLES)) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'shift-row__card';
        btn.dataset.id = card.id;
        btn.lang = 'ja';
        btn.title = card.meaning;
        renderJapanese(btn, cardText(card), { links: false });
        examples.append(btn);
    }

    if (cards.length > SHIFT_EXAMPLES) {
        const more = document.createElement('span');
        more.className = 'shift-row__more';
        more.textContent = `+${cards.length - SHIFT_EXAMPLES} more`;
        examples.append(more);
    }

    row.append(grades, count, examples);
    return row;
}

function renderPromotions({ promoted, demoted, started, transitions }, range) {
    promotionsScope.textContent = range === 'all'
        ? 'Since your first session. Every card starts at Learning.'
        : `Compared with where each card stood before ${RANGE_LABELS[range]}. `
          + 'Every card starts at Learning.';

    promotedEl.textContent = `↑ ${promoted}`;
    demotedEl.textContent = `↓ ${demoted}`;
    startedEl.textContent = started;

    if (transitions.length === 0) {
        shiftList.replaceChildren(note('No card changed grade in this period.'));
        return;
    }

    shiftList.replaceChildren(...transitions.map(shiftRow));
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

function renderTypeBars(cards, byCard, allByCard) {
    const groups = groupByType(cards);

    if (groups.length === 0) {
        typeBarsEl.replaceChildren(note('No cards yet.'));
        return;
    }

    typeBarsEl.replaceChildren(
        ...groups.map(([label, group]) => barRow(label, group, byCard, allByCard))
    );
}

function renderTagBars(cards, byCard, allByCard) {
    const namespaces = namespacesOf(cards);

    if (namespaces.length === 0) {
        tagBarsEl.replaceChildren(note('No tags yet.'));
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
            fragment.append(barRow(value, group, byCard, allByCard));
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
