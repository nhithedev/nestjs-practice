import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  HttpCode,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
import { ImageContentTypeValidator } from './validators/image-content-type.validator';

interface RequestWithUser extends ExpressRequest {
  user: AuthenticatedUser;
}

const AVATAR_STORAGE_DIR = join(process.cwd(), 'public', 'uploads', 'avatars');
const AVATAR_FILE_SIZE_LIMIT_BYTES = 5 * 1024 * 1024;

// Whitelist dùng để lọc sớm theo mimetype client khai báo (lớp lọc rẻ, chặn trước khi ghi ổ đĩa).
// Đây KHÔNG phải validate cuối cùng — nội dung file được xác nhận thật sự bằng
// ImageContentTypeValidator (đọc magic bytes) ở @UploadedFile bên dưới.
const ALLOWED_AVATAR_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function buildAvatarFilename(originalName: string): string {
  return `${randomUUID()}${extname(originalName)}`;
}

function createAvatarStorage() {
  return diskStorage({
    destination: (_, __, callback) => {
      fs.mkdirSync(AVATAR_STORAGE_DIR, { recursive: true });
      callback(null, AVATAR_STORAGE_DIR);
    },
    filename: (_, file, callback) => {
      callback(null, buildAvatarFilename(file.originalname));
    },
  });
}

function avatarFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  callback(null, ALLOWED_AVATAR_MIME_TYPES.has(file.mimetype));
}

@ApiTags('Users')
@ApiHeader({
  name: 'Accept-Language',
  description: 'Language (vi hoặc en)',
  required: false,
  schema: {
    type: 'string',
    default: 'vi',
  },
})
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Lấy profile của user hiện tại' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Thông tin profile' })
  async getMe(@Req() req: RequestWithUser) {
    return {
      user: await this.usersService.getProfile(
        req.user.userId,
        req.user.userId,
      ),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy profile user theo id' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Thông tin profile' })
  async getProfile(@Param('id') id: string, @Req() req: RequestWithUser) {
    return {
      user: await this.usersService.getProfile(id, req.user.userId),
    };
  }

  @Patch('me')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          example: 'Nguyen Van A',
        },
        avatar: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: createAvatarStorage(),
      fileFilter: avatarFileFilter,
      limits: {
        fileSize: AVATAR_FILE_SIZE_LIMIT_BYTES,
      },
    }),
  )
  @ApiOperation({ summary: 'Cập nhật profile của user hiện tại' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile sau khi cập nhật',
  })
  async updateMe(
    @Req() req: RequestWithUser,
    @Body() dto: UpdateUserDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new MaxFileSizeValidator({ maxSize: AVATAR_FILE_SIZE_LIMIT_BYTES }),
          new ImageContentTypeValidator(),
        ],
      }),
    )
    avatar?: Express.Multer.File,
  ) {
    return {
      user: await this.usersService.updateProfile(req.user.userId, dto, avatar),
    };
  }

  @Post(':id/follow')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Follow user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Profile sau khi follow' })
  async followUser(@Param('id') id: string, @Req() req: RequestWithUser) {
    return {
      user: await this.usersService.followUser(req.user.userId, id),
    };
  }

  @Delete(':id/follow')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unfollow user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile sau khi unfollow',
  })
  async unfollowUser(@Param('id') id: string, @Req() req: RequestWithUser) {
    return {
      user: await this.usersService.unfollowUser(req.user.userId, id),
    };
  }
}
