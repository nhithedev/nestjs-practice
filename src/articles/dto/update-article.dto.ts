import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateArticleDto {
  @ApiPropertyOptional({ example: 'How to train your dragon (updated)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({ example: 'Ever wonder how? (updated)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  description?: string;

  @ApiPropertyOptional({ example: 'Updated content...' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

  @ApiPropertyOptional({ type: [String], example: ['dragons'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TAG_LIST_MAX_SIZE)
  @IsString({ each: true })
  tagList?: string[];
}
