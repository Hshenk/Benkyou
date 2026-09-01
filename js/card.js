/**
 * card.js defines what a card is and what it contains
 * Pure functions, no imports
 */
export const TYPE_LABELS = { 
    kanji: 'Kanji', 
    vocab: 'Vocab', 
    sentence: 'Sentence', 
    grammar: 'Grammar' 
};

export function cardText(card) {
    return card.data.expression ?? card.data.character ?? '';
}

/** what teh front of the card asks */
export function questionText(card) {
    if (card.type === 'grammar') return card.data.example;
    return card.data.expression ?? card.data.character ?? '';
}

export function detailsFor(card) {
    switch (card.type) {
        case 'vocab':
            return [['Reading', card.data.reading]];
        case 'kanji':
            return [
                ["On'yomi", card.data.onyomi?.join('、')],
                ["Kun'yomi", card.data.kunyomi?.join('、')],
                ['Strokes', card.data.strokes],
            ];
        case 'sentence':
            return [['Literal', card.data.literal]];
        case 'grammar':
            return [['Point', card.data.expression]];
        default:
            return [];
    }
}