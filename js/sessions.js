/**
 * sessions.js - the shape of the study log.
 * 
 */

const SCHEMA_VERSION = 1;

export function emptyLog() {
    return { schemaVersion: SCHEMA_VERSION, exportedAt: null, sessions: [], practice: [] };
}

export const STUDY_SIDES = ['japanese', 'english', 'mix'];

export function sessionSide(session) {
    return STUDY_SIDES.includes(session.side) ? session.side : 'japanese'; // Default to Japanese from before this was a recorded feature
}

export function serializeLog(log) {
    return JSON.stringify(log, null, 2);
}

function isSession(s) {
    return s
        && typeof s.id === 'string'
        && typeof s.startedAt === 'string'
        && Array.isArray(s.results);
}

function isPractice(p) {
    return p
        && typeof p.id === 'string'
        && typeof p.practicedAt === 'string'
        && Array.isArray(p.kanji);
}

export function parseLog(text) {
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('That file is not valid JSON.');
    }

    if (!data || typeof data !== 'object' || !Array.isArray(data.sessions)) {
        throw new Error('That does not look like a Benkyou session log — no sessions array.');
    }

    if (Number(data.schemaVersion) > SCHEMA_VERSION) {
        throw new Error(
            `That log was made by a newer version of Benkyou (schema `
            + `${data.schemaVersion}, this app understands ${SCHEMA_VERSION}).`
        );
    }

    return {
        ...emptyLog(),
        ...data,
        sessions: data.sessions.filter(isSession),
        practice: Array.isArray(data.practice) ? data.practice.filter(isPractice) : [],
    };

}

/**
 * Union by id, oldest first
 */
function mergeById(mine, theirs, time) {
    const byId = new Map();

    for (const record of [...mine, ...theirs]) {
        if (!byId.has(record.id)) byId.set(record.id, record);
    }

    return [...byId.values()].sort((a, b) => a[time].localeCompare(b[time]));
}
export function mergeSessions(mine, theirs) {
    return mergeById(mine, theirs, 'startedAt');
}

export function mergePractice(mine, theirs) {
    return mergeById(mine, theirs, 'practicedAt');
}