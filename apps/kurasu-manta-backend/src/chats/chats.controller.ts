import { Body, Controller, Delete, Get, Logger, Param, Patch, Post, Res } from '@nestjs/common'
import { Response } from 'express'
import { ChatsService } from './chats.service'
import { ChatRequestDTO } from './dto/chat-request-d-t.o'
import { UpdateChatDto } from './dto/update-chat.dto'

@Controller('chats')
export class ChatsController {
  private readonly logger = new Logger(ChatsController.name)

  constructor(private readonly chatsService: ChatsService) {}

  @Post()
  create(@Body() chatRequestDto: ChatRequestDTO, @Res() response: Response) {
    const { messages } = chatRequestDto
    const result = this.chatsService.create(messages)
    result.pipeDataStreamToResponse(response, {
      getErrorMessage: (err) => {
        this.logger.error(err)
        return 'Something went wrong!'
      },
    })
  }

  @Get()
  findAll() {
    return this.chatsService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.chatsService.findOne(+id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateChatDto: UpdateChatDto) {
    return this.chatsService.update(+id, updateChatDto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.chatsService.remove(+id)
  }
}
