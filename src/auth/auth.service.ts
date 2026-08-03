import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { StringValue } from 'ms';

import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly BCRYPT_SALT_ROUNDS = 12;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async register(dto: RegisterDto): Promise<TokenPair> {
    const existingUser = await this.usersService.findByEmail(dto.email);

    if (existingUser) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      this.BCRYPT_SALT_ROUNDS,
    );

    const user = await this.usersService.create({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
    });

    return this.generateTokens(user.id, user.email);
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    return this.generateTokens(user.id, user.email);
  }

  async invalidateSession(
    accessToken: string,
    refreshToken?: string,
  ): Promise<void> {
    if (accessToken) {
      const decodedAccess = this.jwtService.decode<JwtPayload>(accessToken);

      if (decodedAccess?.exp) {
        const currentTime = Math.floor(Date.now() / 1000);
        const ttl = decodedAccess.exp - currentTime;

        if (ttl > 0) {
          await this.redisService.addToBlacklist(accessToken, ttl);
        }
      }
    }

    if (!refreshToken) {
      return;
    }

    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');

    if (!refreshSecret) {
      throw new InternalServerErrorException(
        'Refresh token configuration is missing',
      );
    }

    try {
      const decodedRefresh = await this.jwtService.verifyAsync<JwtPayload>(
        refreshToken,
        { secret: refreshSecret },
      );

      if (!decodedRefresh.exp) {
        return;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const ttl = decodedRefresh.exp - currentTime;

      if (ttl > 0) {
        await this.redisService.addToBlacklist(refreshToken, ttl);
      }
    } catch {
      return;
    }
  }

  private async generateTokens(
    userId: string,
    email: string,
  ): Promise<TokenPair> {
    const accessPayload: JwtPayload = {
      sub: userId,
      email,
      type: 'access',
    };

    const refreshPayload: JwtPayload = {
      sub: userId,
      email,
      type: 'refresh',
    };

    // S012: Get all config values without hardcoded defaults
    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const accessExpiresIn = this.configService.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
    );
    const refreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
    );

    if (!accessSecret || !refreshSecret) {
      throw new InternalServerErrorException(
        'JWT configuration is missing required secrets',
      );
    }

    if (!accessExpiresIn || !refreshExpiresIn) {
      throw new InternalServerErrorException(
        'JWT configuration is missing expiration times',
      );
    }

    // Cast to StringValue type for compatibility with JwtService
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: accessSecret,
        expiresIn: accessExpiresIn as StringValue,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn as StringValue,
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
