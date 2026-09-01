/**
 * Holds the initial shell and view switching logic
 */

// --- Elements ---
const nav = document.querySelector('.nav');
const views = document.querySelectorAll('.view');
const navButtons = nav.querySelectorAll('.nav__btn');

// --- View Switching ---
export function showView(name) {
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
}

export function initShell() {
    nav.addEventListener('click', (event) => {
        const btn = event.target.closest('.nav__btn');
        if (!btn) return;
        showView(btn.dataset.view);
    });
}
