import {
    getCollection, buildExport, commitExport, replaceCollection, lastSyncedVersion, isDirty, onChange,
    markSynced, getSessions, buildSessionExport, importSessions,
} from '../storage.js';
import {
    serialize, parseCollection, diffCollections, mergeCollection, syncDecision,
} from '../collection.js';
import { serializeLog, parseLog } from '../sessions.js';

const REPO_URL = './data/cards.json';
const SESSIONS_URL = './data/sessions.json';

const exportBtn = document.querySelector('#export-btn');
const importBtn = document.querySelector('#import-btn');
const importFile = document.querySelector('#import-file');
const dirtyFlag = document.querySelector('#dirty-flag');

const dialog = document.querySelector('#import-dialog');
const dialogFileName = document.querySelector('#import-file-name');
const dialogSummary = document.querySelector('#import-summary');
const dialogWarn = document.querySelector('#import-warn');

let cardsHandle = null;
let sessionsHandle = null;

let onReplaced = () => {};

function downloadFallback(json, filename) {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
}

async function saveTo(handle, filename, json) {
    if (!window.showSaveFilePicker) {
        downloadFallback(json, filename);
        return { written: true, handle: null };
    }

    try {
        handle ??= await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
                description: 'Benkyou data',
                accept: { 'application/json': ['.json'] },
            }],
        });

        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        return { written: true, handle };
    } catch (err) {
        if (err.name === 'AbortError') return { written: false, handle: null };

        console.error('File System Access failed, falling back', err);
        downloadFallback(json, filename);
        return { written: true, handle: null };
    }
}

async function doExport() {
    const payload = buildExport();
    const cards = await saveTo(cardsHandle, 'cards.json', serialize(payload));
    cardsHandle = cards.handle;

    if (cards.written) commitExport(payload);

    const log = await saveTo(sessionsHandle, 'sessions.json', serializeLog(buildSessionExport()));
    sessionsHandle = log.handle;
}

async function fetchRepo() {
    try {
        const res = await fetch(`${REPO_URL}?v=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return null;
        return parseCollection(await res.text());
    } catch (err) {
        console.warn('Repo check skipped:', err.message);
        return null;
    }
}


/**
 * Show the previous resolve with merge / replace / cancel
 */
function askImportChoice(name, diff, incoming, opts = {}) {
    dialog.querySelector('.dialog__title').textContent = opts.title ?? 'Import';
    dialog.querySelector('[data-import="replace"]').textContent = opts.replaceLabel ?? 'Replace';
    dialog.querySelector('[data-import="cancel"]').textContent = opts.cancelLabel ?? 'Cancel';
    
    dialogFileName.textContent =
    `${name} — ${incoming.cards.length} cards, version ${incoming.version}`;

    const rows = [
        ['New cards', diff.added.length],
        ['Changed', diff.changed.length],
        ['Only on this device', diff.localOnly.length],
    ];

    dialogSummary.replaceChildren();
    for (const [label, count] of rows) {
        const row = document.createElement('div');
        row.className = 'summary__row';

        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = count;

        row.append(dt, dd);
        dialogSummary.append(row);
    }

    const losing = diff.localOnly.length;
    dialogWarn.hidden = losing === 0;
    dialogWarn.textContent = 
        `Replace will delete ${losing} card${losing === 1 ? '' : 's'} that exist only here.`;
    
    return new Promise((resolve) => {
        const onClick = (event) => {
            const choice = event.target.closest('[data-import]')?.dataset.import;
            if (!choice) return;
            cleanup();
            resolve(choice);
        };

        const onClose = () => { cleanup(); resolve('cancel'); };

        function cleanup() {
            dialog.removeEventListener('click', onClick);
            dialog.removeEventListener('close', onClose);
            dialog.close();
        }

        dialog.addEventListener('click', onClick);
        dialog.addEventListener('close', onClose);
        dialog.showModal();
    });
}

async function doImport(file) {
    const text = await file.text();

    let data; 
    try {
        data = JSON.parse(text);
    } catch {
        alert('That file is not valid JSON.');
        return;
    }

    if (Array.isArray(data.sessions) && !Array.isArray(data.cards)) {
        const before = getSessions().length;
        importSessions(parseLog(text));
        alert(`Imported ${getSessions().length - before} new session(s).`);
        return;
    }

    let incoming;
    try {
        incoming = parseCollection(text);
    } catch (err) {
        alert(err.message);
        return;
    }

    const local = getCollection();
    const diff = diffCollections(local, incoming);
    const choice = await askImportChoice(file.name, diff, incoming);

    if (choice === 'replace') {
        replaceCollection(incoming, { dirty: false, syncedVersion: incoming.version });
        onReplaced();
    } else if (choice === 'merge') {
        replaceCollection(mergeCollection(local, incoming), {
            dirty: true,
            syncedVersion: incoming.version,
        });
        onReplaced();
    }
}

function updateDirtyFlag() {
    dirtyFlag.hidden = !isDirty();
}

export function initTransfer(options = {}) {
    onReplaced = options.onReplaced ?? (() => {});

    exportBtn.addEventListener('click', doExport);

    importBtn.addEventListener('click', () => importFile.click());

    importFile.addEventListener('change', () => {
        const file = importFile.files?.[0];
        importFile.value = '';
        if (file) doImport(file);
    });

    document.querySelector('#sync-btn')
        .addEventListener('click', () => checkRepo({ quiet: false }));

    onChange(updateDirtyFlag);
    updateDirtyFlag();

    checkRepo();
}

async function checkRepo({ quiet = true } = {}) {
    const remoteLog = await fetchSessions();
    if (remoteLog) importSessions(remoteLog);

    const remote = await fetchRepo();
    if (!remote) {
        if (!quiet) alert('Could not read data/cards.json - see the console for details.');
        return;
    }

    const decision = syncDecision({
        remoteVersion: remote.version,
        lastSyncedVersion: lastSyncedVersion(),
        dirty: isDirty(),
    });

    if (decision === 'fast-forward') {
        replaceCollection(remote, { dirty: false, syncedVersion: remote.version });
        onReplaced();
        console.log(`Synced from repo: version ${remote.version}, ${remote.cards.length} cards`);
        return;
    }

    if (decision === 'diverged') {
        const local = getCollection();
        const diff = diffCollections(local, remote);

        const choice = await askImportChoice('data/cards.json', diff, remote, {
            title: 'The repo has changes, and so do you',
            replaceLabel: 'Take repo',
            cancelLabel: 'Keep mine',
        });

        if (choice === 'replace') {
            replaceCollection(remote, { dirty: false, syncedVersion: remote.version });
            onReplaced();
        } else if (choice === 'merge') {
            replaceCollection(mergeCollection(local, remote), {
                dirty: true,
                syncedVersion: remote.version,
            });
            onReplaced();
        } else {
            markSynced(remote.version);
        }
        return;
    }

    if (!quiet) {
        const message = {
            'up-to-date':  'Already up to date.',
            'local-ahead': 'You have changes the repo doesn\'t. Export when you\'re ready.',
            'stale':       'The repo file is older than what you have. Probably a cached fetch.',
        };
        alert(message[decision]);
    }
}

async function fetchSessions() {
    try {
        const res = await fetch(`${SESSIONS_URL}?v=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return null;
        return parseLog(await res.text());
    } catch (err) {
        console.warn('Session log check skipped:', err.message);
        return null;
    }
}