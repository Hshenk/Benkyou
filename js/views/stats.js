import { getCards, getSessions, onChange } from '../storage.js';
import { sessionsIn, totals, streak, cardStats, gradeFor } from '../stats.js';

const rangeSelect = document.querySelector('#stats-range');
const leadEl = document.querySelector('#stats-lead');
const gridEl = document.querySelector('#stat-grid');
const emptyEl = document.querySelector('#stats-empty');
const tileTemplate = document.querySelector('#stat-tile-template');


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
}

export function initStats() {
    rangeSelect.addEventListener('change', render);
    onChange(render);
    render();
}