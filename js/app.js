import { initShell, showView, viewFromUrl, DEFAULT_VIEW } from './views/shell.js';
import { initSettings } from './settings.js';
import { initCards } from './views/cards.js';
import { initEditor, openEditor } from './views/editor.js';
import { initStudy } from './views/study.js';
import { initTransfer } from './views/transfer.js';
import { initTags } from './views/tags.js';
import { initStats } from './views/stats.js';
import { initAccount } from './views/account.js';
import { syncAll } from './sync.js';
import { initPractice } from './views/practice.js';



initShell();
initSettings();

initEditor({
    onDone: () => showView('cards'),
});

initCards({
    onEdit: (id) => {
        openEditor(id);
        showView('editor');
    },
});

initStudy();

initPractice();

initTransfer({
    onReplaced: () => {
        openEditor(null);
        showView('cards');
    },
});

initTags();

initStats({
    onEdit: (id) => {
        openEditor(id);
        showView('editor');
    },
});

initAccount();
syncAll().then((result) => {
    if (result.sessions || result.practice) console.log('Synced', result);
});

// "New Card" always shows blank form
document.querySelector('.nav__btn[data-view="editor"]')
    .addEventListener('click', () => openEditor(null));


showView(viewFromUrl() ?? DEFAULT_VIEW, { record: 'replace' });