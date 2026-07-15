# MK Study Plan

A self-contained study-plan demo app: students sign in, review their degree
checklist (categories, groups, courses, grades, credit progress), browse the
term's class schedule, and build a next-term timetable with automatic conflict
detection and course recommendations.

**Everything runs on local data.** Unlike the original project this was cloned
from, nothing is scraped or fetched from any university system — accounts,
checklists, and the class schedule are all seeded into a local MariaDB
database, which makes it ideal for offline demos and presentations.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, standalone output) + React 19
- [Tailwind CSS 4](https://tailwindcss.com)
- [Drizzle ORM](https://orm.drizzle.team) on [MariaDB 11](https://mariadb.org) (via `mysql2`)
- Signed HMAC session cookies (Edge-safe), scrypt password hashing — no auth dependencies
- Docker + Docker Compose

## Quick start (Docker)

```bash
docker compose up --build
```

Then open <http://localhost:3000>. The app container applies migrations and
seeds the demo data automatically on boot.

**Demo account:** `demo.student` / `demo1234`

## Local development

```bash
# 1. Start only the database
docker compose up db -d

# 2. Configure the environment
cp .env.example .env

# 3. Install, migrate, seed
npm install
npm run db:migrate
npm run db:seed

# 4. Run the dev server
npm run dev
```

Open <http://localhost:3000> and sign in with the demo account above.

## Scripts

| Script                | What it does                                        |
| --------------------- | --------------------------------------------------- |
| `npm run dev`         | Next.js dev server                                  |
| `npm run build`       | Production build (standalone)                       |
| `npm run db:generate` | Generate SQL migrations from `src/db/schema.ts`     |
| `npm run db:migrate`  | Apply migrations (`scripts/migrate.mjs`)            |
| `npm run db:seed`     | Seed demo student + schedule (`scripts/seed.mjs`)   |
| `npm run db:studio`   | Drizzle Studio database browser                     |

## How it works

- **Auth** — `POST /api/auth/login` checks the username against the `students`
  table and verifies the scrypt password hash. On success it sets an
  HMAC-SHA256-signed session cookie; `src/proxy.ts` gates `/dashboard/*` on the
  Edge runtime using Web Crypto only.
- **Study Plan** (`/dashboard`) — `src/lib/checklist.ts` rebuilds the
  category → group → course hierarchy from `checklist_categories` /
  `checklist_courses`, with per-group credit progress bars and course search.
- **Class schedule** (`/dashboard/schedule`) — browses the seeded
  `class_schedule` table by day, filterable by course, room, or section.
- **Plan next term** (`/dashboard/plan`) — groups schedule slots into sections,
  recommends still-needed courses that are offered this term
  (`src/lib/recommendations.ts`), and lays the picked sections out on a weekly
  timetable grid with time-conflict and duplicate-course detection. The plan
  persists in `localStorage`.

## Configuration

| Variable       | Default                                      | Purpose                    |
| -------------- | -------------------------------------------- | -------------------------- |
| `DATABASE_URL` | `mysql://mk:mkpassword@127.0.0.1:3306/mkproject` | MariaDB connection string  |
| `SECRET_KEY`   | — (required)                                 | HMAC key for session cookies |

## Demo data

`scripts/seed.mjs` creates one demo student (year-3 Computer Science) whose
checklist exercises every UI state: passed courses, an `F` retake, a `W`
withdrawal, and untaken courses — several of which are offered in the seeded
"First Semester 2026" schedule, so the recommendation chips appear on the plan
page. Edit the constants at the top of that file to change accounts or data;
re-running the seed is safe.
