import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

// Mật khẩu mặc định dùng chung cho fixture — RegisterDto (MinLength 12).
const DEFAULT_PASSWORD = 'Password123!';

interface RegisterResponseBody {
  accessToken: string;
}

interface CreateArticleResponseBody {
  article: { slug: string };
}

export async function registerAndLogin(
  app: INestApplication<App>,
  email: string,
  password: string = DEFAULT_PASSWORD,
): Promise<{ accessToken: string; email: string; password: string }> {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password, name: 'Test User' });

  const body = res.body as RegisterResponseBody;

  return { accessToken: body.accessToken, email, password };
}

/**
 * Tạo 1 article bằng token có sẵn, trả về slug
 * cho test có sẵn 1 article
 */
export async function createArticle(
  app: INestApplication<App>,
  accessToken: string,
  overrides: Partial<{ title: string; description: string; body: string }> = {},
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/articles')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      title: overrides.title ?? 'Sample article',
      description: overrides.description ?? 'desc',
      body: overrides.body ?? 'body',
    });

  return (res.body as CreateArticleResponseBody).article.slug;
}
