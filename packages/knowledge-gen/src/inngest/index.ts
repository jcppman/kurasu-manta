import { promises as fs } from 'node:fs'
import { db } from '@/db'
import { knowledgePointsTable, lessonKnowledgePointsTable, lessonsTable } from '@/db/schema'
import {
  createLessonKnowledgePointRelationships,
  prepareVocabularyForInsertion,
  validateAndTransformLessons,
  validateAndTransformVocabulary,
} from '@/utils/data-transform'
import { resolveDataPath } from '@/utils/paths'
import { sql } from 'drizzle-orm'
import { Inngest } from 'inngest'

// Create a client to send and receive events
export const inngest = new Inngest({ id: 'knowledge-gen' })

const loadSeedData = inngest.createFunction(
  { id: 'load-seed-data' },
  { event: 'data/load.seed' },
  async ({ event, step }) => {
    // First, run the cleanup step to wipe the database
    await step.run('cleanup', async () => {
      console.log('Starting database cleanup...')

      // Delete all records from the tables in the correct order to respect foreign key constraints
      // First, delete from the junction table
      await db.delete(lessonKnowledgePointsTable)
      console.log('Deleted all lesson-knowledge point relationships')

      // Then delete from the knowledge points table
      await db.delete(knowledgePointsTable)
      console.log('Deleted all knowledge points')

      // Finally delete from the lessons table
      await db.delete(lessonsTable)
      console.log('Deleted all lessons')

      // Reset the auto-increment counters
      await db.run(
        sql`DELETE FROM sqlite_sequence WHERE name IN ('lessons', 'knowledge_points', 'lesson_knowledge_points')`
      )
      console.log('Reset auto-increment counters')

      console.log('Database cleanup completed successfully')
      return true
    })

    // Then run the vocabularies-etl step
    const vocs = await step.run('vocabularies-etl', async () => {
      const dataPath = resolveDataPath('minna-jp-1', 'vocs.json')
      const rawData = await fs.readFile(dataPath, 'utf-8')
      const rawJsonData = JSON.parse(rawData) as unknown[]

      console.log(`Loaded ${rawJsonData.length} raw vocabulary items from JSON`)

      // Validate and transform the data
      const { valid, invalid } = validateAndTransformVocabulary(rawJsonData)

      if (invalid.length > 0) {
        console.warn(`Found ${invalid.length} invalid vocabulary items in the data`)
        console.warn('First invalid item:', JSON.stringify(invalid[0], null, 2))
      }

      console.log(`Processing ${valid.length} valid vocabulary items`)

      // Prepare data for insertion
      const dataForInsertion = prepareVocabularyForInsertion(valid)

      if (dataForInsertion.length === 0) {
        throw new Error('No valid vocabulary items to insert')
      }
      // Insert data into the database
      await db.insert(knowledgePointsTable).values(dataForInsertion)

      console.log(`Successfully inserted ${valid.length} vocabulary items`)
      return valid.length
    })

    // Run the lessons-etl step
    const lessons = await step.run('lessons-etl', async () => {
      const dataPath = resolveDataPath('minna-jp-1', 'lessons.json')
      const rawData = await fs.readFile(dataPath, 'utf-8')
      const rawJsonData = JSON.parse(rawData) as unknown[]

      console.log(`Loaded ${rawJsonData.length} raw lesson items from JSON`)

      // Validate and transform the data
      const { valid, invalid } = validateAndTransformLessons(rawJsonData)

      if (invalid.length > 0) {
        console.warn(`Found ${invalid.length} invalid lesson items in the data`)
        console.warn('First invalid item:', JSON.stringify(invalid[0], null, 2))
      }

      console.log(`Processing ${valid.length} valid lesson items`)

      // Insert lessons into the database
      for (const lesson of valid) {
        await db.insert(lessonsTable).values({
          sequenceNumber: lesson.sequenceNumber,
          title: lesson.title,
          description: lesson.description,
        })

        console.log(`Inserted lesson: ${lesson.title}`)
      }

      return valid.length
    })

    return {
      message: `Database cleaned, ${vocs} vocabularies and ${lessons} lessons loaded`,
    }
  }
)

export const functions = [loadSeedData]
