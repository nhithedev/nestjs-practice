import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';

import { truncateAll } from './utils/db';
import { createArticle, registerAndLogin } from './utils/fixtures';

interface CommentBody {
  id: string;
  body: string;
}

interface CreateCommentResponseBody {
  comment: CommentBody;
}

interface ListCommentsResponseBody {
  comments: CommentBody[];
}

/**
 * E2E test cho CommentsController — đạt cấp độ C2 (condition coverage)
 */
describe('CommentsController (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await truncateAll(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /articles/:slug/comments', () => {
    it('tạo comment thành công khi có token hợp lệ (err=false, user hợp lệ → !user=false)', async () => {
      const { accessToken } = await registerAndLogin(app, 'author@test.com');
      const slug = await createArticle(app, accessToken);

      const res = await request(app.getHttpServer())
        .post(`/articles/${slug}/comments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ body: 'Nice article!' });

      expect(res.status).toBe(201);
      expect((res.body as CreateCommentResponseBody).comment.body).toBe(
        'Nice article!',
      );
    });

    it('trả 401 khi KHÔNG có token (err=false, !user=true — nhánh do !user gây ra)', async () => {
      const { accessToken } = await registerAndLogin(app, 'author2@test.com');
      const slug = await createArticle(app, accessToken);

      const res = await request(app.getHttpServer())
        .post(`/articles/${slug}/comments`)
        .send({ body: 'no token' });

      expect(res.status).toBe(401);
    });

    it('trả 401 khi token SAI chữ ký/không hợp lệ (err=true — nhánh do err gây ra, độc lập với !user)', async () => {
      const { accessToken } = await registerAndLogin(app, 'author3@test.com');
      const slug = await createArticle(app, accessToken);

      const res = await request(app.getHttpServer())
        .post(`/articles/${slug}/comments`)
        .set('Authorization', 'Bearer this.is.not.a.valid.jwt')
        .send({ body: 'bad token' });

      expect(res.status).toBe(401);
    });

    // Service: assertArticleExists — slug tồn tại / không tồn tại
    it('trả 404 khi slug không tồn tại', async () => {
      const { accessToken } = await registerAndLogin(app, 'author4@test.com');

      const res = await request(app.getHttpServer())
        .post('/articles/khong-ton-tai/comments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ body: 'hi' });

      expect(res.status).toBe(404);
    });

    // DTO validate: body hợp lệ / rỗng / quá 1000 ký tự
    it('trả 400 khi body rỗng (vi phạm MinLength)', async () => {
      const { accessToken } = await registerAndLogin(app, 'author5@test.com');
      const slug = await createArticle(app, accessToken);

      const res = await request(app.getHttpServer())
        .post(`/articles/${slug}/comments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ body: '' });

      expect(res.status).toBe(400);
    });

    it('trả 400 khi body quá 1000 ký tự (vi phạm MaxLength)', async () => {
      const { accessToken } = await registerAndLogin(app, 'author6@test.com');
      const slug = await createArticle(app, accessToken);

      const res = await request(app.getHttpServer())
        .post(`/articles/${slug}/comments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ body: 'a'.repeat(1001) });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /articles/:slug/comments', () => {
    // OptionalJwtAuthGuard cũng chạy handleRequest(err, user) nhưng luôn trả
    // undefined thay vì throw → status luôn 200, chỉ khác nội dung response
    // (isFollowing trong author). Test cả 2 nhánh
    it('trả về comments kèm thông tin đầy đủ khi có token hợp lệ (!user=false)', async () => {
      const { accessToken } = await registerAndLogin(app, 'viewer@test.com');
      const slug = await createArticle(app, accessToken);
      await request(app.getHttpServer())
        .post(`/articles/${slug}/comments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ body: 'first comment' });

      const res = await request(app.getHttpServer())
        .get(`/articles/${slug}/comments`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      const body = res.body as ListCommentsResponseBody;
      expect(body.comments).toHaveLength(1);
      expect(body.comments[0].body).toBe('first comment');
    });

    it('trả về comments khi KHÔNG có token, tức khách vãng lai (!user=true, guard không throw)', async () => {
      const { accessToken } = await registerAndLogin(app, 'viewer2@test.com');
      const slug = await createArticle(app, accessToken);
      await request(app.getHttpServer())
        .post(`/articles/${slug}/comments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ body: 'public comment' });

      const res = await request(app.getHttpServer()).get(
        `/articles/${slug}/comments`,
      );

      expect(res.status).toBe(200);
      expect((res.body as ListCommentsResponseBody).comments).toHaveLength(1);
    });

    it('trả 404 khi slug không tồn tại', async () => {
      const res = await request(app.getHttpServer()).get(
        '/articles/khong-ton-tai/comments',
      );

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /articles/:slug/comments/:commentId', () => {
    // remove(): 2 điều kiện gộp trong `where: { id, articleId }` (id sai or
    // articleId sai → !comment) + điều kiện authorId !== currentUser.userId.
    // Test riêng biệt từng điều kiện con để đạt C2

    it('chủ comment xoá thành công (authorId !== currentUserId → false, không throw)', async () => {
      const { accessToken } = await registerAndLogin(app, 'owner@test.com');
      const slug = await createArticle(app, accessToken);

      const created = await request(app.getHttpServer())
        .post(`/articles/${slug}/comments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ body: 'to be deleted' });
      const commentId = (created.body as CreateCommentResponseBody).comment.id;

      const res = await request(app.getHttpServer())
        .delete(`/articles/${slug}/comments/${commentId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
    });

    it('user khác xoá bị 403 (authorId !== currentUserId → true)', async () => {
      const owner = await registerAndLogin(app, 'owner2@test.com');
      const other = await registerAndLogin(app, 'other@test.com');
      const slug = await createArticle(app, owner.accessToken);

      const created = await request(app.getHttpServer())
        .post(`/articles/${slug}/comments`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ body: 'not yours' });
      const commentId = (created.body as CreateCommentResponseBody).comment.id;

      const res = await request(app.getHttpServer())
        .delete(`/articles/${slug}/comments/${commentId}`)
        .set('Authorization', `Bearer ${other.accessToken}`);

      expect(res.status).toBe(403);
    });

    it('trả 404 khi commentId không tồn tại (điều kiện con thứ nhất: id sai, articleId đúng)', async () => {
      const { accessToken } = await registerAndLogin(app, 'owner3@test.com');
      const slug = await createArticle(app, accessToken);

      const res = await request(app.getHttpServer())
        .delete(
          `/articles/${slug}/comments/00000000-0000-0000-0000-000000000000`,
        )
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
    });

    it('trả 404 khi comment tồn tại nhưng thuộc bài viết KHÁC (điều kiện con thứ hai: articleId sai, id đúng)', async () => {
      const { accessToken } = await registerAndLogin(app, 'owner4@test.com');
      const slugA = await createArticle(app, accessToken, { title: 'A' });
      const slugB = await createArticle(app, accessToken, { title: 'B' });

      const created = await request(app.getHttpServer())
        .post(`/articles/${slugA}/comments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ body: 'belongs to article A' });
      const commentId = (created.body as CreateCommentResponseBody).comment.id;

      // Comment tồn tại (id đúng) nhưng gọi xoá qua slug B → articleId khác
      const res = await request(app.getHttpServer())
        .delete(`/articles/${slugB}/comments/${commentId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
    });

    it('trả 401 khi KHÔNG có token', async () => {
      const { accessToken } = await registerAndLogin(app, 'owner5@test.com');
      const slug = await createArticle(app, accessToken);

      const created = await request(app.getHttpServer())
        .post(`/articles/${slug}/comments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ body: 'needs auth to delete' });
      const commentId = (created.body as CreateCommentResponseBody).comment.id;

      const res = await request(app.getHttpServer()).delete(
        `/articles/${slug}/comments/${commentId}`,
      );

      expect(res.status).toBe(401);
    });
  });
});
