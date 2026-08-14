import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nContext } from 'nestjs-i18n';
import { In, Repository } from 'typeorm';
import { UserFollow } from '../users/entities/user-follow.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { UserProfileDto } from '../users/dto/user-profile.dto';
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
  ) { }

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

  private async buildArticleResponseBatch(
    articles: Article[],
    viewerId?: string,
  ): Promise<ArticleResponseDto[]> {
    if (articles.length === 0) return [];

    const manager = this.articlesRepository.manager;

    const authorIds = [...new Set(articles.map((a) => a.authorId))];
    const articleIds = articles.map((a) => a.id);

    // 1. Fetch all author User rows in one query
    const authors = await manager.find(User, {
      where: { id: In(authorIds) },
    });
    const authorsById = new Map(authors.map((u) => [u.id, u]));

    // 2. Follower counts per author: SELECT following_id, COUNT(*) FROM user_follows WHERE following_id IN (...)
    const followerRows: { following_id: string; cnt: string }[] =
      await manager
        .createQueryBuilder(UserFollow, 'uf')
        .select('uf.following_id', 'following_id')
        .addSelect('COUNT(*)', 'cnt')
        .where('uf.following_id IN (:...ids)', { ids: authorIds })
        .groupBy('uf.following_id')
        .getRawMany();
    const followerCountByAuthorId = new Map(
      followerRows.map((r) => [r.following_id, Number(r.cnt)]),
    );

    // 3. Following counts per author: SELECT follower_id, COUNT(*) FROM user_follows WHERE follower_id IN (...)
    const followingRows: { follower_id: string; cnt: string }[] =
      await manager
        .createQueryBuilder(UserFollow, 'uf')
        .select('uf.follower_id', 'follower_id')
        .addSelect('COUNT(*)', 'cnt')
        .where('uf.follower_id IN (:...ids)', { ids: authorIds })
        .groupBy('uf.follower_id')
        .getRawMany();
    const followingCountByAuthorId = new Map(
      followingRows.map((r) => [r.follower_id, Number(r.cnt)]),
    );

    // 4. Which authors the viewer follows
    const viewerFollowedAuthorIds = new Set<string>();
    if (viewerId) {
      const viewerFollowRows: { following_id: string }[] = await manager
        .createQueryBuilder(UserFollow, 'uf')
        .select('uf.following_id', 'following_id')
        .where('uf.follower_id = :viewerId', { viewerId })
        .andWhere('uf.following_id IN (:...ids)', { ids: authorIds })
        .getRawMany();
      viewerFollowRows.forEach((r) =>
        viewerFollowedAuthorIds.add(r.following_id),
      );
    }

    // 5. Favorites count per article: SELECT article_id, COUNT(*) FROM article_favorites WHERE article_id IN (...)
    const favCountRows: { article_id: string; cnt: string }[] = await manager
      .createQueryBuilder(ArticleFavorite, 'af')
      .select('af.article_id', 'article_id')
      .addSelect('COUNT(*)', 'cnt')
      .where('af.article_id IN (:...ids)', { ids: articleIds })
      .groupBy('af.article_id')
      .getRawMany();
    const favCountByArticleId = new Map(
      favCountRows.map((r) => [r.article_id, Number(r.cnt)]),
    );

    // 6. Which articles the viewer has favorited
    const viewerFavoritedArticleIds = new Set<string>();
    if (viewerId) {
      const viewerFavRows: { article_id: string }[] = await manager
        .createQueryBuilder(ArticleFavorite, 'af')
        .select('af.article_id', 'article_id')
        .where('af.user_id = :viewerId', { viewerId })
        .andWhere('af.article_id IN (:...ids)', { ids: articleIds })
        .getRawMany();
      viewerFavRows.forEach((r) =>
        viewerFavoritedArticleIds.add(r.article_id),
      );
    }

    // Assemble DTOs in-memory — zero additional queries
    return articles.map((article) => {
      const user = authorsById.get(article.authorId)!;

      const authorDto = new UserProfileDto();
      authorDto.id = user.id;
      authorDto.email = user.email;
      authorDto.name = user.name;
      authorDto.avatarUrl = user.avatarAttachment?.url ?? null;
      authorDto.followersCount =
        followerCountByAuthorId.get(user.id) ?? 0;
      authorDto.followingCount =
        followingCountByAuthorId.get(user.id) ?? 0;
      authorDto.isFollowing = viewerFollowedAuthorIds.has(user.id);
      authorDto.createdAt = user.createdAt;
      authorDto.updatedAt = user.updatedAt;

      return ArticleResponseDto.fromEntity(
        article,
        authorDto,
        viewerFavoritedArticleIds.has(article.id),
        favCountByArticleId.get(article.id) ?? 0,
      );
    });
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

    const response = await this.buildArticleResponseBatch(articles, viewerId);

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

    const response = await this.buildArticleResponseBatch(
      articles,
      currentUser.userId,
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
