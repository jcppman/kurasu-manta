import db from '@/db'
import { knowledgePointsTable, sentenceKnowledgePointsTable, sentencesTable } from '@/db/schema'
import { withRetry } from '@/lib/async'
import { logger } from '@/lib/utils'
import { SentenceRepository } from '@kurasu-manta/content-schema/repository'
import { CourseContentService } from '@kurasu-manta/content-schema/service'
import type {
  Annotation,
  CreateKnowledgePoint,
  KnowledgePoint,
} from '@kurasu-manta/content-schema/zod'
import { eq, isNull, or } from 'drizzle-orm'
import {
  type MinaGrammar,
  type MinaVocabulary,
  getGrammarData,
  getVocData,
} from 'src/workflows/minna-jp-1/content'
import { isKanji } from 'wanakana'
import { findPosOfVocabulary } from './knowledge-point'
import {
  generateFuriganaAnnotations,
  generateSentencesForLessonNumber,
  getTargetSentenceCount,
} from './sentence'

export async function cleanVocabularies() {
  logger.info('Resetting database - dropping vocabulary knowledge points...')

  // First, get all vocabulary knowledge point IDs
  const vocabularyKnowledgePoints = await db
    .select({ id: knowledgePointsTable.id })
    .from(knowledgePointsTable)
    .where(eq(knowledgePointsTable.type, 'vocabulary'))

  const vocabularyIds = vocabularyKnowledgePoints.map((kp) => kp.id)

  if (vocabularyIds.length === 0) {
    logger.info('No vocabulary knowledge points found to delete')
    return
  }

  logger.info(`Found ${vocabularyIds.length} vocabulary knowledge points to delete`)

  // Note: Knowledge points are directly deleted via foreign key constraint

  // Delete vocabulary knowledge points
  await db.delete(knowledgePointsTable).where(eq(knowledgePointsTable.type, 'vocabulary'))

  logger.info(`Deleted ${vocabularyIds.length} vocabulary knowledge points`)

  logger.info('Database reset completed - vocabulary knowledge points dropped')
}

export async function cleanGrammar() {
  logger.info('Resetting database - dropping grammar knowledge points...')

  // First, get all grammar knowledge point IDs
  const grammarKnowledgePoints = await db
    .select({ id: knowledgePointsTable.id })
    .from(knowledgePointsTable)
    .where(eq(knowledgePointsTable.type, 'grammar'))

  const grammarIds = grammarKnowledgePoints.map((kp) => kp.id)

  if (grammarIds.length === 0) {
    logger.info('No grammar knowledge points found to delete')
    return
  }

  logger.info(`Found ${grammarIds.length} grammar knowledge points to delete`)

  // Note: Knowledge points are directly deleted via foreign key constraint

  // Delete grammar knowledge points
  await db.delete(knowledgePointsTable).where(eq(knowledgePointsTable.type, 'grammar'))

  logger.info(`Deleted ${grammarIds.length} grammar knowledge points`)

  logger.info('Database reset completed - grammar knowledge points dropped')
}

export async function cleanSentences() {
  logger.info('Resetting database - dropping all sentences...')

  // Delete all sentence-knowledge point associations first
  await db.delete(sentenceKnowledgePointsTable)
  logger.info('Deleted all sentence-knowledge point associations')

  // Delete all sentences
  await db.delete(sentencesTable)
  logger.info('Deleted all sentences')

  logger.info('Database reset completed - all sentences dropped')
}

async function createLesson(lessonNumber: number, vocabularies: MinaVocabulary[]) {
  const courseContentService = new CourseContentService(db)

  // 1. Get or create lesson by number
  let lesson = await courseContentService.getLessonByNumber(lessonNumber)
  if (!lesson) {
    lesson = await courseContentService.createLesson({
      number: lessonNumber,
      title: `Lesson ${lessonNumber}`,
    })
  }

  // 2. Filter out vocabularies that already exist as knowledge points
  const vocabulariesToCreate = []
  for (const v of vocabularies) {
    const existingKnowledgePoint = await findExistingKnowledgePoint(
      courseContentService,
      v.content,
      'vocabulary',
      lesson.id
    )

    if (!existingKnowledgePoint) {
      vocabulariesToCreate.push(v)
    }
  }

  if (vocabulariesToCreate.length === 0) {
    return // Nothing to create
  }

  // 3. Process vocabularies that need to be created (POS lookup)
  const noPos = vocabulariesToCreate.filter((v) => !v.pos)
  for (const voc of noPos) {
    voc.pos = await findPosOfVocabulary(voc)
  }

  // 4. Create knowledge points with proper lesson ID
  await courseContentService.createKnowledgePoints(
    vocabulariesToCreate.map((v) => ({
      lessonId: lesson.id, // Real database ID
      type: 'vocabulary',
      content: v.content,
      annotations: v.annotations,
      pos: v.pos,
      explanation: v.translation, // Now multilingual object
      accent: v.accent,
    }))
  )
}

