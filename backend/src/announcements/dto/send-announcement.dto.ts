import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  MEMBER_CLASSIFICATIONS,
  type MemberClassification,
} from '../../common/enums';

export class SendAnnouncementDto {
  @ApiPropertyOptional({
    description:
      'If set, only active members with this classification are queued. Omit for all active members.',
  })
  @IsOptional()
  @IsIn(MEMBER_CLASSIFICATIONS)
  classification?: MemberClassification;
}
