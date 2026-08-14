<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

### E2E test setup (one-time, local)

E2E tests hit a real running app + real Postgres/Redis, so they need their
own database, isolated from the one you use for manual dev/Swagger testing:

```bash
# 1. Copy .env.example -> .env.test, set DB_DATABASE=nestjs_practice_test
#    (already done in this repo; .env.test is gitignored, create your own).

# 2. Create the test database (Postgres must be running, e.g. docker-compose up -d)
docker exec nestjs_postgres psql -U postgres -c "CREATE DATABASE nestjs_practice_test;"

# 3. Run migrations against the test database
$ NODE_ENV=test npm run migration:run   # PowerShell: $env:NODE_ENV='test'; npm run migration:run

# 4. Run the e2e suite
$ npm run test:e2e
```

- `NODE_ENV=test` makes `ConfigModule` load `.env.test` instead of `.env`
  ([app.module.ts](src/app.module.ts)) and makes the migration runner do the
  same ([migration.runner.ts](src/database/migration.runner.ts)).
- `test/jest-e2e.json` sets `NODE_ENV=test` automatically via `setupFiles`
  before each spec file loads, so `npm run test:e2e` works without exporting
  the variable yourself.
- Each `*.e2e-spec.ts` truncates every table in `afterEach` (see
  [test/utils/db.ts](test/utils/db.ts)) so test cases stay independent, and
  seeds data through real HTTP calls (see
  [test/utils/fixtures.ts](test/utils/fixtures.ts)) rather than inserting
  rows directly.
- [test/comments.e2e-spec.ts](test/comments.e2e-spec.ts) is the reference
  example, written to condition-coverage ("C2") level for `CommentsController`.

## CI/CD

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs on every push/PR to
`main`: install → lint → build → unit test → spin up Postgres+Redis service
containers → run migrations → e2e test, in that fail-fast order.

## Deploy to Render

1. Push this repo to GitHub, then on Render: **New → Web Service** → connect the repo.
2. **Build Command**: `npm install && npm run build && npm run migration:run`
3. **Start Command**: `npm run start:prod`
4. **Environment Variables** (set on the Render dashboard, never commit real
   secrets): `NODE_ENV=production`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`,
   `DB_PASSWORD`, `DB_DATABASE`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_TLS`,
   `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_SECRET`,
   `JWT_REFRESH_EXPIRES_IN`. Render sets `PORT` itself — don't set it, and
   don't hardcode a port in code (`main.ts` already reads `process.env.PORT`).
5. Create a Render Postgres and Redis (or point at external ones, e.g.
   Neon/Upstash) and fill in the `DB_*`/`REDIS_*` variables above.
   `database.module.ts` enables SSL automatically when `NODE_ENV=production`
   (required by Render's managed Postgres), via
   [database-ssl.factory.ts](src/database/database-ssl.factory.ts):
   certificate verification is **on by default**. If Render's Postgres uses
   an internal CA your Node runtime doesn't already trust, paste its CA cert
   into `DB_SSL_CA` (PEM content, with real newlines escaped as `\n`) so the
   connection verifies properly instead of skipping verification. Only set
   `DB_SSL_REJECT_UNAUTHORIZED=false` if you explicitly accept the MITM risk
   that comes with disabling verification.
6. Deploy once manually, check build/start logs. After that, every commit
   pushed to `main` auto-deploys (Render's default Auto-Deploy = the "CD" half).
7. Known limitation: avatar uploads use local disk storage
   ([users.controller.ts](src/users/users.controller.ts)), and Render Web
   Services have an ephemeral filesystem — uploaded avatars are lost on the
   next deploy/restart. Fixing this means moving to object storage (S3/
   Cloudinary/paid Render Disk), out of scope for the initial deploy.
8. Optional: to stop Render deploying commits that failed CI, either enable
   GitHub branch protection ("require status checks to pass" on `main`), or
   turn off Render Auto-Deploy and add a `deploy` job to `ci.yml` that curls
   the Render Deploy Hook after the `test` job passes.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
