import { DataSource } from 'typeorm';

export async function truncateAll(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    `TRUNCATE TABLE comments, article_favorites, article_tags, articles,
     tags, user_follows, attachments, users RESTART IDENTITY CASCADE;`,
  );
}
