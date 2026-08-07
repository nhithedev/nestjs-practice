import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

const BODY_MAX_LENGTH = 1000;

export class CreateCommentDto {
  @ApiProperty({ example: 'This article is amazing!' })
  @IsString()
  @MinLength(1)
  @MaxLength(BODY_MAX_LENGTH)
  body!: string;
}
