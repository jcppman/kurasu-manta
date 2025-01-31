import { openai } from '@ai-sdk/openai'
import { Injectable, Logger } from '@nestjs/common'
import { Message, streamText, tool } from 'ai'
import { UpdateChatDto } from './dto/update-chat.dto'

import {
  showQuizParameters,
  showSentenceExplanationParameters,
} from '@repo/kurasu-manta-schema/chat'

const CHAT_PROMPT = `You are a Japanese language teacher who help students learn Japanese.
You can answer questions about the Japanese language, help with grammar, vocabulary, and more.

Besides answer questions the user asks, you are also capable of performing following tasks:
- Generate quiz questions
- Explain sentence: explain grammar structure and provide furigana for kanji

# IMPORTANT INSTRUCTIONS
- Please use the language user asked in the question to answer the question. For example, if the user asked a question in Traditional Chinese, please answer in Traditional Chinese.
- When the user ask for a quiz, don't explain further or ask for confirmation. Just provide the quiz question and answer.
`

@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name)

  create(messages: Message[]) {
    return streamText({
      model: openai('gpt-4o'),
      system: CHAT_PROMPT,
      tools: {
        showQuiz: tool({
          description: 'generate quiz question and answer for the user to practice',
          parameters: showQuizParameters,
        }),
        showSentenceExplanation: tool({
          description: 'Show sentence explanation. It contains annotations like furigana for kanji',
          parameters: showSentenceExplanationParameters,
        }),
      },
      maxSteps: 10,
      messages,
    })
  }

  findAll() {
    return 'This action returns all chats'
  }

  findOne(id: number) {
    return `This action returns a #${id} chat`
  }

  update(id: number, updateChatDto: UpdateChatDto) {
    return `This action updates a #${id} chat`
  }

  remove(id: number) {
    return `This action removes a #${id} chat`
  }
}
