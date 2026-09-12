const COLORS = {
    r: 'red', red: 'red',
    b: 'blue', blue: 'blue',
    y: 'yellow', yellow: 'yellow',
};


/**
 * From an opening delimiter at 'start' find the matching 'close'
 * Returns { inner, end } or null if there is no close
 */
function findClose(text, start, closeChar) {
    let i = start + 1;
    let inner = '';

    while (i < text.length) {
        const ch = text[i];

        if (ch === '\\' && i + 1 < text.length) {
            inner += text[i + 1];
            i += 2;
            continue;
        }
        if (ch === closeChar) {
            return { inner, end: i + 1};
        }
        inner += ch;
        i++
    }
    return null;
}

function takeBase(buffer) {
    const m = /(\s?)(\S+)$/.exec(buffer);
    if (!m) return null;
    return { base: m[2], rest: buffer.slice(0, m.index) };
}

export function tokenize(text) {
    const tokens = [];
    let buffer = '';
    let i = 0;

    const flush = () => {
        if (buffer) tokens.push({ type: 'text', value: buffer });
        buffer = '';
    };

    while (i < text.length) {
        const ch = text[i];

        // ---- Escapes: \[ \{ \* \\ ---
        if (ch === '\\' && i + 1 < text.length) {
            buffer += text[i + 1];
            i += 2;
            continue;
        }

        // --- Highlight: *color:inner* ---
        if (ch === '*') {
            const found = findClose(text, i, '*');
            const colon = found ? found.inner.indexOf(':') : -1;
            const color = colon !== -1 ? COLORS[found.inner.slice(0, colon).trim()] : undefined;

            if (color) {
                flush();
                tokens.push({
                    type: 'highlight', color,
                    inner: tokenize(found.inner.slice(colon + 1)),
                });
                i = found.end;
                continue;
            }
            buffer += ch; i++; continue;
        }

        // --- Link: {term} or {display|target} ---
        if (ch === '{') {
            const found = findClose(text, i, '}');
            if (found) {
                flush();
                const pipe = found.inner.indexOf('|');
                const displaySrc = pipe === -1 ? found.inner : found.inner.slice(0, pipe);
                const targetSrc = pipe === -1 ? null : found.inner.slice(pipe + 1);

                const inner = tokenize(displaySrc);
                tokens.push({
                    type: 'link',
                    term: (targetSrc ?? plainText(inner)).trim(),
                    inner,
                });
                i = found.end;
                continue;
            }
            buffer += ch; i++; continue;
        }

        // --- Furigana: base[reading] ---
        if (ch === '[') {
            const found = findClose(text, i, ']');
            const taken = found ? takeBase(buffer) : null;
            if (taken) {
                buffer = taken.rest;
                flush();
                tokens.push({ type: 'furigana', base: taken.base, reading: found.inner });
                i = found.end;
                continue;
            }
            buffer += ch; i++; continue;
        }

        buffer += ch;
        i++;
    }

    flush();
    return tokens;
}

export function plainText(tokens) {
    return tokens.map((t) => {
        switch (t.type) {
            case 'text': return t.value;
            case 'furigana': return t.base;
            case 'link':
            case 'highlight': return plainText(t.inner);
            default: return '';
        }
    }).join('');
}


export function kanaText(tokens) {
    return tokens.map((t) => {
        switch (t.type) {
            case 'text': return t.value;
            case 'furigana': return t.reading;
            case 'link':
            case 'highlight': return kanaText(t.inner);
            default: return '';
        }
    }).join('');
}
