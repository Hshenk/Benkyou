/**
 * sessions.js - the shape of the study log.
 * 
 */

const SCHEMA_VERSION = 1;

export function emptyLog() {
    return { schemaVersion: SCHEMA_VERSION, exportedAt: null, sessions: [] };
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

    return { ...emptyLog(), ...data, sessions: data.sessions.filter(isSession) };
}

/**
 * Union by id, oldest first
 */
export function mergeSessions(mine, theirs) {
    const byId = new Map();

    for (const session of [...mine, ...theirs]) {
        if (!byId.has(session.id)) byId.set(session.id, session);
    }

    return [...byId.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}