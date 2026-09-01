// --- Editor ---
const editorForm = document.querySelector('#editor-form');
const typeFieldsets = editorForm.querySelectorAll('[data-type-fields]');

/**
 * Shows only the fieldset matching teh chosen card type.
 */
function showTypeFields(type) {
    for (const fs of typeFieldsets) {
        const active = fs.dataset.typeFields === type;
        fs.hidden = !active;
        fs.disabled = !active;
    }
}

export function initEditor() {
    // Change bubbles, so one listener on the form covers every control in it
    editorForm.addEventListener('change', (event) => {
        if (event.target.name === 'cardType') {
            showTypeFields(event.target.value);
        }
    });

    // Enter also confirms an IME candidate, so don't submit form
    editorForm.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && event.isComposing) {
            event.preventDefault();
        }
    });

    editorForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const data = Object.fromEntries(new FormData(editorForm));
        const intent = event.submitter?.value ?? 'save';

        console.log(intent, data);
    });

    showTypeFields(editorForm.querySelector('input[name="cardType"]:checked').value);
}
