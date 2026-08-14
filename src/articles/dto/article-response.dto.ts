import { ApiProperty } from '@nestjs/swagger';

import { UserProfileDto } from '../../users/dto/user-profile.dto';
import { Article } from '../entities/article.entity';

export class ArticleResponseDto {
  @ApiProperty()
  slug!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty({ type: [String] })
  tagList!: string[];

  @ApiProperty({ nullable: true })
  coverImageUrl!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  favorited!: boolean;

  @ApiProperty()
  favoritesCount!: number;

  @ApiProperty({ type: UserProfileDto })
  author!: UserProfileDto;

  static fromEntity(
    article: Article,
    author: UserProfileDto,
    favorited: boolean,
    favoritesCount: number,
  ): ArticleResponseDto {
    const dto = new ArticleResponseDto();

    dto.slug = article.slug;
    dto.title = article.title;
    dto.description = article.description;
    dto.body = article.body;
    dto.tagList = (article.tags ?? []).map((tag) => tag.name);
    dto.coverImageUrl = article.coverAttachment?.url ?? null;
    dto.createdAt = article.createdAt;
    dto.updatedAt = article.updatedAt;
    dto.favorited = favorited;
    dto.favoritesCount = favoritesCount;
    dto.author = author;

    return dto;
  }
}
