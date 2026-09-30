import { getClient, currentUser } from "./supabase.js";
import { getSessions, getPractice, importLog } from "./storage.js";
import { sessionSide } from "./sessions.js";

// Each synced log: its Supabase table (named the same as its array in the log),
// the columns to read, and how a local record and a table row convert.
const TABLES = {
    sessions: {
        columns: 'id, started_at, ended_at, facets, results, side',
        local: getSessions,
        toRow: (session, userId) => ({
            id: session.id,
            user_id: userId,
            started_at: session.startedAt,
            ended_at: session.endedAt ?? null,
            facets: session.facets ?? null,
            side: sessionSide(session),
            results: session.results,
        }),
        fromRow: (row) => ({
            id: row.id,
            startedAt: row.started_at,
            endedAt: row.ended_at ?? undefined,
            facets: row.facets ?? undefined,
            side: row.side ?? undefined,
            results: row.results ?? [],
        }),
    },
    practice: {
        columns: 'id, practiced_at, kanji',
        local: getPractice,
        toRow: (record, userId) => ({
            id: record.id,
            user_id: userId,
            practiced_at: record.practicedAt,
            kanji: record.kanji,
        }),
        fromRow: (row) => ({
            id: row.id,
            practicedAt: row.practiced_at,
            kanji: row.kanji ?? [],
        }),
    },
};

const running = new Set();

// Pull a table into the local log, then push the records the table doesn't have
async function syncTable(name) {
    if (running.has(name)) return null;
    running.add(name);

    const table = TABLES[name];

    try {
        const sb = await getClient();
        if (!sb) return null;

        const user = await currentUser();
        if (!user) return null;

        const { data, error } = await sb.from(name).select(table.columns);
        if (error) throw error;

        importLog({ [name]: data.map(table.fromRow) });

        const remoteIds = new Set(data.map((row) => row.id));
        const missing = table.local().filter((record) => !remoteIds.has(record.id));

        if (missing.length) {
            const { error: insertError } = await sb
                .from(name)
                .insert(missing.map((record) => table.toRow(record, user.id)));
            if (insertError) throw insertError;
        }

        return { pulled: data.length, pushed: missing.length };
    } catch (err) {
        console.warn(`Sync of ${name} failed:`, err.message);
        return null;
    } finally {
        running.delete(name);
    }
}

export function syncSessions() {
    return syncTable('sessions');
}

export function syncPractice() {
    return syncTable('practice');
}

export async function syncAll() {
    const [sessions, practice] = await Promise.all([syncSessions(), syncPractice()]);
    return { sessions, practice };
}
