/**
 * render.js turns card text into DOM.
 * Parsing lives in tokenize.js
 */
import { tokenize } from "./tokenize.js";

const JISHO = 'https://jisho.org/search/';

function buildRuby(base, reading) {
    const ruby = document.createElement('ruby');
    ruby.append(base);

    const rpOpen = document.createElement('rp');
    rpOpen.textContent = '(';
    const rt = document.createElement('rt');
    rt.textContent = reading;
    const rpClose = document.createElement('rp');
    rpClose.textContent = ')';

    ruby.append(rpOpen, rt, rpClose);
    return ruby;
}

function appendTokens(tokens, parent, opts) {
    for (const token of tokens) {
        switch (token.type) {
            case 'text':
                parent.append(token.value);
                break;

            case 'furigana':
                parent.append(buildRuby(token.base, token.reading));
                break;
            
            case 'highlight': {
                const span = document.createElement('span');
                span.className = 'hl';
                span.dataset.color = token.color;
                appendTokens(token.inner, span, opts);
                parent.append(span);
                break;
            }

            case 'link': {
                if (!opts.links) {
                    appendTokens(token.inner, parent, opts);
                    break;
                }
                const a = document.createElement('a');
                a.href = JISHO + encodeURIComponent(token.term);
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                appendTokens(token.inner, a, opts);
                parent.append(a);
                break;
            }
        }
    }
}

export function renderJapanese(el, text, opts = {}) {
    const settings = { links: true, ...opts };
    el.replaceChildren();
    appendTokens(tokenize(text ?? ''), el, settings);
}