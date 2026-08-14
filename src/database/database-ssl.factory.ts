import { ConfigService } from '@nestjs/config';
import type { TlsOptions } from 'tls';

type DatabaseSslOptions = boolean | TlsOptions;

// ── Named constants (C024) ──────────────────────────────────────────────────
const REJECT_UNAUTHORIZED_DEFAULT = 'true';
const REJECT_UNAUTHORIZED_DISABLED_VALUE = 'false';

export function buildDatabaseSslOptions(
  configService: ConfigService,
): DatabaseSslOptions {
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  if (!isProduction) {
    return false;
  }

  const rejectUnauthorized =
    configService.get<string>(
      'DB_SSL_REJECT_UNAUTHORIZED',
      REJECT_UNAUTHORIZED_DEFAULT,
    ) !== REJECT_UNAUTHORIZED_DISABLED_VALUE;

  const rawCa = configService.get<string>('DB_SSL_CA');
  const ca = rawCa?.replace(/\\n/g, '\n');

  return ca ? { ca, rejectUnauthorized } : { rejectUnauthorized };
}
