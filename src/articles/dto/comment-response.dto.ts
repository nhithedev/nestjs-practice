import { ApiProperty } from '@nestjs/swagger';

import { UserProfileDto } from '../../users/dto/user-profile.dto';
import { Comment } from '../entities/comment.entity';

export class CommentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: UserProfileDto })
  author!: UserProfileDto;

  static fromEntity(
    comment: Comment,
    author: UserProfileDto,
  ): CommentResponseDto {
    const dto = new CommentResponseDto();

    dto.id = comment.id;
    dto.body = comment.body;
    dto.createdAt = comment.createdAt;
    dto.author = author;

    return dto;
  }
}
