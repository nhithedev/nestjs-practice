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
import { I18nService } from 'nestjs-i18n';

import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends TokenPair {
  message: string;
}

export interface AuthLogoutRequest {
  headers: {
    authorization?: string;
    'x-refresh-token'?: string | string[];
  };
  session?: {
    destroy: (callback: (error?: Error) => void) => void;
  };
}

@Injectable()
export class AuthService {
  private readonly BCRYPT_SALT_ROUNDS = 12;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly i18n: I18nService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.usersService.findByEmail(dto.email);

    if (existingUser) {
      throw new ConflictException(
        await this.translate('auth.emailAlreadyUsed'),
      );
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

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      message: await this.translate('auth.registerSuccess'),
      ...tokens,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException(
        await this.translate('auth.invalidCredentials'),
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException(
        await this.translate('auth.invalidCredentials'),
      );
    }

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      message: await this.translate('auth.loginSuccess'),
      ...tokens,
    };
  }

  async logout(request: AuthLogoutRequest): Promise<{ message: string }> {
    await this.destroySession(request.session);

    const authorization = request.headers.authorization ?? '';

    const accessToken = authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : '';

    const refreshToken = request.headers['x-refresh-token'];
    const normalizedRefreshToken = Array.isArray(refreshToken)
      ? refreshToken[0]
      : refreshToken;

    await this.invalidateSession(accessToken, normalizedRefreshToken);

    return {
      message: await this.translate('auth.logoutSuccess'),
    };
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
        await this.translate('auth.refreshTokenConfigMissing'),
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
        await this.translate('auth.jwtConfigMissingSecrets'),
      );
    }

    if (!accessExpiresIn || !refreshExpiresIn) {
      throw new InternalServerErrorException(
        await this.translate('auth.jwtConfigMissingExpiration'),
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

  private async destroySession(
    session?: AuthLogoutRequest['session'],
  ): Promise<void> {
    if (!session) {
      return;
    }

    await new Promise<void>((resolve) => {
      session.destroy(() => resolve());
    });
  }

  private translate(key: string): Promise<string> {
    return this.i18n.translate(key);
  }
}
