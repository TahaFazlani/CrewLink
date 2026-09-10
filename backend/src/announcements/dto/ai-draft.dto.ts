import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AiDraftDto {
  @ApiProperty({
    example:
      'emergency mtg thurs 6pm hall re: contractor pulling crews off the westside job, EVERYONE needs to be there this is the third time',
  })
  @IsString()
  @MinLength(1)
  note: string;
}
