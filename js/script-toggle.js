
// --- Script toggle ---
// Used to show handwritten vs typed fonts
const SCRIPT_KEY = 'benkyou:script';
const scriptToggle = document.querySelector('#script-toggle');

export function setScript(mode) {
    document.documentElement.dataset.script = mode;
    scriptToggle.setAttribute('aria-pressed', String(mode === 'hand'));

    try {
        localStorage.setItem(SCRIPT_KEY, mode);
    } catch {
        // Private mode or full quota. The toggle still works this session
    }
}

export function toggleScript() {
    setScript(document.documentElement.dataset.script === 'hand' ? 'print' : 'hand');
}

export function initScriptToggle() {
    scriptToggle.addEventListener('click', toggleScript);

    let saved = 'print';
    try {
        saved = localStorage.getItem(SCRIPT_KEY) ?? 'print';
    } catch {}
    setScript(saved);
}

