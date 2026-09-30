# GEMINI Agent Guidelines & Repository Rules

## 1. Project Overview & Role
You are developing the **Korean Language Learning Platform (MVP)**, a modular monolith web application designed to guide beginner students through Hangul, structured vocabulary and grammar, interactive server-graded exercises, continuous study streak tracking, and an SM-2 spaced repetition (SRS) flashcard system, alongside an administrative content management portal.

---

## 2. Core Architectural & Code Rules

### 2.1 Modular Monolith Structure
- All domain features live in encapsulated modules under `src/modules/`:
  - `auth`: Credentials, sessions, password hashing, RBAC.
  - `courses`: Course catalog, syllabus, enrollment state.
  - `lessons`: Sequential lessons, Hangul guides, vocabulary, grammar, dialogue, audio URLs.
  - `exercises`: Quiz questions and the server-side grading engine.
  - `progress`: Lesson completion status, daily activity logs, study streaks.
  - `srs`: SuperMemo-2 spaced repetition engine, flashcard reviews, queue queries.
  - `admin`: Administrative curriculum management and authoring.
- **Layering Principle**: `HTTP Handlers / Pages` $\to$ `Domain Services` $\to$ `ORM / Database Repositories`. Do not place business or validation logic in UI components or route endpoints.
- **Boundary Isolation**: Do not mutate another module's database tables directly. Inter-module interactions must go through exported service methods (e.g., `srsService.enqueueLessonVocabulary()` called upon lesson completion).

### 2.2 Security & Grading Mandates
- **Server-Side Grading Only**: Exercise answer keys and solution patterns must **never** be exposed in client-facing payloads. Quiz submissions must be graded exclusively on the server.
- **Role Guards**: Verify user roles (`STUDENT` vs `ADMIN`) on all non-public endpoints. The `/admin` routes and `/api/admin/*` APIs must strictly reject non-admin users with HTTP 403.
- **Password Security**: Passwords must be hashed using Argon2id or bcrypt (cost $\ge 12$). Never log, return, or store plaintext passwords.
- **No File Uploads**: Media is referenced exclusively via validated external HTTPS audio URLs or pre-bundled static assets.

### 2.3 Technology & Local Execution Rules
- **Stack**: TypeScript (strict mode), Next.js / React, SQLite (`file:./dev.db`) via ORM, Vanilla CSS / CSS Modules with modern design tokens.
- **Zero Cloud / Zero External Infra**: The application runs completely locally. Do **not** introduce Docker requirements, Redis, external message queues, or cloud storage for the MVP.
- **Input Validation**: Use Zod schemas on all API request bodies.
- **Standard API Envelope**:
  - Success: `{ success: true, data: T }`
  - Error: `{ success: false, error: { code: string, message: string, details?: unknown } }`

---

## 3. Scope Guardrails: Explicit MVP Exclusions
Do **NOT** implement the following features during MVP phases:
- ❌ Payment gateways (Stripe, PayPal, etc.)
- ❌ Social OAuth logins (Google, Kakao, etc.)
- ❌ Transactional email delivery services (SendGrid, SMTP, etc.)
- ❌ AI conversational agents / chat bots
- ❌ Speech recognition / audio pronunciation scoring
- ❌ User file uploads or multipart storage
- ❌ Community discussion forums / comments
- ❌ Native mobile apps
- ❌ Redis, Kafka, or background worker daemons
- ❌ Cloud hosting / infrastructure-as-code scripts

---

## 4. Engineering Workflow & Phase Discipline
- **Follow Roadmap Phasing**: Implement features strictly in the order defined in `docs/ROADMAP.md`. Do not leap ahead to later phases before completing prerequisites.
- **Definition of Done**: Every phase deliverable must pass TypeScript compilation (`npm run typecheck`), linting (`npm run lint`), and tests (`npm test`), and run with the standard seed dataset (`npm run db:seed`).

---

## 5. Reference Documentation
Consult the dedicated specifications in `docs/` for complete architectural and product details:
- **Product Requirements & Journey**: [docs/PRODUCT.md](file:///d:/Vinh/korean/docs/PRODUCT.md)
- **Architecture & Route Map**: [docs/ARCHITECTURE.md](file:///d:/Vinh/korean/docs/ARCHITECTURE.md)
- **Data Model, ERD & Algorithms**: [docs/DATA_MODEL.md](file:///d:/Vinh/korean/docs/DATA_MODEL.md)
- **Local Dev & Seed Specs**: [docs/LOCAL_DEVELOPMENT.md](file:///d:/Vinh/korean/docs/LOCAL_DEVELOPMENT.md)
- **Phased Implementation Roadmap**: [docs/ROADMAP.md](file:///d:/Vinh/korean/docs/ROADMAP.md)
