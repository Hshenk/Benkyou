/**
 * Holds the initial shell and view switching logic
 */

// --- Elements ---
const nav = document.querySelector('.nav');
const views = document.querySelectorAll('.view');
const navButtons = nav.querySelectorAll('.nav__btn');

const VIEW_NAMES = [...views].map((section) =>
section.id.replace('view-', ''));
export const DEFAULT_VIEW = 'cards';

export function viewFromUrl() {
    const name = new URLSearchParams(location.search).get('view');
    return VIEW_NAMES.includes(name) ? name : null;
}

// Write the view into the URL
function recordView(name, record) {
    if (record === 'none') return;

    const url = new URL(location.href);
    if (url.searchParams.get('view') === name) return;

    url.searchParams.set('view', name);
    url.hash = '';

    if (record === 'replace') history.replaceState(null, '', url);
    else history.pushState(null, '', url);
}

// --- View Switching ---
export function showView(name, { record = 'push' } = {}) {
    if (!VIEW_NAMES.includes(name)) name = DEFAULT_VIEW;

    for (const section of views) {
        section.hidden = section.id !== `view-${name}`;
    }

    for (const btn of navButtons) {
        if (btn.dataset.view === name) {
            btn.setAttribute('aria-current', 'page');
        } else {
            btn.removeAttribute('aria-current');
        }
    }
    recordView(name, record);
}

export function initShell() {
    nav.addEventListener('click', (event) => {
        const btn = event.target.closest('.nav__btn');
        if (!btn) return;
        showView(btn.dataset.view);
    });

    window.addEventListener('popstate', () => {
        showView(viewFromUrl() ?? DEFAULT_VIEW, { record: 'none' });
    });
}
