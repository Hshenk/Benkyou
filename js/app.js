import { initShell, showView } from './views/shell.js';
import { initScriptToggle } from './script-toggle.js';
import { initCards } from './views/cards.js';
import { initEditor, openEditor } from './views/editor.js';
import { initStudy } from './views/study.js';
import { initTransfer } from './views/transfer.js';




initShell();
initScriptToggle();

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

initTransfer({
    onReplaced: () => {
        openEditor(null);
        showView('cards');
    },
});

// "New Card" always shows blank form
document.querySelector('.nav__btn[data-view="editor"]')
    .addEventListener('click', () => openEditor(null));


showView('cards');