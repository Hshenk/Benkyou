import { getClient, currentUser, sendMagicLink, signOut } from "../supabase.js";
import { syncSessions } from "../sync.js";

const accountBtn = document.querySelector('#account-btn');
const dialog = document.querySelector('#account-dialog');
const stateEl = document.querySelector('#account-state');
const emailField = document.querySelector('#account-email-field');
const emailInput = document.querySelector('#account-email');
const warnEl = document.querySelector('#account-warn');
const sendBtn = dialog.querySelector('[data-account="send"]');
const signoutBtn = dialog.querySelector('[data-account="signout"]');


function render(user) {
    accountBtn.textContent = user ? 'Synced' : 'Sign in';
    accountBtn.title = user ? `Signed in as ${user.email}` : 'Sign in to sync sessions';

    stateEl.textContent = user
        ? `Signed in as ${user.email}. Sessions sync automatically.`
        : 'Sessions are stored on this device only.';
    
        emailField.hidden = Boolean(user);
        sendBtn.hidden = Boolean(user);
        signoutBtn.hidden = !user;
}

function warn(message) {
    warnEl.hidden = !message;
    warnEl.textContent = message ?? '';
}

export async function initAccount() {
    accountBtn.addEventListener('click', async () => {
        warn(null);
        render(await currentUser());
        dialog.showModal();
    });

    dialog.addEventListener('click', async (event) => {
        const action = event.target.closest('[data-account]')?.dataset.account;
        if (!action) return;

        if (action === 'close') { dialog.closest(); return; }

        if (action === 'signout') {
            await signOut();
            render(null);
            return;
        }

        const email = emailInput.value.trim();
        if (!email) return;

        sendBtn.disabled = true;
        try {
            await sendMagicLink(email);
            warn(null);
            stateEl.textContent = `Link sent to ${email}. Open it on this device.`;
        } catch (err) {
            warn(err.message);
        } finally {
            sendBtn.disabled = false;
        }
    });

    const sb = await getClient();
    if (!sb) { render(null); return; }

    sb.auth.onAuthStateChange((event, session) => {
        render(session?.user ?? null);
        if (event === 'SIGNED_IN') {
            dialog.close();
            syncSessions().then((r) => r && console.log('Synced sessions', r));
        }
    });

    render(await currentUser());
}