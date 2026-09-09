/**
 * supabase.js - the client, loaded lazily so a CDN failure degrades to "no sync"
 */
const SUPABASE_URL = 'https://zptgvdeddcwusswdnvri.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_YOYSpuQMZB6NZozAWPcwNA_fHKEgPVE';

const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

let clientPromise = null;

export function getClient() {
    clientPromise ??= import(CDN)
        .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                storageKey: 'benkyou:auth',
            },
        }))
        .catch((err) => {
            console.warn('Supabase library unavailable:', err.message);
            clientPromise = null;
            return null;
        });

    return clientPromise;
}

export async function currentUser() {
    const sb = await getClient();
    if (!sb) return null;
    const { data } = await sb.auth.getUser();
    return data?.user ?? null;
}

export async function sendMagicLink(email) {
    const sb = await getClient();
    if (!sb) throw new Error('Cannot reach Supabase right now.');

    const { error } = await sb.auth.signInWithOtp({
        email, 
        options: { emailRedirectTo: window.location.href.split('#')[0] },
    });
    if (error) throw error;
}

export async function signOut() {
    const sb = await getClient();
    await sb?.auth.signOut();
}