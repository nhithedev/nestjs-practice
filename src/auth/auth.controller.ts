import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request as ExpressRequest, Response } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthenticatedUser } from './strategies/jwt.strategy';
import { NoCacheHeaderInterceptor } from '../common/interceptors/no-cache.interceptor';

interface RequestWithUser extends ExpressRequest {
  user: AuthenticatedUser;
  session?: {
    destroy: (callback: (error?: Error) => void) => void;
  };
}

const LOGIN_THROTTLE_TTL_MS = 60000;
const LOGIN_THROTTLE_LIMIT = 5;
const CONNECT_SID_COOKIE = 'connect.sid';
const SESSION_ID_COOKIE = 'sessionId';

@ApiTags('Auth')
@ApiHeader({
  name: 'Accept-Language',
  description: 'Language (vi hoặc en)',
  required: false,
  schema: {
    type: 'string',
    default: 'vi',
  },
})
@UseInterceptors(NoCacheHeaderInterceptor)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Đăng ký tài khoản mới',
  })
  @ApiResponse({
    status: 201,
    description: 'Đăng ký thành công, trả về access + refresh token',
  })
  @ApiResponse({
    status: 409,
    description: 'Email đã tồn tại',
  })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: LOGIN_THROTTLE_LIMIT,
      ttl: LOGIN_THROTTLE_TTL_MS,
    },
  })
  @ApiOperation({
    summary: 'Đăng nhập',
  })
  @ApiResponse({
    status: 200,
    description: 'Đăng nhập thành công, trả về access + refresh token',
  })
  @ApiResponse({
    status: 401,
    description: 'Sai email hoặc mật khẩu',
  })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({
    name: 'X-Refresh-Token',
    description: 'Refresh token cần được vô hiệu hóa',
    required: true,
  })
  @ApiOperation({
    summary: 'Đăng xuất và vô hiệu hóa access token và refresh token',
  })
  @ApiResponse({
    status: 200,
    description: 'Đăng xuất thành công',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async logout(
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    // Invalidates and blacklists both access and refresh tokens via AuthService.logout
    const result = await this.authService.logout(req);

    response.clearCookie(CONNECT_SID_COOKIE);
    response.clearCookie(SESSION_ID_COOKIE);

    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy thông tin user hiện tại',
  })
  @ApiResponse({
    status: 200,
    description: 'Thông tin user',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  getMe(@Req() req: RequestWithUser) {
    return {
      user: req.user,
    };
  }
}
