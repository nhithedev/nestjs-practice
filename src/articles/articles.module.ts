import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';

import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { Article } from './entities/article.entity';
import { ArticleFavorite } from './entities/article.favorite.entity';
import { Comment } from './entities/comment.entity';
import { Tag } from './entities/tag.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Article, Tag, ArticleFavorite, Comment]),
    UsersModule,
  ],
  controllers: [ArticlesController, CommentsController],
  providers: [ArticlesService, CommentsService],
})
export class ArticlesModule {}
