/**
 * stats.js - Every calculation the stats view makes
 * 
 * pure functions over (cards, sessions). No DOM or localStorage
 */
import { TYPE_LABELS } from "./card.js";
import { canonicalTag, splitTag } from "./tags.js";

// --- Scoring ---

// Session is scored by the FIRST grade a card got
export const SCORE = { easy: 1, work: 0.5, missed: 0 };

// Sessions needed before a card can be graded above 'learning'
export const SESSION_FLOOR = 3;

const MAX_SESSION_MINUTES = 180;

// --- Days ---
//Local calendar day
export function localDay(value) {
    const d = value instanceof Date ? value : new Date(value);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
}

// A 'YYYY-MM-DD' key as an integer day count
export function dayNumber(key) {
    const [y, m, d] = key.split('-').map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}


// --- Windowing ---
export const RANGE_DAYS = { month: 30, quarter: 90, year: 365, all: null };

export function sessionsIn(sessions, range, now = new Date()) {
    const days = RANGE_DAYS[range];
    if (days == null) return [...sessions];

    const cutoff = new Date(now.getTime() - days * 86400000).toISOString();
    return sessions.filter((s) => s.startedAt >= cutoff);
}

// --- Per-session helpers ---

// Minutes spent in one session
// We return 0 if something is wrong to not count it at all
// Or we return the max session cap, as anything greater is probably an error that would ruin stats
export function minutesOf(session) {
    if (!session.endedAt) return 0;

    const ms = new Date(session.endedAt) - new Date(session.startedAt);
    if(!(ms > 0)) return 0;

    return Math.min(ms / 60000, MAX_SESSION_MINUTES);
}

export function repsOf(session) {
    return session.results.reduce((n, r) => n + (r.misses ?? 0) + 1, 0);
}

// -- Aggregates ---
export function totals(sessions) {
    const unique = new Set();
    let reps = 0;
    let minutes = 0;

    for (const session of sessions) {
        for (const row of session.results) unique.add(row.id);
        reps += repsOf(session);
        minutes += minutesOf(session);
    }

    return {
        sessions: sessions.length,
        uniqueCards: unique.size,
        reps,
        minutes,
        days: new Set(sessions.map((s) => localDay(s.startedAt))).size,
    };
}

// YYYY-MM-DD -> { sessions, cards, reps, minutes }
export function activityByDay(sessions) {
    const byDay = new Map();

    for (const session of sessions) {
        const key = localDay(session.startedAt);
        const entry = byDay.get(key) ?? { sessions: 0, cards: 0, reps: 0, minutes: 0 };

        entry.session += 1;
        entry.cards += session.results.length;
        entry.reps += repsOf(session);
        entry.minutes += minutesOf(session);

        byDay.set(key, entry);
    }

    return byDay;
}

/**
 * streak { current, longest } in days
 * Pass the full log, not a windowed one
 */
export function streak(sessions, now = new Date()) {
    const days = [...new Set(sessions.map((s) => localDay(s.startedAt)))]
        .map(dayNumber)
        .sort((a, b) => a - b);

    if (days.length === 0) return { current: 0, longest: 0 };

    let longest = 1;
    let run = 1;
    for (let i = 1; i < days.length; i++) {
        run = days[i] === days[i -1] + 1 ? run + 1 : 1;
        if (run > longest) longest = run;
    }

    const today = dayNumber(localDay(now));
    if (days[days.length - 1] < today - 1) return { current: 0, longest };

    let current = 1;
    for (let i = days.length - 1; i > 0; i--) {
        if (days[i - 1] !== days[i] - 1) break;
        current += 1;
    }

    return { current, longest };
}

// --- Per-card ---
/**
 * card id -> { sessions, score, misses, skips, firstAt, LastAt, history }
 */
export function cardStats(sessions) {
    const ordered = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    const byCard = new Map();

    for (const session of ordered) {
        for (const row of session.results) {
            const score = SCORE[row.result] ?? 0;

            let entry = byCard.get(row.id);
            if (!entry) {
                entry = {
                    sessions: 0, total: 0, misses: 0, skips: 0, 
                    firstAt: session.startedAt, lastAt: session.startedAt,
                    history: [],
                };
                byCard.set(row.id, entry);
            }

            entry.sessions += 1;
            entry.total += score;
            entry.misses += row.misses ?? 0;
            if (row.skipped) entry.skips += 1;
            entry.lastAt = session.startedAt;
            entry.history.push(score);
        }
    }

    for (const entry of byCard.values()) {
        entry.score = entry.total / entry.sessions;
    }

    return byCard;
}

export const GRADES = ['unstudied', 'learning', 'shaky', 'familiar', 'mastered'];

export const GRADE_LABELS = {
    unstudied: 'Not studied',
    learning: 'Learning',
    shaky:    'Shaky',
    familiar: 'Familiar',
    mastered: 'Mastered',
};

export function gradeFor(entry) {
    if (!entry || entry.sessions === 0) return 'unstudied';
    if (entry.sessions < SESSION_FLOOR) return 'learning';
    if (entry.score < 0.5) return 'shaky';
    if (entry.score < 0.7) return 'familiar';
    return 'mastered';
}

// --- Grouping ---

// How many cards sit at each grid
export function gradeCounts(cards, byCard) {
    const counts = Object.fromEntries(GRADES.map((g) => [g, 0]));
    for (const card of cards) counts[gradeFor(byCard.get(card.id))] += 1;
    return counts;
}

export function groupByType(cards) {
    return Object.entries(TYPE_LABELS)
        .map(([type, label]) => [label, cards.filter((c) => c.type === type)])
        .filter(([, group]) => group.length > 0);
}

export function namespacesOf(cards) {
    const out = new Set();
    for (const card of cards) {
        for (const tag of card.tags ?? []) {
            const { namespace } = splitTag(canonicalTag(tag));
            if (namespace) out.add(namespace);
        }
    }
    return [...out].sort();
}

export function groupByNamespace(cards, namespace) {
    const groups = new Map();

    for (const card of cards) {
        const seen = new Set();

        for (const tag of card.tags ?? []) {
            const { namespace: ns, value } = splitTag(canonicalTag(tag));
            if (ns !== namespace || seen.has(value)) continue;
            seen.add(value);

            if (!groups.has(value)) groups.set(value, []);
            groups.get(value).push(card);
        }
    }

    return [...groups];
}

// --- Ranking ---
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// Worst scoring cards first, gated on exposure
export function hardest(byCard, limit = 8) {
    return [...byCard]
        .filter(([, e]) => e.sessions >= SESSION_FLOOR)
        .sort((a, b) => a[1].score - b[1].score || b[1].sessions - a[1].sessions)
        .slice(0, limit);
}

export const TREND_MIN_SESSIONS = 4;
export const TREND_DROP = 0.25;

// Cards whose recent half scores materially worse than their earlier half
export function trendingDown(byCard, limit = 8) {
    const out = [];

    for (const [id, entry] of byCard) {
        if (entry.sessions < TREND_MIN_SESSIONS) continue;

        const half = Math.floor(entry.history.length / 2);
        const earlier = mean(entry.history.slice(0, half));
        const recent = mean(entry.history.slice(-half));
        const drop = earlier - recent;

        if (drop >= TREND_DROP) out.push([id, { ...entry, earlier, recent, drop }]);
    }

    return out.sort((a, b) => b[1].drop - a[1].drop).slice(0, limit);
}