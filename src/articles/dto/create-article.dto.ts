import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const TITLE_MAX_LENGTH = 255;
const DESCRIPTION_MAX_LENGTH = 500;
const TAG_LIST_MAX_SIZE = 10;

export class CreateArticleDto {
  @ApiProperty({ example: 'How to train your dragon' })
  @IsString()
  @MinLength(1)
  @MaxLength(TITLE_MAX_LENGTH)
  title!: string;

  @ApiProperty({ example: 'Ever wonder how?' })
  @IsString()
  @MinLength(1)
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  description!: string;

  @ApiProperty({ example: 'It takes a lot of patience...' })
  @IsString()
  @MinLength(1)
  body!: string;

  @ApiPropertyOptional({ type: [String], example: ['dragons', 'training'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TAG_LIST_MAX_SIZE)
  @IsString({ each: true })
  tagList?: string[];
}
