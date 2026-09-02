import {
    getCollection, buildExport, commitExport, replaceCollection, isDirty, onChange,
} from '../storage.js';
import {
    serialize, parseCollection, diffCollections, mergeCollection,
} from '../collection.js';

const exportBtn = document.querySelector('#export-btn');
const importBtn = document.querySelector('#import-btn');
const importFile = document.querySelector('#import-file');
const dirtyFlag = document.querySelector('#dirty-flag');

const dialog = document.querySelector('#import-dialog');
const dialogFileName = document.querySelector('#import-file-name');
const dialogSummary = document.querySelector('#import-summary');
const dialogWarn = document.querySelector('#import-warn');

let fileHandle = null;

let onReplaced = () => {};

function downloadFallback(json) {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'cards.json';
    a.click();

    URL.revokeObjectURL(url);
}

async function doExport() {
    const payload = buildExport();
    const json = serialize(payload);

    if (window.showSaveFilePicker) {
        try {
            fileHandle ??= await window.showSaveFilePicker({
                suggestedName: 'cards.json',
                types: [{
                    description: 'Benkyou collection',
                    accept: { 'application/json' : ['.json'] },
                }],
            });

            const writable = await fileHandle.createWritable();
            await writable.write(json);
            await writable.close();

            commitExport(payload);
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error('File System Access failed, falling back', err);
            fileHandle = null;
        }
    }

    downloadFallback(json);
    commitExport(payload);
}

/**
 * Show the previous resolve with merge / replace / cancel
 */
function askImportChoice(name, diff, incoming) {
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
    let incoming;
    try {
        incoming = parseCollection(await file.text());
    } catch (err) {
        alert(err.message);
        return;
    }

    const local = getCollection();
    const diff = diffCollections(local, incoming);
    const choice = await askImportChoice(file.name, diff, incoming);

    if (choice === 'replace') {
        replaceCollection(incoming, { synced: true });
        onReplaced();
    } else if (choice === 'merge') {
        replaceCollection(mergeCollection(local, incoming));
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

    onChange(updateDirtyFlag);
    updateDirtyFlag();
}