/**
 * visible.js = Lets a view put off redrawing while it's hidden from view. 
 * Before this, other views were still refreshing, just not rendering.
 */

const waiting = new Map();

/**
 * Wrap a view's render function. Only call it when it's actually on screen
 */
export function whenVisible(section, render) {
    return () => {
        if (!section.hidden) {
            render();
            return;
        }

        if (!waiting.has(section)) waiting.set(section, new Set());
        waiting.get(section).add(render);
    };
}

// shell.js calls this each time it shows a view
export function viewShown(section) {
    const owed = waiting.get(section);
    if (!owed) return;

    waiting.delete(section);
    for (const render of owed) render();
}