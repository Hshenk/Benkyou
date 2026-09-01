import { initShell, showView } from './views/shell.js';
import { initScriptToggle } from './script-toggle.js';
import { initCards } from './views/cards.js';
import { initEditor } from './views/editor.js';
import { initStudy } from './views/study.js';




initShell();
initEditor();
initCards();
initStudy();
initScriptToggle();
showView('cards');