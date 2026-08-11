import { ConfigService } from '@nestjs/config';

import { buildDatabaseSslOptions } from './database-ssl.factory';

function makeConfigService(env: Record<string, string>): ConfigService {
  return {
    get: <T>(key: string, defaultValue?: T): T =>
      (env[key] as unknown as T) ?? (defaultValue as T),
  } as unknown as ConfigService;
}

describe('buildDatabaseSslOptions', () => {
  it('trả về false khi NODE_ENV khác production (dev/test không cần SSL)', () => {
    const configService = makeConfigService({ NODE_ENV: 'test' });

    expect(buildDatabaseSslOptions(configService)).toBe(false);
  });

  it('production, không có DB_SSL_CA → verify bật mặc định (rejectUnauthorized: true, không có ca)', () => {
    const configService = makeConfigService({ NODE_ENV: 'production' });

    expect(buildDatabaseSslOptions(configService)).toEqual({
      rejectUnauthorized: true,
    });
  });

  it('production, có DB_SSL_CA → verify bằng CA đó, tự unescape "\\n" thành xuống dòng thật', () => {
    const configService = makeConfigService({
      NODE_ENV: 'production',
      DB_SSL_CA:
        '-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----',
    });

    expect(buildDatabaseSslOptions(configService)).toEqual({
      ca: '-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----',
      rejectUnauthorized: true,
    });
  });

  it('production, operator chủ động set DB_SSL_REJECT_UNAUTHORIZED=false → tắt verify (quyết định vận hành tường minh)', () => {
    const configService = makeConfigService({
      NODE_ENV: 'production',
      DB_SSL_REJECT_UNAUTHORIZED: 'false',
    });

    expect(buildDatabaseSslOptions(configService)).toEqual({
      rejectUnauthorized: false,
    });
  });
});
