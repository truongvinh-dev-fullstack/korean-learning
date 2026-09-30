# Local Development Guide

## 1. Prerequisites

- **Node.js**: Version 18.17+ or 20.x LTS (recommended: v20.19+)
- **Package Manager**: `pnpm` (v10+ or v12+)
- **Database**:
  - **Docker & Docker Compose** (recommended for cross-platform local development), OR
  - **Native PostgreSQL 16/17** installed and running on `localhost:5432`
- **Git** & **PowerShell** (Windows)

---

## 2. Environment Configuration

From a PowerShell terminal, copy the example environment file:

```powershell
Copy-Item .env.example .env
```

### Environment Variables Reference

| Variable | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Yes | `"postgresql://postgres:postgres@localhost:5432/korean_zero?schema=public"` | PostgreSQL connection string. Default port `5432`, database `korean_zero`. |
| `PORT` | No | `3000` | Port for the HTTP Next.js server. |
| `NODE_ENV` | No | `"development"` | Node runtime environment (`development`, `test`, `production`). |

---

## 3. Quickstart: Exact PowerShell Commands from Fresh Clone

Run the following commands in order inside PowerShell:

```powershell
# 1. Clone repository and enter directory
git clone <repository-url>
Set-Location korean

# 2. Copy development environment file
Copy-Item .env.example .env

# 3. Install dependencies using pnpm
pnpm install

# 4. Start PostgreSQL database container (or use local native PostgreSQL service)
pnpm db:up

# If using local PostgreSQL without Docker:
# Ensure database "korean_zero" exists:
# & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -c "CREATE DATABASE korean_zero;"

# 5. Apply database migrations
pnpm db:migrate

# 6. Seed baseline database
pnpm db:seed

# 7. Start local development server
pnpm dev
```

The application will be accessible at: **`http://localhost:3000`**.

Verify system and database health:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/health" | ConvertTo-Json
```

---

## 4. Development & Testing Scripts

| Command | Exact Action |
| :--- | :--- |
| `pnpm dev` | Starts Next.js development server with hot reload at `http://localhost:3000`. |
| `pnpm build` | Compiles optimized Next.js production build and checks types/pages. |
| `pnpm start` | Runs the compiled production server. |
| `pnpm lint` | Runs ESLint (`eslint .`) across all files. |
| `pnpm typecheck` | Runs TypeScript type checking (`tsc --noEmit`) in strict mode. |
| `pnpm test` | Starts Vitest in watch mode. |
| `pnpm test:run` | Runs Vitest test suite once to completion. |
| `pnpm db:up` | Boots the PostgreSQL container via `docker compose up -d`. |
| `pnpm db:down` | Stops the PostgreSQL container via `docker compose down`. |
| `pnpm db:migrate` | Runs `prisma migrate dev` to generate and apply database migrations. |
| `pnpm db:seed` | Executes `tsx prisma/seed.ts` to populate baseline data. |
| `pnpm db:studio` | Launches Prisma Studio GUI for exploring the database. |

---

## 5. Verification Commands (Definition of Done Checklist)

Execute this sequence in PowerShell to verify the entire development setup:

```powershell
# 1. Run unit and integration tests
pnpm test:run

# 2. Verify strict TypeScript compliance
pnpm typecheck

# 3. Verify code style and linter rules
pnpm lint

# 4. Verify Next.js production bundle build
pnpm build
```

---

## 6. Troubleshooting & Gotchas

### 1. PostgreSQL Connection Refused (`ECONNREFUSED 127.0.0.1:5432`)
- **Docker Compose**: Make sure Docker is running and execute `pnpm db:up`. Verify container status:
  ```powershell
  docker compose ps
  ```
- **Native Windows Service**: Verify that the `postgresql` service is running:
  ```powershell
  Get-Service *postgres* | Start-Service
  ```

### 2. pnpm Build Scripts Blocked (`ERR_PNPM_IGNORED_BUILDS`)
- `pnpm` v12 protects against unreviewed native build scripts.
- The approved native builds are configured in `pnpm-workspace.yaml`:
  ```yaml
  allowBuilds:
    "@prisma/client": true
    "@prisma/engines": true
    "prisma": true
    "esbuild": true
  ```

### 3. Database Reset
To re-run migrations from scratch:
```powershell
pnpm prisma migrate dev
```
To inspect data in browser:
```powershell
pnpm db:studio
```
