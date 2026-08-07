import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nContext } from 'nestjs-i18n';
import { In, Repository } from 'typeorm';
import { UserFollow } from '../users/entities/user-follow.entity';
import { UsersService } from '../users/users.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { QueryArticleDto } from './dto/query-article.dto';
import { ArticleResponseDto } from './dto/article-response.dto';

import { Article } from './entities/article.entity';
import { ArticleFavorite } from './entities/article.favorite.entity';
import { Tag } from './entities/tag.entity';

import { buildArticleSlug } from './utils/slug.util';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private readonly articlesRepository: Repository<Article>,

    @InjectRepository(Tag)
    private readonly tagsRepository: Repository<Tag>,

    @InjectRepository(ArticleFavorite)
    private readonly favoritesRepository: Repository<ArticleFavorite>,

    private readonly usersService: UsersService,
  ) {}

  private translate(key: string): string {
    return I18nContext.current()?.t(key) ?? key;
  }

  private async loadArticleBySlug(slug: string): Promise<Article> {
    const article = await this.articlesRepository.findOne({
      where: { slug },
      relations: {
        tags: true,
      },
    });

    if (!article) {
      throw new NotFoundException(this.translate('articles.ARTICLE_NOT_FOUND'));
    }

    return article;
  }

  // Dùng bởi CommentsService để xác nhận article tồn tại + lấy articleId,
  // không cần load kèm `tags` như loadArticleBySlug() — tránh trùng logic
  // "tìm theo slug, 404 nếu không có" ở 2 nơi.
  async assertArticleExists(slug: string): Promise<string> {
    const article = await this.articlesRepository.findOne({
      where: { slug },
      select: {
        id: true,
      },
    });

    if (!article) {
      throw new NotFoundException(this.translate('articles.ARTICLE_NOT_FOUND'));
    }

    return article.id;
  }

  private async findOrCreateTags(names: string[]): Promise<Tag[]> {
    if (names.length === 0) {
      return [];
    }

    const normalizedNames = [
      ...new Set(
        names.map((name) => name.trim()).filter((name) => name.length > 0),
      ),
    ];

    if (normalizedNames.length === 0) {
      return [];
    }

    const existingTags = await this.tagsRepository.find({
      where: {
        name: In(normalizedNames),
      },
    });

    const existingNames = new Set(existingTags.map((tag) => tag.name));

    const missingTags = normalizedNames
      .filter((name) => !existingNames.has(name))
      .map((name) =>
        this.tagsRepository.create({
          name,
        }),
      );

    if (missingTags.length > 0) {
      await this.tagsRepository.save(missingTags);
    }

    return this.tagsRepository.find({
      where: {
        name: In(normalizedNames),
      },
    });
  }

  private async getFavoritesCount(articleId: string): Promise<number> {
    return this.favoritesRepository.count({
      where: {
        articleId,
      },
    });
  }

  private async isFavorited(
    articleId: string,
    viewerId?: string,
  ): Promise<boolean> {
    if (!viewerId) {
      return false;
    }

    return this.favoritesRepository.exists({
      where: {
        articleId,
        userId: viewerId,
      },
    });
  }

  private assertAuthor(article: Article, currentUserId: string): void {
    if (article.authorId !== currentUserId) {
      throw new ForbiddenException(this.translate('articles.NOT_AUTHOR'));
    }
  }

  private async buildArticleResponse(
    article: Article,
    viewerId?: string,
  ): Promise<ArticleResponseDto> {
    const [author, favorited, favoritesCount] = await Promise.all([
      this.usersService.getProfile(article.authorId, viewerId),
      this.isFavorited(article.id, viewerId),
      this.getFavoritesCount(article.id),
    ]);

    return ArticleResponseDto.fromEntity(
      article,
      author,
      favorited,
      favoritesCount,
    );
  }
  async create(
    dto: CreateArticleDto,
    currentUser: AuthenticatedUser,
  ): Promise<{ article: ArticleResponseDto; message: string }> {
    const slug = buildArticleSlug(dto.title);

    const tags = await this.findOrCreateTags(dto.tagList ?? []);

    const article = this.articlesRepository.create({
      slug,
      title: dto.title.trim(),
      description: dto.description.trim(),
      body: dto.body.trim(),
      authorId: currentUser.userId,
      tags,
    });

    const savedArticle = await this.articlesRepository.save(article);

    const createdArticle = await this.articlesRepository.findOne({
      where: {
        id: savedArticle.id,
      },
      relations: {
        tags: true,
      },
    });

    if (!createdArticle) {
      throw new NotFoundException(this.translate('articles.ARTICLE_NOT_FOUND'));
    }

    return {
      article: await this.buildArticleResponse(
        createdArticle,
        currentUser.userId,
      ),
      message: this.translate('articles.CREATE_SUCCESS'),
    };
  }

  async findBySlug(
    slug: string,
    viewerId?: string,
  ): Promise<{ article: ArticleResponseDto }> {
    const article = await this.loadArticleBySlug(slug);

    return { article: await this.buildArticleResponse(article, viewerId) };
  }

  async list(
    query: QueryArticleDto,
    viewerId?: string,
  ): Promise<{
    articles: ArticleResponseDto[];
    articlesCount: number;
  }> {
    const queryBuilder = this.articlesRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.tags', 'tag');
    if (query.tag) {
      queryBuilder.andWhere('tag.name = :tag', {
        tag: query.tag,
      });
    }

    if (query.author) {
      queryBuilder.andWhere('article.author_id = :authorId', {
        authorId: query.author,
      });
    }

    if (query.favorited) {
      queryBuilder.innerJoin(
        ArticleFavorite,
        'favorite',
        `
          favorite.article_id = article.id
          AND favorite.user_id = :favoriteUserId
        `,
        {
          favoriteUserId: query.favorited,
        },
      );
    }

    queryBuilder
      .orderBy('article.created_at', 'DESC')
      .skip(query.offset)
      .take(query.limit);

    const [articles, articlesCount] = await queryBuilder.getManyAndCount();

    const response = await Promise.all(
      articles.map((article) => this.buildArticleResponse(article, viewerId)),
    );

    return {
      articles: response,
      articlesCount,
    };
  }
  async feed(
    currentUser: AuthenticatedUser,
    query: QueryArticleDto,
  ): Promise<{
    articles: ArticleResponseDto[];
    articlesCount: number;
  }> {
    const queryBuilder = this.articlesRepository
      .createQueryBuilder('article')
      .innerJoin(
        UserFollow,
        'follow',
        `
    follow.following_id = article.author_id
    AND follow.follower_id = :currentUserId
  `,
        {
          currentUserId: currentUser.userId,
        },
      )
      .leftJoinAndSelect('article.tags', 'tag')
      .orderBy('article.created_at', 'DESC')
      .skip(query.offset)
      .take(query.limit);

    const [articles, articlesCount] = await queryBuilder.getManyAndCount();

    const response = await Promise.all(
      articles.map((article) =>
        this.buildArticleResponse(article, currentUser.userId),
      ),
    );

    return {
      articles: response,
      articlesCount,
    };
  }

  async update(
    slug: string,
    dto: UpdateArticleDto,
    currentUser: AuthenticatedUser,
  ): Promise<{ article: ArticleResponseDto; message: string }> {
    const article = await this.loadArticleBySlug(slug);

    this.assertAuthor(article, currentUser.userId);

    if (dto.title !== undefined && dto.title.trim() !== article.title) {
      article.title = dto.title.trim();

      article.slug = buildArticleSlug(article.title);
    }

    if (dto.description !== undefined) {
      article.description = dto.description.trim();
    }

    if (dto.body !== undefined) {
      article.body = dto.body.trim();
    }

    if (dto.tagList !== undefined) {
      article.tags = await this.findOrCreateTags(dto.tagList);
    }

    await this.articlesRepository.save(article);

    const updatedArticle = await this.loadArticleBySlug(article.slug);

    return {
      article: await this.buildArticleResponse(
        updatedArticle,
        currentUser.userId,
      ),
      message: this.translate('articles.UPDATE_SUCCESS'),
    };
  }

  async remove(
    slug: string,
    currentUser: AuthenticatedUser,
  ): Promise<{ message: string }> {
    const article = await this.loadArticleBySlug(slug);

    this.assertAuthor(article, currentUser.userId);

    await this.articlesRepository.remove(article);

    return { message: this.translate('articles.DELETE_SUCCESS') };
  }

  async favorite(
    slug: string,
    currentUser: AuthenticatedUser,
  ): Promise<{ article: ArticleResponseDto }> {
    const article = await this.loadArticleBySlug(slug);

    const existingFavorite = await this.favoritesRepository.findOne({
      where: {
        articleId: article.id,
        userId: currentUser.userId,
      },
    });

    if (!existingFavorite) {
      await this.favoritesRepository.save(
        this.favoritesRepository.create({
          articleId: article.id,
          userId: currentUser.userId,
        }),
      );
    }

    return {
      article: await this.buildArticleResponse(article, currentUser.userId),
    };
  }

  async unfavorite(
    slug: string,
    currentUser: AuthenticatedUser,
  ): Promise<{ article: ArticleResponseDto }> {
    const article = await this.loadArticleBySlug(slug);

    await this.favoritesRepository.delete({
      articleId: article.id,
      userId: currentUser.userId,
    });

    return {
      article: await this.buildArticleResponse(article, currentUser.userId),
    };
  }
}
