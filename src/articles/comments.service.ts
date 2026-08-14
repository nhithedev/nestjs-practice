import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nContext } from 'nestjs-i18n';
import { Repository } from 'typeorm';

import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UsersService } from '../users/users.service';

import { ArticlesService } from './articles.service';
import { CommentResponseDto } from './dto/comment-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Comment } from './entities/comment.entity';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,

    private readonly articlesService: ArticlesService,
    private readonly usersService: UsersService,
  ) {}

  private translate(key: string): string {
    return I18nContext.current()?.t(key) ?? key;
  }

  async create(
    slug: string,
    dto: CreateCommentDto,
    currentUser: AuthenticatedUser,
  ): Promise<{ comment: CommentResponseDto; message: string }> {
    const articleId = await this.articlesService.assertArticleExists(slug);

    const comment = this.commentsRepository.create({
      articleId,
      authorId: currentUser.userId,
      body: dto.body.trim(),
    });

    const savedComment = await this.commentsRepository.save(comment);

    const author = await this.usersService.getProfile(
      currentUser.userId,
      currentUser.userId,
    );

    return {
      comment: CommentResponseDto.fromEntity(savedComment, author),
      message: this.translate('comments.CREATE_SUCCESS'),
    };
  }

  async findByArticle(
    slug: string,
    viewerId?: string,
  ): Promise<{ comments: CommentResponseDto[] }> {
    const articleId = await this.articlesService.assertArticleExists(slug);

    const comments = await this.commentsRepository.find({
      where: { articleId },
      order: { createdAt: 'DESC' },
    });

    const response = await Promise.all(
      comments.map(async (comment) => {
        const author = await this.usersService.getProfile(
          comment.authorId,
          viewerId,
        );

        return CommentResponseDto.fromEntity(comment, author);
      }),
    );

    return { comments: response };
  }

  async remove(
    slug: string,
    commentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<{ message: string }> {
    const articleId = await this.articlesService.assertArticleExists(slug);

    const comment = await this.commentsRepository.findOne({
      where: { id: commentId, articleId },
    });

    if (!comment) {
      throw new NotFoundException(this.translate('comments.COMMENT_NOT_FOUND'));
    }

    if (comment.authorId !== currentUser.userId) {
      throw new ForbiddenException(this.translate('comments.NOT_AUTHOR'));
    }

    await this.commentsRepository.remove(comment);

    return { message: this.translate('comments.DELETE_SUCCESS') };
  }
}
