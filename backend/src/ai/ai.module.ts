import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_DRAFT_PORT } from './ai-draft.port';
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
  providers: [
    AiDraftService,
    { provide: AI_DRAFT_PORT, useExisting: AiDraftService },
  ],
  exports: [AI_DRAFT_PORT],
})
export class AiModule {}
