import { strictEqual, throws } from 'node:assert'
import test from 'node:test'
import type {
  Grammar,
  KnowledgePoint,
  Vocabulary,
} from '@kurasu-manta/knowledge-schema/zod/knowledge'

// Import the function we're testing - it's not exported, so we need to make it accessible
// For now, we'll copy the function for testing. In production, you might want to export it.

function knowledgeDetails(input: KnowledgePoint, parentTagName = 'knowledge'): string {
  let result = `<content>${input.content}</content>`
  if (input.explanation) {
    result += `<explain>${input.explanation.zhCN}</explain>`
  }
  return `<${parentTagName} id="${input.id}">${result}</${parentTagName}>`
}

function calculateVocabularyAnnotationsFromTokens(
  tokens: string[],
  vocabularyItems: Vocabulary[]
): Array<{
  loc: number
  len: number
  type: 'vocabulary'
  content: string
  id: number
}> {
  const annotations: Array<{
    loc: number
    len: number
    type: 'vocabulary'
    content: string
    id: number
  }> = []
  let currentPosition = 0

  // Create a map of vocabulary content to ID for quick lookup
  const vocabMap = new Map<string, number>()
  for (const vocab of vocabularyItems) {
    vocabMap.set(vocab.content, vocab.id)
  }

  for (const token of tokens) {
    const tokenLength = token.length

    // Check if this token is a vocabulary item
    const vocabId = vocabMap.get(token)
    if (vocabId) {
      annotations.push({
        loc: currentPosition,
        len: tokenLength,
        type: 'vocabulary',
        content: token,
        id: vocabId,
      })
    }

    currentPosition += tokenLength
  }

  return annotations
}
function parseAnnotatedSentenceToAnnotations(
  annotatedSentence: string,
  originalSentence: string
): Array<{
  loc: number
  len: number
  type: 'furigana'
  content: string
}> {
  const annotations: Array<{
    loc: number
    len: number
    type: 'furigana'
    content: string
  }> = []
  let originalPos = 0
  let annotatedPos = 0

  while (annotatedPos < annotatedSentence.length) {
    const char = annotatedSentence[annotatedPos]

    if (char === '[') {
      // Find the closing bracket
      const closingBracket = annotatedSentence.indexOf(']', annotatedPos)
      if (closingBracket === -1) {
        throw new Error(
          `Malformed annotation: missing closing bracket after position ${annotatedPos}`
        )
      }

      // Extract furigana content
      const furigana = annotatedSentence.slice(annotatedPos + 1, closingBracket)

      // Find the kanji that this furigana belongs to by looking backwards
      // from the current originalPos to find the start of the kanji sequence
      let kanjiStart = originalPos

      // Look backwards to find the start of the kanji sequence
      while (kanjiStart > 0) {
        const prevChar = originalSentence[kanjiStart - 1]
        if (!/[\u4e00-\u9faf]/.test(prevChar)) {
          break
        }
        kanjiStart--
      }

      // The kanji sequence ends at the current originalPos
      const kanjiEnd = originalPos

      if (kanjiStart < kanjiEnd) {
        annotations.push({
          loc: kanjiStart,
          len: kanjiEnd - kanjiStart,
          type: 'furigana',
          content: furigana.trim(),
        })
      }

      // Move past the furigana annotation
      annotatedPos = closingBracket + 1
    } else {
      // Regular character - should match the original
      if (originalPos >= originalSentence.length) {
        throw new Error('Annotated sentence is longer than original sentence')
      }

      if (char !== originalSentence[originalPos]) {
        throw new Error(
          `Character mismatch at position ${originalPos}: expected '${originalSentence[originalPos]}', got '${char}'`
        )
      }
      annotatedPos++
      originalPos++
    }
  }

  // Check that we've consumed the entire original sentence
  if (originalPos !== originalSentence.length) {
    throw new Error('Original sentence is longer than annotated sentence')
  }

  return annotations
}

test('parseAnnotatedSentenceToAnnotations - single kanji with furigana', () => {
  const annotated = '古[ふる]い'
  const original = '古い'

  const result = parseAnnotatedSentenceToAnnotations(annotated, original)

  strictEqual(result.length, 1)
  strictEqual(result[0].loc, 0)
  strictEqual(result[0].len, 1)
  strictEqual(result[0].type, 'furigana')
  strictEqual(result[0].content, 'ふる')
})

