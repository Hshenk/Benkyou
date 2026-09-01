/**
 * Handles the storage of cards and settings 
 */

const sampleCards = [
    {
        id: 'a1', type: 'vocab', meaning: 'to eat',
        tags: ['Topic: Food', 'Level: N5'],
        data: { expression: '食[た]べる', reading: 'たべる' },
    },
    {
        id: 'a2', type: 'kanji', meaning: 'eat, food',
        tags: ['Level: N5'],
        data: { character: '食', onyomi: ['ショク'], kunyomi: ['た.べる'], strokes: 9 },
    },
    {
        id: 'a3', type: 'sentence', meaning: 'Please (do it for me).',
        tags: ['Topic: Set phrases', 'Source: Nakama 1'],
        data: { expression: 'お 願[ねが]いします', literal: 'I humbly request' },
    },
    {
        id: 'a4', type: 'vocab', meaning: 'study, diligence',
        tags: ['Topic: School', 'Level: N4'],
        data: { expression: '勉強[べんきょう]', reading: 'べんきょう' },
    },
    {
        id: 'a5', type: 'grammar', meaning: 'topic marker — “as for X”',
        tags: ['Topic: Particles', 'Level: N5'],
        data: { expression: 'は', example: '私[わたし]*b:は* 学生[がくせい]です' },
    },
];

export function getCards() {
    return sampleCards;
}