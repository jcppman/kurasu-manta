import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import type { HttpContext } from '@adonisjs/core/http'

export default class ChatsController {
  public async index() {
    return 'HELLLO!'
  }
  public async chat({ request, response }: HttpContext) {
    const messages = request.input('messages')

    const result = streamText({
      model: openai('gpt-4o'),
      system: 'you are a grumpy Indian guru',
      messages,
    })

    response.relayHeaders()
    result.pipeDataStreamToResponse(response.response)
  }
}