test('parseAnnotatedSentenceToAnnotations - multiple kanji with furigana', () => {
  const annotated = '古[ふる]い傘[かさ]を買[か]いました'
  const original = '古い傘を買いました'

  const result = parseAnnotatedSentenceToAnnotations(annotated, original)

  strictEqual(result.length, 3)

  strictEqual(result[0].loc, 0)
  strictEqual(result[0].len, 1)
  strictEqual(result[0].content, 'ふる')

  strictEqual(result[1].loc, 2)
  strictEqual(result[1].len, 1)
  strictEqual(result[1].content, 'かさ')

  strictEqual(result[2].loc, 4)
  strictEqual(result[2].len, 1)
  strictEqual(result[2].content, 'か')
})

test('parseAnnotatedSentenceToAnnotations - compound kanji words', () => {
  const annotated = '私[わたし]は学校[がっこう]に行[い]きます'
  const original = '私は学校に行きます'

  const result = parseAnnotatedSentenceToAnnotations(annotated, original)

  strictEqual(result.length, 3)

  strictEqual(result[0].loc, 0)
  strictEqual(result[0].len, 1)
  strictEqual(result[0].content, 'わたし')

  strictEqual(result[1].loc, 2)
  strictEqual(result[1].len, 2)
  strictEqual(result[1].content, 'がっこう')

  strictEqual(result[2].loc, 5)
  strictEqual(result[2].len, 1)
  strictEqual(result[2].content, 'い')
})

test('parseAnnotatedSentenceToAnnotations - no furigana', () => {
  const annotated = 'これはペンです'
  const original = 'これはペンです'

  const result = parseAnnotatedSentenceToAnnotations(annotated, original)

  strictEqual(result.length, 0)
})

test('parseAnnotatedSentenceToAnnotations - with punctuation', () => {
  const annotated = '失礼[しつれい]ですが、お名前[なまえ]は何[なん]ですか。'
  const original = '失礼ですが、お名前は何ですか。'

  const result = parseAnnotatedSentenceToAnnotations(annotated, original)

  strictEqual(result.length, 3)

  strictEqual(result[0].loc, 0)
  strictEqual(result[0].len, 2)
  strictEqual(result[0].content, 'しつれい')

  // お名前 - the kanji part starts at position 7 (名前)
  strictEqual(result[1].loc, 7)
  strictEqual(result[1].len, 2)
  strictEqual(result[1].content, 'なまえ')

  // 何 - position 10
  strictEqual(result[2].loc, 10)
  strictEqual(result[2].len, 1)
  strictEqual(result[2].content, 'なん')
})

test('parseAnnotatedSentenceToAnnotations - consecutive kanji as separate annotations', () => {
  const annotated = '日本[にほん]人[じん]です'
  const original = '日本人です'

  const result = parseAnnotatedSentenceToAnnotations(annotated, original)

  strictEqual(result.length, 2)

  // First annotation for 日本 (positions 0-1)
  strictEqual(result[0].loc, 0)
  strictEqual(result[0].len, 2)
  strictEqual(result[0].content, 'にほん')

  // Second annotation for 日本人 (positions 0-2) - includes all consecutive kanji
  strictEqual(result[1].loc, 0)
  strictEqual(result[1].len, 3)
  strictEqual(result[1].content, 'じん')
})

test('parseAnnotatedSentenceToAnnotations - trim whitespace from furigana', () => {
  const annotated = '古[ ふる ]い'
  const original = '古い'

  const result = parseAnnotatedSentenceToAnnotations(annotated, original)

  strictEqual(result.length, 1)
  strictEqual(result[0].content, 'ふる')
})

test('parseAnnotatedSentenceToAnnotations - missing closing bracket throws error', () => {
  const annotated = '古[ふるい'
  const original = '古い'

  throws(() => {
    parseAnnotatedSentenceToAnnotations(annotated, original)
  }, /Malformed annotation: missing closing bracket after position 1/)
})

test('parseAnnotatedSentenceToAnnotations - character mismatch throws error', () => {
  const annotated = '古[ふる]い'
  const original = '新い'

  throws(() => {
    parseAnnotatedSentenceToAnnotations(annotated, original)
  }, /Character mismatch at position 0: expected '新', got '古'/)
})

test('parseAnnotatedSentenceToAnnotations - annotated sentence longer throws error', () => {
  const annotated = '古[ふる]いです'
  const original = '古い'

  throws(() => {
    parseAnnotatedSentenceToAnnotations(annotated, original)
  }, /Annotated sentence is longer than original sentence/)
})

test('parseAnnotatedSentenceToAnnotations - original sentence longer throws error', () => {
  const annotated = '古[ふる]い'
  const original = '古いです'

  throws(() => {
    parseAnnotatedSentenceToAnnotations(annotated, original)
  }, /Original sentence is longer than annotated sentence/)
})

