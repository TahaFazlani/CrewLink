import {
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

export type AiDraftFields = {
  title: string;
  body: string;
  notificationPreview: string;
};

const SYSTEM_PROMPT = `You turn informal notes from union leadership into a clear official announcement.
Return JSON only with keys: title, body, notificationPreview.
- title: short, specific
- body: complete announcement in plain language
- notificationPreview: push preview, 120 characters or fewer
Do not include markdown fences or extra keys.`;

@Injectable()
export class AiDraftService {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async draftFromNote(note: string): Promise<AiDraftFields> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'AI provider is not configured (OPENAI_API_KEY)',
      );
    }

    const model = this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
    const timeoutMs = Number(this.config.get('AI_TIMEOUT_MS', 15000));
    const baseUrl = (
      this.config.get<string>('OPENAI_BASE_URL') ??
      'https://api.openai.com/v1'
    ).replace(/\/$/, '');

    try {
      const response = await firstValueFrom(
        this.http.post(
          `${baseUrl}/chat/completions`,
          {
            model,
            temperature: 0.3,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: note },
            ],
          },
          {
            timeout: timeoutMs,
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const content = response.data?.choices?.[0]?.message?.content;
      return this.parseDraft(content);
    } catch (err) {
      if (
        err instanceof GatewayTimeoutException ||
        err instanceof ServiceUnavailableException
      ) {
        throw err;
      }
      if (this.isTimeout(err)) {
        throw new GatewayTimeoutException('AI provider timed out');
      }
      throw new ServiceUnavailableException('AI provider is unavailable');
    }
  }

  private parseDraft(content: unknown): AiDraftFields {
    if (typeof content !== 'string' || !content.trim()) {
      throw new ServiceUnavailableException(
        'AI provider returned an empty draft',
      );
    }
    const jsonText = content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    let parsed: {
      title?: unknown;
      body?: unknown;
      notificationPreview?: unknown;
    };
    try {
      parsed = JSON.parse(jsonText) as typeof parsed;
    } catch {
      throw new ServiceUnavailableException(
        'AI provider returned invalid draft JSON',
      );
    }
    const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
    const body = typeof parsed.body === 'string' ? parsed.body.trim() : '';
    let notificationPreview =
      typeof parsed.notificationPreview === 'string'
        ? parsed.notificationPreview.trim()
        : '';
    if (!title || !body) {
      throw new ServiceUnavailableException(
        'AI provider returned an incomplete draft',
      );
    }
    if (notificationPreview.length > 120) {
      notificationPreview = notificationPreview.slice(0, 120).trim();
    }
    if (!notificationPreview) {
      notificationPreview = title.slice(0, 120);
    }
    return { title, body, notificationPreview };
  }

  private isTimeout(err: unknown): boolean {
    if (err instanceof AxiosError) {
      return (
        err.code === 'ECONNABORTED' ||
        err.code === 'ETIMEDOUT' ||
        err.message.toLowerCase().includes('timeout')
      );
    }
    return false;
  }
}
