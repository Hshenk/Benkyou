import { getClient, currentUser } from "./supabase.js";
import { getSessions, importSessions } from './storage.js';


function toRow(session, userId) {
    return {
        id: session.id,
        user_id: userId,
        started_at: session.startedAt,
        ended_at: session.endedAt ?? null,
        facets: session.facets ?? null,
        results: session.results,
    };
}

function toSession(row) {
    return {
        id: row.id,
        startedAt: row.started_at,
        endedAt: row.ended_at ?? undefined,
        facets: row.facets ?? undefined,
        results: row.results ?? [],
    };
}

let running = false;

export async function syncSessions() {
    if (running) return null;

    const sb = await getClient();
    if (!sb) return null;

    const user = await currentUser();
    if (!user) return null;

    running = true;
    try {
        const { data, error } = await sb
            .from('sessions')
            .select('id, started_at, ended_at, facets, results');
        if (error) throw error;

        importSessions({ sessions: data.map(toSession) });

        const remoteIds = new Set(data.map((row) => row.id));
        const missing = getSessions().filter((s) => !remoteIds.has(s.id));

        if (missing.length) {
            const { error: insertError } = await sb
                .from('sessions')
                .insert(missing.map((s) => toRow(s, user.id)));
            if (insertError) throw insertError;
        }

        return { pulled: data.length, pushed: missing.length };
    } catch (err) {
        console.warn('Session sync failed:', err.message);
        return null;
    } finally {
        running = false;
    }
}