async function createGrammarLesson(lessonNumber: number, grammarItems: MinaGrammar[]) {
  const courseContentService = new CourseContentService(db)

  // 1. Get or create lesson by number
  let lesson = await courseContentService.getLessonByNumber(lessonNumber)
  if (!lesson) {
    lesson = await courseContentService.createLesson({
      number: lessonNumber,
      title: `Lesson ${lessonNumber}`,
    })
  }

  // 2. Create grammar knowledge points with proper lesson ID, but only if they don't already exist
  const grammarToCreate: CreateKnowledgePoint[] = []
  for (const g of grammarItems) {
    const existingKnowledgePoint = await findExistingKnowledgePoint(
      courseContentService,
      g.content,
      'grammar',
      lesson.id
    )

    if (!existingKnowledgePoint) {
      grammarToCreate.push({
        lessonId: lesson.id, // Real database ID
        type: 'grammar',
        content: g.content,
        explanation: g.explanation, // Now multilingual object
      })
    }
  }

  if (grammarToCreate.length > 0) {
    return courseContentService.createKnowledgePoints(grammarToCreate)
  }

  return []
}

export async function createVocabularies(untilLessonNumber: number = Number.POSITIVE_INFINITY) {
  logger.info('Creating lessons...')
  const data = getVocData()

  // Group by lesson
  const groupedData = data
    .filter((d) => d.lesson <= untilLessonNumber)
    .reduce((acc, item) => {
      const lesson = item.lesson
      acc.set(lesson, acc.get(lesson) ?? [])
      acc.get(lesson)?.push(item)
      return acc
    }, new Map<number, MinaVocabulary[]>())

  let completedLessons = 0

  for (const [lessonNumber, lessonVocabularies] of groupedData.entries()) {
    logger.info(`Processing lesson ${lessonNumber}...`)
    await createLesson(lessonNumber, lessonVocabularies)

    completedLessons++
  }

  logger.info('All lessons created successfully')
}

export async function createGrammarLessons(untilLessonNumber: number = Number.POSITIVE_INFINITY) {
  logger.info('Creating grammar lessons...')
  const data = getGrammarData()

  // Group by lesson
  const groupedData = data
    .filter((d) => d.lesson <= untilLessonNumber)
    .reduce((acc, item) => {
      const lesson = item.lesson
      acc.set(lesson, acc.get(lesson) ?? [])
      acc.get(lesson)?.push(item)
      return acc
    }, new Map<number, MinaGrammar[]>())

  let completedLessons = 0

  for (const [lessonNumber, lessonGrammarItems] of groupedData.entries()) {
    logger.info(`Processing grammar for lesson ${lessonNumber}...`)
    await createGrammarLesson(lessonNumber, lessonGrammarItems)

    completedLessons++
  }

  logger.info('All grammar lessons created successfully')
}

export async function createSentencesForLesson(lessonNumber: number) {
  const courseContentService = new CourseContentService(db)

  const generatedSentences = await withRetry(() => generateSentencesForLessonNumber(lessonNumber))
  if (generatedSentences.length === 0) {
    logger.info(`No sentences generated for lesson number ${lessonNumber}`)
    return
  }
  logger.info(`Generated ${generatedSentences.length} sentences for lesson ${lessonNumber}`)
  for (const sentence of generatedSentences) {
    const { content, vocabularyIds, grammarIds, annotations, explanation } = sentence

    // Combine vocabulary and grammar IDs
    const allKnowledgePointIds = [...vocabularyIds, ...grammarIds]

    // Create sentence and associate with knowledge points in one call
    await courseContentService.createSentenceWithKnowledgePoints(
      {
        content,
        explanation,
        annotations,
        minLessonNumber: lessonNumber,
      },
      allKnowledgePointIds
    )

    logger.info(`Created sentence for lesson number ${lessonNumber}: "${content}"`)
  }
}

