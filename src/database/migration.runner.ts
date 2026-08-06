import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';

const isStatusMode = process.argv.includes('--status');

const DB_DEFAULT_PORT = 5432;

const MIGRATION_FILE_PATTERN = /^[a-zA-Z0-9._-]+.sql$/;

interface MigrationVersionRow extends Record<string, unknown> {
  version: string;
}

interface MigrationClientResult<Row> {
  rows: Row[];
}

interface MigrationClient {
  connect(): Promise<void>;
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<MigrationClientResult<Row>>;
  end(): Promise<void>;
}

interface MigrationClientConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

type MigrationClientConstructor = new (
  config: MigrationClientConfig,
) => MigrationClient;

class MigrationRunnerError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown,
  ) {
    super(message);
    this.name = 'MigrationRunnerError';
  }
}

function validateMigrationFilename(filename: string): string {
  if (!MIGRATION_FILE_PATTERN.test(filename)) {
    throw new MigrationRunnerError(
      `Migration file "${filename}" cannot be processed because its filename contains unsupported characters. Rename the file so that it contains only letters, numbers, periods, underscores, or hyphens before running the migration command again.`,
      filename,
    );
  }

  return filename;
}

async function runMigrations() {
  const ClientConstructor = Client as unknown as MigrationClientConstructor;
  const client = new ClientConstructor({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? DB_DEFAULT_PORT),
    user: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_DATABASE ?? 'nestjs_practice',
  });

  await client.connect();

  console.log('Connected to PostgreSQL');

  try {
    await client.query(`       CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    const { rows: executedRows } = await client.query<MigrationVersionRow>(
      'SELECT version FROM schema_migrations ORDER BY version',
    );

    const executed = new Set(
      executedRows.map((row) => validateMigrationFilename(row.version)),
    );

    const migrationsDir = path.join(__dirname, 'migrations');

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .map(validateMigrationFilename)
      .sort();

    if (isStatusMode) {
      console.log('');
      console.log('Migration Status:');

      for (const file of files) {
        const status = executed.has(file) ? 'executed' : 'pending';

        console.log('  ', status, ' ', file);
      }
      return;
    }

    const pending = files.filter((file) => !executed.has(file));

    if (pending.length === 0) {
      console.log('All migrations are up to date');
      return;
    }

    console.log('');
    console.log('Running pending migration(s), count:', pending.length);

    for (const file of pending) {
      const filePath = path.join(migrationsDir, file);

      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log('Running:', file);

      await client.query('BEGIN');

      try {
        await client.query(sql);

        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [file],
        );

        await client.query('COMMIT');

        console.log('Done:', file);
      } catch (err: unknown) {
        await client.query('ROLLBACK');

        throw new MigrationRunnerError(
          'Failed to execute migration. The database transaction was rolled back and no schema changes were committed. Review the reported database error (see "cause"), correct the root cause, and run the migration command again.',
          { file, err },
        );
      }
    }

    console.log('');
    console.log('All migrations completed successfully');
  } finally {
    await client.end();
  }
}

function loadEnv() {
  const envPath = path.join(__dirname, '../../.env');

  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf-8');

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const [key, ...rest] = trimmed.split('=');

    if (key) {
      process.env[key.trim()] = rest.join('=').trim();
    }
  }
}

loadEnv();

runMigrations().catch((error: unknown) => {
  const unknownCause: unknown =
    error instanceof MigrationRunnerError ? error.cause : error;

  console.error({
    event: 'migration_runner_failed',
    message:
      error instanceof MigrationRunnerError
        ? error.message
        : error instanceof Error
          ? `The migration runner terminated because an unexpected error occurred: ${error.message}`
          : 'The migration runner terminated because an unknown error occurred.',
    cause: unknownCause,
    guidance:
      'Review the reported error, correct the root cause, and run the migration command again.',
  });

  process.exit(1);
});
