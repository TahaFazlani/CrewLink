import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class SendAnnouncementDto {
  @ApiPropertyOptional({
    description:
      'If set, only active members with this classification are queued. Omit for all active members.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  classification?: string;
}
