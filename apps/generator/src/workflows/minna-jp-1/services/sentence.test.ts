import {
  calculateVocabularyAnnotationsFromTokens,
  knowledgeDetails,
  parseAnnotatedSentenceToAnnotations,
} from '@/workflows/minna-jp-1/services/sentence'
import type { Grammar, Vocabulary } from '@kurasu-manta/content-schema/zod'
import { describe, expect, test } from 'vitest'

describe('parseAnnotatedSentenceToAnnotations', () => {
  test('single kanji with furigana', () => {
    const annotated = '古[ふる]い'
    const original = '古い'

    const result = parseAnnotatedSentenceToAnnotations(annotated, original)

    expect(result.length).toBe(1)
    expect(result[0].loc).toBe(0)
    expect(result[0].len).toBe(1)
    expect(result[0].type).toBe('furigana')
    expect(result[0].content).toBe('ふる')
  })

  test('multiple kanji with furigana', () => {
    const annotated = '古[ふる]い傘[かさ]を買[か]いました'
    const original = '古い傘を買いました'

    const result = parseAnnotatedSentenceToAnnotations(annotated, original)

    expect(result.length).toBe(3)

    expect(result[0].loc).toBe(0)
    expect(result[0].len).toBe(1)
    expect(result[0].content).toBe('ふる')

    expect(result[1].loc).toBe(2)
    expect(result[1].len).toBe(1)
    expect(result[1].content).toBe('かさ')

    expect(result[2].loc).toBe(4)
    expect(result[2].len).toBe(1)
    expect(result[2].content).toBe('か')
  })

  test('compound kanji words', () => {
    const annotated = '私[わたし]は学校[がっこう]に行[い]きます'
    const original = '私は学校に行きます'

    const result = parseAnnotatedSentenceToAnnotations(annotated, original)

    expect(result.length).toBe(3)

    expect(result[0].loc).toBe(0)
    expect(result[0].len).toBe(1)
    expect(result[0].content).toBe('わたし')

    expect(result[1].loc).toBe(2)
    expect(result[1].len).toBe(2)
    expect(result[1].content).toBe('がっこう')

    expect(result[2].loc).toBe(5)
    expect(result[2].len).toBe(1)
    expect(result[2].content).toBe('い')
  })

  test('no furigana', () => {
    const annotated = 'これはペンです'
    const original = 'これはペンです'

    const result = parseAnnotatedSentenceToAnnotations(annotated, original)

    expect(result.length).toBe(0)
  })

  test('with punctuation', () => {
    const annotated = '失礼[しつれい]ですが、お名前[なまえ]は何[なん]ですか。'
    const original = '失礼ですが、お名前は何ですか。'

    const result = parseAnnotatedSentenceToAnnotations(annotated, original)

    expect(result.length).toBe(3)

    expect(result[0].loc).toBe(0)
    expect(result[0].len).toBe(2)
    expect(result[0].content).toBe('しつれい')

    // お名前 - the kanji part starts at position 7 (名前)
    expect(result[1].loc).toBe(7)
    expect(result[1].len).toBe(2)
    expect(result[1].content).toBe('なまえ')

    // 何 - position 10
    expect(result[2].loc).toBe(10)
    expect(result[2].len).toBe(1)
    expect(result[2].content).toBe('なん')
  })

  test('consecutive kanji as separate annotations', () => {
    const annotated = '日本[にほん]人[じん]です'
    const original = '日本人です'

    const result = parseAnnotatedSentenceToAnnotations(annotated, original)

    expect(result.length).toBe(2)

    // First annotation for 日本 (positions 0-1)
    expect(result[0].loc).toBe(0)
    expect(result[0].len).toBe(2)
    expect(result[0].content).toBe('にほん')

    // Second annotation for 日本人 (positions 0-2) - includes all consecutive kanji
    expect(result[1].loc).toBe(0)
    expect(result[1].len).toBe(3)
    expect(result[1].content).toBe('じん')
  })

  test('trim whitespace from furigana', () => {
    const annotated = '古[ ふる ]い'
    const original = '古い'

    const result = parseAnnotatedSentenceToAnnotations(annotated, original)

    expect(result.length).toBe(1)
    expect(result[0].content).toBe('ふる')
  })

  test('missing closing bracket throws error', () => {
    const annotated = '古[ふるい'
    const original = '古い'

    expect(() => {
      parseAnnotatedSentenceToAnnotations(annotated, original)
    }).toThrow(/Malformed annotation: missing closing bracket after position 1/)
  })

  test('character mismatch throws error', () => {
    const annotated = '古[ふる]い'
    const original = '新い'

    expect(() => {
      parseAnnotatedSentenceToAnnotations(annotated, original)
    }).toThrow(/Character mismatch at position 0: expected '新', got '古'/)
  })

  test('annotated sentence longer throws error', () => {
    const annotated = '古[ふる]いです'
    const original = '古い'

    expect(() => {
      parseAnnotatedSentenceToAnnotations(annotated, original)
    }).toThrow(/Annotated sentence is longer than original sentence/)
  })

  test('original sentence longer throws error', () => {
    const annotated = '古[ふる]い'
    const original = '古いです'

    expect(() => {
      parseAnnotatedSentenceToAnnotations(annotated, original)
    }).toThrow(/Original sentence is longer than annotated sentence/)
  })
})

