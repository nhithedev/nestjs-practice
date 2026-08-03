import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

const BLACKLIST_PREFIX = 'blacklist:';

@Injectable()
export class RedisService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Thêm token vào blacklist với TTL tính bằng giây
   * TTL nên bằng thời gian còn lại đến khi token hết hạn
   */
  async addToBlacklist(token: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return; // Token đã hết hạn, không cần lưu
    await this.redis.setex(`${BLACKLIST_PREFIX}${token}`, ttlSeconds, '1');
  }

  /**
   * Kiểm tra token có trong blacklist không
   */
  async isBlacklisted(token: string): Promise<boolean> {
    const result = await this.redis.get(`${BLACKLIST_PREFIX}${token}`);
    return result !== null;
  }
}