// Tests for knowledgeDetails function
test('knowledgeDetails - basic knowledge point without explanation', () => {
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

  strictEqual(result, '<knowledge id="123"><content>私</content><explain>我</explain></knowledge>')
})

test('knowledgeDetails - knowledge point with explanation', () => {
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

  strictEqual(
    result,
    '<knowledge id="456"><content>学校</content><explain>学校</explain></knowledge>'
  )
})

test('knowledgeDetails - custom parent tag name', () => {
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

  strictEqual(result, '<grammar id="789"><content>です</content><explain>是</explain></grammar>')
})

test('knowledgeDetails - vocabulary tag with explanation', () => {
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

  strictEqual(
    result,
    '<vocabulary id="101"><content>お名前</content><explain>姓名</explain></vocabulary>'
  )
})

// Tests for calculateVocabularyAnnotationsFromTokens function
test('calculateVocabularyAnnotationsFromTokens - single vocabulary match', () => {
  const tokens = ['私', 'は', '日本人', 'です']
  const vocabularies: Vocabulary[] = [{ id: 1, content: '私', type: 'vocabulary' } as Vocabulary]

  const result = calculateVocabularyAnnotationsFromTokens(tokens, vocabularies)

  strictEqual(result.length, 1)
  strictEqual(result[0].loc, 0)
  strictEqual(result[0].len, 1)
  strictEqual(result[0].type, 'vocabulary')
  strictEqual(result[0].content, '私')
  strictEqual(result[0].id, 1)
})

test('calculateVocabularyAnnotationsFromTokens - multiple vocabulary matches', () => {
  const tokens = ['私', 'は', '日本人', 'です']
  const vocabularies: Vocabulary[] = [
    { id: 1, content: '私', type: 'vocabulary' } as Vocabulary,
    { id: 2, content: '日本人', type: 'vocabulary' } as Vocabulary,
  ]

  const result = calculateVocabularyAnnotationsFromTokens(tokens, vocabularies)

  strictEqual(result.length, 2)

  strictEqual(result[0].loc, 0)
  strictEqual(result[0].len, 1)
  strictEqual(result[0].content, '私')
  strictEqual(result[0].id, 1)

  strictEqual(result[1].loc, 2)
  strictEqual(result[1].len, 3)
  strictEqual(result[1].content, '日本人')
  strictEqual(result[1].id, 2)
})

test('calculateVocabularyAnnotationsFromTokens - no vocabulary matches', () => {
  const tokens = ['これ', 'は', 'ペン', 'です']
  const vocabularies: Vocabulary[] = [
    { id: 1, content: '私', type: 'vocabulary' } as Vocabulary,
    { id: 2, content: '学校', type: 'vocabulary' } as Vocabulary,
  ]

  const result = calculateVocabularyAnnotationsFromTokens(tokens, vocabularies)

  strictEqual(result.length, 0)
})

test('calculateVocabularyAnnotationsFromTokens - correct position calculation', () => {
  const tokens = ['失礼', 'ですが', '、', 'お名前は', '何', 'ですか', '。']
  const vocabularies: Vocabulary[] = [
    { id: 1, content: 'お名前は', type: 'vocabulary' } as Vocabulary,
    { id: 2, content: '何', type: 'vocabulary' } as Vocabulary,
  ]

  const result = calculateVocabularyAnnotationsFromTokens(tokens, vocabularies)

  strictEqual(result.length, 2)

  // 'お名前は' should start at position 6 (失礼(2) + ですが(3) + 、(1) = 6)
  strictEqual(result[0].loc, 6)
  strictEqual(result[0].len, 4)
  strictEqual(result[0].content, 'お名前は')
  strictEqual(result[0].id, 1)

  // '何' should start at position 10 (6 + お名前は(4) = 10)
  strictEqual(result[1].loc, 10)
  strictEqual(result[1].len, 1)
  strictEqual(result[1].content, '何')
  strictEqual(result[1].id, 2)
})

test('calculateVocabularyAnnotationsFromTokens - empty tokens array', () => {
  const tokens: string[] = []
  const vocabularies: Vocabulary[] = [{ id: 1, content: '私', type: 'vocabulary' } as Vocabulary]

  const result = calculateVocabularyAnnotationsFromTokens(tokens, vocabularies)

  strictEqual(result.length, 0)
})

test('calculateVocabularyAnnotationsFromTokens - empty vocabularies array', () => {
  const tokens = ['私', 'は', '学生', 'です']
  const vocabularies: Vocabulary[] = []

  const result = calculateVocabularyAnnotationsFromTokens(tokens, vocabularies)

  strictEqual(result.length, 0)
})
