# Korean Zero

Korean learning MVP built with Next.js, Better Auth, Prisma, and PostgreSQL. Deploy with free HTTPS using [Vercel + Supabase](docs/DEPLOYMENT.md).

Live site: [korean-zero.vercel.app](https://korean-zero.vercel.app).

Hướng dẫn bằng tiếng Việt cho các lần chỉnh sửa và deploy tiếp theo: [các lệnh phát triển, cập nhật Supabase và deploy lại Vercel](docs/MAINTENANCE_AND_DEPLOY.md).

## Requirements

- Node.js 22 LTS and pnpm (the version in `package.json` is recommended).
- PostgreSQL 17, either through Docker Compose or a local PostgreSQL service. Docker is optional; PostgreSQL is required.

## Local setup

1. Install dependencies: `pnpm install --frozen-lockfile`.
2. Copy `.env.example` to `.env`. Set `DATABASE_URL` to your PostgreSQL database, set `POSTGRES_PASSWORD` if using Docker Compose, and set `BETTER_AUTH_SECRET` to a unique random value of at least 32 characters. For example, generate one locally with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to `http://localhost:3000` for the default port. Never commit `.env`.
3. Start PostgreSQL with `pnpm db:up`, or start your existing PostgreSQL service and create the `korean_zero` database there. The password in `DATABASE_URL` must match that server's credential. Docker Compose reads `POSTGRES_PASSWORD` from `.env`; it does not change an existing database user's password.
4. Apply existing migrations with `pnpm exec prisma migrate deploy`. Use `pnpm db:migrate` when developing a new migration.
5. On a new database, load sample courses and lessons with `pnpm db:seed`.
6. Start the app with `pnpm dev` and open `http://localhost:3000`.

The app fails at startup with a list of missing or invalid required environment variables. Better Auth uses salted scrypt password hashes. Admin access is granted through `pnpm admin:promote --email=you@example.com` after registering an account.

## Verification

Run `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm build`, and `pnpm exec playwright test`. Database tests use a separate database ending in `_test`, or `TEST_DATABASE_URL` when supplied; they do not reset the development database. Install Chromium first with `pnpm exec playwright install chromium` if needed.

More detail: [local development guide](docs/LOCAL_DEVELOPMENT.md), [product scope](docs/PRODUCT.md), [vocabulary pronunciation buttons](docs/VOCABULARY_AUDIO.md), and [audio provenance](docs/AUDIO_PROVENANCE.md).

Visitors browse published syllabi; lesson content requires login, enrollment, and completion of the preceding lesson. Passing a published quiz at 80% or higher completes its lesson. An exercise-free lesson must be started before completion. Dashboard words learned counts actual distinct vocabulary cards, with zero added by vocabulary-free lessons. Audio assets include `/audio/lessons/korean-vowels.ogg` and `/audio/vocab/mul.ogg`; dialogue blocks support both overall and per-line audio.