export async function createSentencesForLessons(
  untilLessonNumber: number = Number.POSITIVE_INFINITY
) {
  const courseContentService = new CourseContentService(db)

  // Get all lessons
  const { items: lessons } = await courseContentService.getLessons()

  const lessonsToProcess = lessons
    .filter((lesson) => lesson.number < untilLessonNumber + 1)
    .sort((a, b) => a.number - b.number)

  let currentProgress = 0
  while (currentProgress < lessonsToProcess.length) {
    const currentLesson = lessonsToProcess[currentProgress]

    // Get sentence stats with pos info for all knowledge points in this lesson
    const stats = await courseContentService.getLessonKnowledgePointSentenceStats(currentLesson.id)

    // Check which knowledge points need more sentences using the efficient approach
    const knowledgePointsNeedingSentences = stats.filter((stat) => {
      const targetCount = getTargetSentenceCount(stat.type, stat.pos)
      return stat.sentenceCount < targetCount
    })

    logger.info(
      `Remaining knowledge points needing sentences in lesson ${currentLesson.number}: ${knowledgePointsNeedingSentences.length}/${stats.length}`
    )
    if (knowledgePointsNeedingSentences.length > 0) {
      logger.info(`Creating sentences for lesson ${lessonsToProcess[currentProgress].number}...`)
      await createSentencesForLesson(lessonsToProcess[currentProgress].number)
    } else {
      logger.info(
        `All knowledge points in ${lessonsToProcess[currentProgress].number} has sufficient sentences`
      )
      currentProgress++
    }
  }

  logger.info('All sentences created successfully for lessons up to', untilLessonNumber)
}
async function findExistingKnowledgePoint(
  courseContentService: CourseContentService,
  content: string,
  type: 'vocabulary' | 'grammar',
  lessonId: number
) {
  // Get knowledge points filtered by lessonId and type
  const { items: knowledgePoints } = await courseContentService.getKnowledgePointsByConditions({
    lessonId,
    type,
  })

  // Find the one with matching content
  return knowledgePoints.find((kp) => kp.content === content)
}

async function findKnowledgePointByContentTypeAndLesson(
  courseContentService: CourseContentService,
  content: string,
  type: 'vocabulary' | 'grammar',
  lessonNumber: number
) {
  // Get lesson ID from lesson number
  const lesson = await courseContentService.getLessonByNumber(lessonNumber)
  if (!lesson) {
    return null
  }

  // Get knowledge points filtered by lessonId and type
  const { items: knowledgePoints } = await courseContentService.getKnowledgePointsByConditions({
    lessonId: lesson.id,
    type,
  })

  // Find the one with matching content
  return knowledgePoints.find((kp) => kp.content === content)
}

export async function updateExplanationsFromDataSource() {
  logger.info('Updating explanation fields from data source...')
  const courseContentService = new CourseContentService(db)

  let vocSuccessCount = 0
  let vocFailCount = 0
  let grammarSuccessCount = 0
  let grammarFailCount = 0

  // Update vocabulary explanations
  logger.info('Updating vocabulary explanations...')
  const vocData = getVocData()

  for (const voc of vocData) {
    try {
      const existingKnowledgePoint = await findKnowledgePointByContentTypeAndLesson(
        courseContentService,
        voc.content,
        'vocabulary',
        voc.lesson
      )

      if (!existingKnowledgePoint) {
        logger.warn(
          `Vocabulary knowledge point not found for content: ${voc.content} in lesson ${voc.lesson}`
        )
        vocFailCount++
        continue
      }

      // Update the explanation field with the multilingual translation
      const updatedKnowledgePoint = {
        ...existingKnowledgePoint,
        explanation: voc.translation,
      }

      await courseContentService.updateKnowledgePoint(
        existingKnowledgePoint.id,
        updatedKnowledgePoint
      )

      logger.info(`Updated vocabulary explanation for: ${voc.content} in lesson ${voc.lesson}`)
      vocSuccessCount++
    } catch (error) {
      logger.error(`Failed to update vocabulary explanation for ${voc.content}:`, error)
      vocFailCount++
    }
  }

  // Update grammar explanations
  logger.info('Updating grammar explanations...')
  const grammarData = getGrammarData()

  for (const grammar of grammarData) {
    try {
      const existingKnowledgePoint = await findKnowledgePointByContentTypeAndLesson(
        courseContentService,
        grammar.content,
        'grammar',
        grammar.lesson
      )

      if (!existingKnowledgePoint) {
        logger.warn(
          `Grammar knowledge point not found for content: ${grammar.content} in lesson ${grammar.lesson}`
        )
        grammarFailCount++
        continue
      }

      // Update the explanation field with the multilingual explanation
      const updatedKnowledgePoint = {
        ...existingKnowledgePoint,
        explanation: grammar.explanation,
      }

      await courseContentService.updateKnowledgePoint(
        existingKnowledgePoint.id,
        updatedKnowledgePoint
      )

      logger.info(`Updated grammar explanation for: ${grammar.content} in lesson ${grammar.lesson}`)
      grammarSuccessCount++
    } catch (error) {
      logger.error(`Failed to update grammar explanation for ${grammar.content}:`, error)
      grammarFailCount++
    }
  }

  // Summary
  logger.info('Update completed!')
  logger.info(`Vocabulary - Success: ${vocSuccessCount}, Failed: ${vocFailCount}`)
  logger.info(`Grammar - Success: ${grammarSuccessCount}, Failed: ${grammarFailCount}`)
  logger.info(
    `Total - Success: ${vocSuccessCount + grammarSuccessCount}, Failed: ${vocFailCount + grammarFailCount}`
  )
}

