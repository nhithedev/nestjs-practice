import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

import { RedisService } from '../../redis/redis.service';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_ACCESS_SECRET',
        'default_secret',
      ),
      passReqToCallback: true, // để nhận raw token từ request
    });
  }

  async validate(
    request: Request,
    payload: JwtPayload,
  ): Promise<AuthenticatedUser> {
    // Chỉ cho phép access token
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Token type không hợp lệ');
    }

    // Trích xuất raw Bearer token
    const authHeader = request.headers.authorization ?? '';
    const token = authHeader.replace('Bearer ', '');

    // Kiểm tra token có trong Redis blacklist không
    const isBlacklisted = await this.redisService.isBlacklisted(token);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token đã bị thu hồi');
    }

    return { userId: payload.sub, email: payload.email };
  }
}
