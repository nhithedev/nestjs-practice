import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { join } from 'path';
import { AcceptLanguageResolver, I18nModule } from 'nestjs-i18n';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NoCacheHeaderInterceptor } from './common/interceptors/no-cache.interceptor';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ArticlesModule } from './articles/articles.module';

// ── Named constants (C024) ─────────────────────────────────────────────────
const REDIS_DEFAULT_PORT = 6379;
const GLOBAL_THROTTLE_TTL_MS = 60000; // 60 giây
const GLOBAL_THROTTLE_LIMIT = 10;

@Module({
  imports: [
    // ── Global config ──────────────────────────────────────────────────────
    // NODE_ENV=test (set trước khi app module được import, xem test/jest-e2e.json
    // setupFiles) → nạp .env.test thay vì .env, để e2e test chạy vào DB test riêng
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
    }),

    // ── i18n ───────────────────────────────────────────────────────────────
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: join(__dirname, '/i18n/'),
        watch: true,
      },
      resolvers: [AcceptLanguageResolver],
    }),

    // ── Rate limiting (S045) ────────────────────────────────────────────────
    ThrottlerModule.forRoot([
      {
        ttl: GLOBAL_THROTTLE_TTL_MS,
        limit: GLOBAL_THROTTLE_LIMIT,
      },
    ]),

    // ── Redis ──────────────────────────────────────────────────────────────
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const useTls =
          configService.get<string>('REDIS_TLS', 'false') === 'true';
        const protocol = useTls ? 'rediss' : 'redis';
        const host = configService.get<string>('REDIS_HOST', 'localhost');
        const port = configService.get<number>(
          'REDIS_PORT',
          REDIS_DEFAULT_PORT,
        );

        return {
          type: 'single',
          url: `${protocol}://${host}:${port}`,
        };
      },
      inject: [ConfigService],
    }),

    // ── Database ───────────────────────────────────────────────────────────
    DatabaseModule,

    // ── Feature Modules ────────────────────────────────────────────────────
    UsersModule,
    AuthModule,
    ArticlesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: NoCacheHeaderInterceptor,
    },
  ],
})
export class AppModule {}
