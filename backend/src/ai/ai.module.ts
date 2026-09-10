import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiDraftService } from './ai-draft.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        timeout: Number(config.get('AI_TIMEOUT_MS', 15000)),
      }),
    }),
  ],
  providers: [AiDraftService],
  exports: [AiDraftService],
})
export class AiModule {}
