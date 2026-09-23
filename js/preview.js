/**
 * preview.js - shows what a field's notation will render as
 * The rendering itself is in render.js
 */
import { renderJapanese } from './render.js';

/**
 * Wire up every .preview box inside of root
 * returns a function to refresh them all
 */

export function initPreviews(root) {
    const updates = [];

    for (const box of root.querySelectorAll('.preview')) {
        const field = root.querySelector(`#${box.dataset.preview}`);
        if (!field) continue;

        const body = box.querySelector('.preview__body');
    
        const update = () => {
            const text = field.value;
            box.hidden = text.trim() === '';
            if (box.hidden) return;

            renderJapanese(body, text);

            for (const link of body.querySelectorAll('a')) link.tabIndex = -1;
        };

        field.addEventListener('input', update);
        updates.push(update);
    }

    return () => { for (const update of updates) update(); };
}