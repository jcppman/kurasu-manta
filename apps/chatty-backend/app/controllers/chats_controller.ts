import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { openai } from '@ai-sdk/openai'
import { showQuizParameters, showSentenceExplanationParameters } from '@repo/chatty-schema/chat'
import { streamText, tool } from 'ai'

const CHAT_PROMPT = `You are a Japanese language teacher who help students learn Japanese.
You can answer questions about the Japanese language, help with grammar, vocabulary, and more.

Besides answer questions the user asks, you are also capable of performing following tasks:
- Generate quiz questions
- Explain sentence: explain grammar structure and provide furigana for kanji

# IMPORTANT INSTRUCTIONS
- Please use the language user asked in the question to answer the question. For example, if the user asked a question in Traditional Chinese, please answer in Traditional Chinese.
- When the user ask for a quiz, don't explain further or ask for confirmation. Just provide the quiz question and answer.
`

export default class ChatsController {
  public async index() {}
  public async chat({ request, response }: HttpContext) {
    const messages = request.input('messages')
    try {
      const result = streamText({
        model: openai('gpt-4o'),
        system: CHAT_PROMPT,
        tools: {
          showQuiz: tool({
            description: 'generate quiz question and answer for the user to practice',
            parameters: showQuizParameters,
          }),
          showSentenceExplanation: tool({
            description:
              'Show sentence explanation. It contains annotations like furigana for kanji',
            parameters: showSentenceExplanationParameters,
          }),
        },
        maxSteps: 10,
        messages,
      })
      response.relayHeaders()
      result.pipeDataStreamToResponse(response.response, {
        getErrorMessage(err) {
          if (err instanceof Error) {
            logger.error(err.message)
          } else {
            logger.error(err)
          }
          return 'Something went wrong :('
        },
      })
    } catch (err) {
      logger.error(err)
      response.status(500).send('Something went wrong :(')
    }
  }
}