/**
 * Detects if a sentence contains kanji characters
 */
function sentenceContainsKanji(content: string): boolean {
  return Array.from(content).some((char) => isKanji(char))
}

/**
 * Detects if a sentence needs furigana annotations
 */
function sentenceNeedsFuriganaAnnotations(sentence: {
  content: string
  annotations: Annotation[] | null
}): boolean {
  // Check if sentence contains kanji
  if (!sentenceContainsKanji(sentence.content)) {
    return false
  }

  // Check if annotations exist and contain furigana
  if (!sentence.annotations || sentence.annotations.length === 0) {
    return true
  }

  // Check if there are any furigana annotations
  const hasFuriganaAnnotations = sentence.annotations.some(
    (annotation) => annotation.type === 'furigana'
  )
  return !hasFuriganaAnnotations
}

/**
 * Generates annotations for sentences that need them
 */
export async function generateSentenceAnnotations() {
  logger.info('Starting sentence annotation generation...')

  const sentenceRepository = new SentenceRepository(db)

  // Query all sentences that need annotations
  const sentencesNeedingAnnotations = await db
    .select({
      id: sentencesTable.id,
      content: sentencesTable.content,
      annotations: sentencesTable.annotations,
      minLessonNumber: sentencesTable.minLessonNumber,
    })
    .from(sentencesTable)
    .where(or(isNull(sentencesTable.annotations), eq(sentencesTable.annotations, [])))

  // Filter sentences that contain kanji and need furigana annotations
  const sentencesToProcess = sentencesNeedingAnnotations.filter(sentenceNeedsFuriganaAnnotations)

  if (sentencesToProcess.length === 0) {
    logger.info('No sentences found that need furigana annotations')
    return
  }

  logger.info(`Found ${sentencesToProcess.length} sentences that need furigana annotations`)

  let successCount = 0
  let failureCount = 0

  // Process sentences in batches
  const batchSize = 10
  for (let i = 0; i < sentencesToProcess.length; i += batchSize) {
    const batch = sentencesToProcess.slice(i, i + batchSize)
    logger.info(
      `Processing annotation batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(sentencesToProcess.length / batchSize)}`
    )

    const results = await Promise.allSettled(
      batch.map(async (sentence) => {
        try {
          // Get related knowledge points for this sentence
          const relatedKnowledgePoints = await sentenceRepository.getKnowledgePointsBySentenceId(
            sentence.id
          )

          // Filter to get vocabularies only (for furigana context)
          const relatedVocabularies = relatedKnowledgePoints.filter(
            (kp: KnowledgePoint) => kp.type === 'vocabulary'
          )

          // Generate furigana annotations
          const furiganaAnnotations = await generateFuriganaAnnotations(
            sentence.content,
            relatedVocabularies
          )

          // For now, we don't have tokens in the database, so we'll skip vocabulary annotations
          // const vocabularyAnnotations = calculateVocabularyAnnotationsFromTokens(tokens, relatedVocabularies)
          const vocabularyAnnotations: Annotation[] = []

          const allAnnotations = [...furiganaAnnotations, ...vocabularyAnnotations]

          // Update the sentence with new annotations
          await db
            .update(sentencesTable)
            .set({ annotations: allAnnotations })
            .where(eq(sentencesTable.id, sentence.id))

          logger.info(
            `Generated ${allAnnotations.length} annotations for sentence: "${sentence.content}"`
          )
          return { success: true, sentenceId: sentence.id }
        } catch (error) {
          logger.error(
            `Failed to generate annotations for sentence ${sentence.id}: "${sentence.content}"`,
            error
          )
          return { success: false, sentenceId: sentence.id, error }
        }
      })
    )

    // Count successes and failures
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        successCount++
      } else {
        failureCount++
      }
    }
  }

  logger.info('Sentence annotation generation completed!')
  logger.info(`Success: ${successCount}, Failed: ${failureCount}`)
}