describe('knowledgeDetails', () => {
  test('basic knowledge point without explanation', () => {
    const input: Vocabulary = {
      id: 123,
      content: '私',
      type: 'vocabulary',
      lessonId: 1,
      explanation: {
        zhCN: '我',
      },
      pos: '',
      annotations: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = knowledgeDetails(input)

    expect(result).toBe(
      '<knowledge id="123"><content>私</content><explain>我</explain></knowledge>'
    )
  })

  test('knowledge point with explanation', () => {
    const input: Vocabulary = {
      id: 456,
      content: '学校',
      explanation: {
        zhCN: '学校',
      },
      type: 'vocabulary',
      lessonId: 1,
      pos: '',
      annotations: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = knowledgeDetails(input)

    expect(result).toBe(
      '<knowledge id="456"><content>学校</content><explain>学校</explain></knowledge>'
    )
  })

  test('custom parent tag name', () => {
    const input: Grammar = {
      id: 789,
      content: 'です',
      explanation: {
        zhCN: '是',
      },
      type: 'grammar',
      lessonId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = knowledgeDetails(input, 'grammar')

    expect(result).toBe('<grammar id="789"><content>です</content><explain>是</explain></grammar>')
  })

  test('vocabulary tag with explanation', () => {
    const input: Vocabulary = {
      id: 101,
      content: 'お名前',
      explanation: {
        zhCN: '姓名',
      },
      type: 'vocabulary',
      lessonId: 1,
      pos: '',
      annotations: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = knowledgeDetails(input, 'vocabulary')

    expect(result).toBe(
      '<vocabulary id="101"><content>お名前</content><explain>姓名</explain></vocabulary>'
    )
  })
})

describe('calculateVocabularyAnnotationsFromTokens', () => {
  test('single vocabulary match', () => {
    const tokens = ['私', 'は', '日本人', 'です']
    const vocabularies: Vocabulary[] = [{ id: 1, content: '私', type: 'vocabulary' } as Vocabulary]

    const result = calculateVocabularyAnnotationsFromTokens(tokens, vocabularies)

    expect(result.length).toBe(1)
    expect(result[0].loc).toBe(0)
    expect(result[0].len).toBe(1)
    expect(result[0].type).toBe('vocabulary')
    expect(result[0].content).toBe('私')
    expect(result[0].id).toBe(1)
  })

  test('multiple vocabulary matches', () => {
    const tokens = ['私', 'は', '日本人', 'です']
    const vocabularies: Vocabulary[] = [
      { id: 1, content: '私', type: 'vocabulary' } as Vocabulary,
      { id: 2, content: '日本人', type: 'vocabulary' } as Vocabulary,
    ]

    const result = calculateVocabularyAnnotationsFromTokens(tokens, vocabularies)

    expect(result.length).toBe(2)

    expect(result[0].loc).toBe(0)
    expect(result[0].len).toBe(1)
    expect(result[0].content).toBe('私')
    expect(result[0].id).toBe(1)

    expect(result[1].loc).toBe(2)
    expect(result[1].len).toBe(3)
    expect(result[1].content).toBe('日本人')
    expect(result[1].id).toBe(2)
  })

  test('no vocabulary matches', () => {
    const tokens = ['これ', 'は', 'ペン', 'です']
    const vocabularies: Vocabulary[] = [
      { id: 1, content: '私', type: 'vocabulary' } as Vocabulary,
      { id: 2, content: '学校', type: 'vocabulary' } as Vocabulary,
    ]

    const result = calculateVocabularyAnnotationsFromTokens(tokens, vocabularies)

    expect(result.length).toBe(0)
  })

  test('correct position calculation', () => {
    const tokens = ['失礼', 'ですが', '、', 'お名前は', '何', 'ですか', '。']
    const vocabularies: Vocabulary[] = [
      { id: 1, content: 'お名前は', type: 'vocabulary' } as Vocabulary,
      { id: 2, content: '何', type: 'vocabulary' } as Vocabulary,
    ]

    const result = calculateVocabularyAnnotationsFromTokens(tokens, vocabularies)

    expect(result.length).toBe(2)

    // 'お名前は' should start at position 6 (失礼(2) + ですが(3) + 、(1) = 6)
    expect(result[0].loc).toBe(6)
    expect(result[0].len).toBe(4)
    expect(result[0].content).toBe('お名前は')
    expect(result[0].id).toBe(1)

    // '何' should start at position 10 (6 + お名前は(4) = 10)
    expect(result[1].loc).toBe(10)
    expect(result[1].len).toBe(1)
    expect(result[1].content).toBe('何')
    expect(result[1].id).toBe(2)
  })

  test('empty tokens array', () => {
    const tokens: string[] = []
    const vocabularies: Vocabulary[] = [{ id: 1, content: '私', type: 'vocabulary' } as Vocabulary]

    const result = calculateVocabularyAnnotationsFromTokens(tokens, vocabularies)

    expect(result.length).toBe(0)
  })

  test('empty vocabularies array', () => {
    const tokens = ['私', 'は', '学生', 'です']
    const vocabularies: Vocabulary[] = []

    const result = calculateVocabularyAnnotationsFromTokens(tokens, vocabularies)

    expect(result.length).toBe(0)
  })
})

// test.only('generateCombinedAnnotations', async () => {
//   console.log(mock)
//   // Mock generateFuriganaAnnotations to return predefined annotations
//   mock.module('@/workflows/minna-jp-1/services/sentence', {
//     namedExports: {
//       generateFuriganaAnnotations: () => Promise.resolve([
//         { loc: 0, len: 1, type: 'furigana', content: 'わたし' },
//         { loc: 2, len: 2, type: 'furigana', content: 'ちゅうごく' }
//       ]),
//       generateCombinedAnnotations: await import('@/workflows/minna-jp-1/services/sentence').then(m => m.generateCombinedAnnotations)
//     }
//   });
//   const { generateCombinedAnnotations } = await import('@/workflows/minna-jp-1/services/sentence');
//
//   const text = '私は中国人です。';
//   const vocabularies: Vocabulary[] = [
//     {
//       id: 1,
//       content: '私',
//       type: 'vocabulary',
//       lessonId: 1,
//       explanation: { zhCN: '我' },
//       pos: '', annotations: [], createdAt: new Date(), updatedAt: new Date()
//     },
//     {
//       id: 2,
//       content: '中国',
//       type: 'vocabulary',
//       lessonId: 1,
//       explanation: { zhCN: '中国' },
//       pos: '', annotations: [], createdAt: new Date(), updatedAt: new Date()
//     },
//   ]
//
//   const tokens = [
//     '私', 'は', '中国人', 'です'
//   ];
//
//   const result = await generateCombinedAnnotations(text, tokens, vocabularies)
//
//   console.error(result);
// })
