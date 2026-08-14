import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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

import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('Comments')
@ApiHeader({
  name: 'Accept-Language',
  description: 'Language (vi hoặc en)',
  required: false,
  schema: {
    type: 'string',
    default: 'vi',
  },
})
@Controller('articles/:slug/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thêm comment vào bài viết' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Comment vừa tạo' })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('slug') slug: string,
    @Body() dto: CreateCommentDto,
    @Req() req: RequestWithUser,
  ) {
    return this.commentsService.create(slug, dto, req.user);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Danh sách comment của bài viết' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Danh sách comment' })
  async findAll(
    @Param('slug') slug: string,
    @Req() req: RequestWithOptionalUser,
  ) {
    return this.commentsService.findByArticle(slug, req.user?.userId);
  }

  @Delete(':commentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xoá comment (chỉ tác giả comment)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Xoá thành công' })
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('slug') slug: string,
    @Param('commentId') commentId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.commentsService.remove(slug, commentId, req.user);
  }
}
