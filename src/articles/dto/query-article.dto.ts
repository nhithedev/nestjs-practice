import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;
const MAX_LIMIT = 100;

export class QueryArticleDto {
  @ApiPropertyOptional({ description: 'Lọc theo tag' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ description: 'Lọc theo id tác giả' })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({
    description: 'Lọc bài đã được user này favorite (id)',
  })
  @IsOptional()
  @IsString()
  favorited?: string;

  @ApiPropertyOptional({ default: DEFAULT_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit: number = DEFAULT_LIMIT;

  @ApiPropertyOptional({ default: DEFAULT_OFFSET })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = DEFAULT_OFFSET;
}
