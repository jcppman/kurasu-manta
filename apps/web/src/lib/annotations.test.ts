import type { Annotation, KnowledgePoint } from '@kurasu-manta/content-schema/zod'
import { describe, expect, it } from 'vitest'
import { getSegments } from './annotations'

describe('getSegments', () => {
  it.each([
    {
      description: 'single text segment for non-vocabulary knowledge point',
      type: 'grammar' as const,
      content: 'これは文法です',
      annotations: undefined,
      expected: [{ text: 'これは文法です' }],
    },
    {
      description: 'single text segment for vocabulary without furigana annotations',
      type: 'vocabulary' as const,
      content: 'ひらがな',
      annotations: [],
      expected: [{ text: 'ひらがな' }],
    },
    {
      description: 'vocabulary with single furigana annotation',
      type: 'vocabulary' as const,
      content: '学校',
      annotations: [{ id: 1, type: 'furigana' as const, content: 'がっこう', loc: 0, len: 2 }],
      expected: [{ text: '学校', furigana: 'がっこう' }],
    },
    {
      description: 'vocabulary with furigana annotation in middle',
      type: 'vocabulary' as const,
      content: 'の学校で',
      annotations: [{ id: 1, type: 'furigana' as const, content: 'がっこう', loc: 1, len: 2 }],
      expected: [{ text: 'の' }, { text: '学校', furigana: 'がっこう' }, { text: 'で' }],
    },
    {
      description: 'vocabulary with multiple furigana annotations',
      type: 'vocabulary' as const,
      content: '日本語',
      annotations: [
        { id: 1, type: 'furigana' as const, content: 'にほん', loc: 0, len: 2 },
        { id: 2, type: 'furigana' as const, content: 'ご', loc: 2, len: 1 },
      ],
      expected: [
        { text: '日本', furigana: 'にほん' },
        { text: '語', furigana: 'ご' },
      ],
    },
    {
      description: 'ignoring non-furigana annotations',
      type: 'vocabulary' as const,
      content: '学校の',
      annotations: [
        { id: 1, type: 'other' as const, content: 'particle', len: 1, loc: 2 },
        { id: 2, type: 'furigana' as const, content: 'がっこう', loc: 0, len: 2 },
      ],
      expected: [{ text: '学校', furigana: 'がっこう' }, { text: 'の' }],
    },
    {
      description: 'empty content',
      type: 'vocabulary' as const,
      content: '',
      annotations: [],
      expected: [],
    },
    {
      description: 'complex sentence with multiple kanji and furigana',
      type: 'vocabulary' as const,
      content: 'この世界はとても綺麗ですから、ちゃんと守るよ。',
      annotations: [
        { id: 1, type: 'furigana' as const, content: 'せかい', loc: 2, len: 2 },
        { id: 2, type: 'furigana' as const, content: 'きれい', loc: 8, len: 2 },
        { id: 3, type: 'furigana' as const, content: 'まも', loc: 19, len: 1 },
      ],
      expected: [
        { text: 'この' },
        { text: '世界', furigana: 'せかい' },
        { text: 'はとても' },
        { text: '綺麗', furigana: 'きれい' },
        { text: 'ですから、ちゃんと' },
        { text: '守', furigana: 'まも' },
        { text: 'るよ。' },
      ],
    },
    {
      description: 'consecutive furigana annotations',
      type: 'vocabulary' as const,
      content: '学生です',
      annotations: [
        { id: 1, type: 'furigana' as const, content: 'がく', loc: 0, len: 1 },
        { id: 2, type: 'furigana' as const, content: 'せい', loc: 1, len: 1 },
      ],
      expected: [
        { text: '学', furigana: 'がく' },
        { text: '生', furigana: 'せい' },
        { text: 'です' },
      ],
    },
    {
      description: 'overlapping annotations by sorting by location',
      type: 'vocabulary' as const,
      content: '日本先生',
      annotations: [
        { id: 2, type: 'furigana' as const, content: 'せんせい', loc: 2, len: 2 },
        { id: 1, type: 'furigana' as const, content: 'にほん', loc: 0, len: 2 },
      ],
      expected: [
        { text: '日本', furigana: 'にほん' },
        { text: '先生', furigana: 'せんせい' },
      ],
    },
    {
      description: 'single character with furigana at end',
      type: 'vocabulary' as const,
      content: 'この人',
      annotations: [{ id: 1, type: 'furigana' as const, content: 'ひと', loc: 2, len: 1 }],
      expected: [{ text: 'この' }, { text: '人', furigana: 'ひと' }],
    },
    {
      description: 'mixed annotation types with furigana',
      type: 'vocabulary' as const,
      content: '学校にいる',
      annotations: [
        { id: 1, type: 'grammar' as const, content: 'particle', loc: 2, len: 1 },
        { id: 2, type: 'furigana' as const, content: 'がっこう', loc: 0, len: 2 },
        { id: 3, type: 'emphasis' as const, content: 'important', loc: 3, len: 2 },
      ],
      expected: [{ text: '学校', furigana: 'がっこう' }, { text: 'にいる' }],
    },
    {
      description: 'long text with spaced furigana annotations',
      type: 'vocabulary' as const,
      content: '日本で勉強します',
      annotations: [
        { id: 1, type: 'furigana' as const, content: 'にほん', loc: 0, len: 2 },
        { id: 2, type: 'furigana' as const, content: 'べんきょう', loc: 3, len: 2 },
      ],
      expected: [
        { text: '日本', furigana: 'にほん' },
        { text: 'で' },
        { text: '勉強', furigana: 'べんきょう' },
        { text: 'します' },
      ],
    },
  ])('should handle $description', ({ type, content, annotations, expected }) => {
    const knowledgePoint: KnowledgePoint = {
      id: 1,
      type,
      content,
      ...(type === 'vocabulary' ? { annotations: annotations || [], pos: '' } : {}),
      lessonId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      explanation: {},
    }

    const result = getSegments(knowledgePoint)

    expect(result).toEqual(expected)
  })
})
