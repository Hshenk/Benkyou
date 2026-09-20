/**
 * settings.js - the preferences kept in this browser
 */


const SCRIPT_KEY = 'benkyou:script';
const FURIGANA_KEY = 'benkyou:furigana';

const SCRIPTS = ['print', 'hand'];
const FURIGANA_MODES = ['reveal', 'hover', 'always'];

const FRONT_FURIGANA = { reveal: 'hidden', hover: 'hover', always: 'shown' };

const root = document.documentElement;
const panel = document.querySelector('#settings-panel');
const settingsBtn = document.querySelector('#settings-btn');
const handInput = document.querySelector('#setting-hand');

// --- Storage ---
function read(key, allowed, fallback) {
    try {
        const saved = localStorage.getItem(key);
        return allowed.includes(saved) ? saved : fallback;
    } catch {
        return fallback;
    }
}

function write(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {}
}

// --- Handwritten forms --- 
export function setScript(mode) {
    root.dataset.script = SCRIPTS.includes(mode) ? mode: 'print';
    handInput.checked = root.dataset.script === 'hand';
    write(SCRIPT_KEY, root.dataset.script);
}

export function toggleScript() {
    setScript(root.dataset.script === 'hand' ? 'print' : 'hand');
}


// --- Furigana ---
export function setFurigana(mode) {
    root.dataset.furiganaMode = FURIGANA_MODES.includes(mode) ? mode : 'reveal';

    const value = root.dataset.furiganaMode;
    const checked = panel.querySelector(`input[name="furigana"][value="${value}"]`);
    if (checked) checked.checked = true;

    write(FURIGANA_KEY, value);
}

export function frontFurigana() {
    return FRONT_FURIGANA[root.dataset.furiganaMode] ?? 'hidden';
}

// --- Wiring ---
function placePanel() {
    const box = settingsBtn.getBoundingClientRect();

    panel.style.top = `${box.bottom + 8}px`;
    panel.style.right = `${root.clientWidth - box.right}px`;
}

export function initSettings() {
    // Position it as it opens so scroll or resizing is fine
    panel.addEventListener('beforetoggle', (event) => {
        if (event.newState === 'open') placePanel();
    });

    panel.addEventListener('change', (event) => {
        const input = event.target;
        if (input === handInput) setScript(input.checked ? 'hand' : 'print');
        else if (input.name === 'furigana') setFurigana(input.value);
    });

    setScript(read(SCRIPT_KEY, SCRIPTS, 'print'));
    setFurigana(read(FURIGANA_KEY, FURIGANA_MODES, 'reveal'));
}

