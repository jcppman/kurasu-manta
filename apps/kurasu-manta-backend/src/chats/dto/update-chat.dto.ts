import { PartialType } from '@nestjs/mapped-types'
import { ChatRequestDTO } from './chat-request-d-t.o'

export class UpdateChatDto extends PartialType(ChatRequestDTO) {}
