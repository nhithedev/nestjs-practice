import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import type {
  RequestWithOptionalUser,
  RequestWithUser,
} from '../common/types/authenticated-request';

import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { QueryArticleDto } from './dto/query-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@ApiTags('Articles')
@ApiHeader({
  name: 'Accept-Language',
  description: 'Language (vi hoặc en)',
  required: false,
  schema: {
    type: 'string',
    default: 'vi',
  },
})
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo bài viết mới' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Bài viết vừa tạo' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateArticleDto, @Req() req: RequestWithUser) {
    return this.articlesService.create(dto, req.user);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Danh sách bài viết (lọc theo tag/author/favorited)',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Danh sách bài viết' })
  async list(
    @Query() query: QueryArticleDto,
    @Req() req: RequestWithOptionalUser,
  ) {
    return this.articlesService.list(query, req.user?.userId);
  }

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bài viết của những người mình đang follow' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Danh sách bài viết' })
  async feed(@Query() query: QueryArticleDto, @Req() req: RequestWithUser) {
    return this.articlesService.feed(req.user, query);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Chi tiết bài viết theo slug' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Chi tiết bài viết' })
  async findBySlug(
    @Param('slug') slug: string,
    @Req() req: RequestWithOptionalUser,
  ) {
    return this.articlesService.findBySlug(slug, req.user?.userId);
  }

  @Put(':slug')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật bài viết (chỉ tác giả)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bài viết sau khi cập nhật',
  })
  async update(
    @Param('slug') slug: string,
    @Body() dto: UpdateArticleDto,
    @Req() req: RequestWithUser,
  ) {
    return this.articlesService.update(slug, dto, req.user);
  }

  @Delete(':slug')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xoá bài viết (chỉ tác giả)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Xoá thành công' })
  @HttpCode(HttpStatus.OK)
  async remove(@Param('slug') slug: string, @Req() req: RequestWithUser) {
    return this.articlesService.remove(slug, req.user);
  }

  @Post(':slug/favorite')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Favorite bài viết (idempotent)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bài viết sau khi favorite',
  })
  @HttpCode(HttpStatus.OK)
  async favorite(@Param('slug') slug: string, @Req() req: RequestWithUser) {
    return this.articlesService.favorite(slug, req.user);
  }

  @Delete(':slug/favorite')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unfavorite bài viết (idempotent)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bài viết sau khi unfavorite',
  })
  @HttpCode(HttpStatus.OK)
  async unfavorite(@Param('slug') slug: string, @Req() req: RequestWithUser) {
    return this.articlesService.unfavorite(slug, req.user);
  }
}
