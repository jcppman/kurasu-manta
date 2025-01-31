import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { ChatsModule } from './chats/chats.module'

@Module({
  imports: [ConfigModule.forRoot(), ChatsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
