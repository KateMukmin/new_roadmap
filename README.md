# New Roadmap

A stakeholder-facing product roadmap: themes work as tags (one item can belong
to several), each theme is its own tab, items sort by status/title/delivery
date, and a Present mode hides all the editing controls for screen-sharing.

Built with Next.js (App Router) and Prisma, meant to run on Vercel with a
Prisma Postgres database.

## 1. Install dependencies

```bash
npm install
```

## 2. Connect the database

In your Vercel project dashboard: **Storage → Create Database → Prisma Postgres**
(or add the Prisma Postgres integration from the Vercel marketplace). Vercel
will generate connection strings for you.

Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `DIRECT_URL` with
the values Vercel gives you (the pooled connection string goes in
`DATABASE_URL`, the direct/non-pooled one in `DIRECT_URL`). If the names
Vercel shows you differ slightly (e.g. `POSTGRES_PRISMA_URL`), just map them
to these two variables.

```bash
cp .env.example .env
```

## 3. Create the database tables

```bash
npx prisma migrate dev --name init
```

This reads `prisma/schema.prisma` and creates the `Setting`, `Theme`, `Item`,
and `ThemeItem` tables in your database.

## 4. Run it locally

```bash
npm run dev
```

Open http://localhost:3000. It starts empty, add a theme, then add items to it.

## 5. Set the passcode

The whole site sits behind a simple passcode gate (middleware.js). In your
Vercel project settings, add an environment variable:

```
SITE_PASSCODE=whatever-you-want
```

Anyone visiting any page gets redirected to `/enter-passcode` until they
type the matching value; it's then remembered in their browser for 30 days.
This is a lightweight gate for keeping casual visitors out, not
enterprise-grade auth, the passcode itself is stored in a cookie in the
visitor's browser rather than hashed. That's a reasonable trade-off for an
internal stakeholder roadmap; say the word if you'd rather have something
stronger (e.g. real login).

Set the same variable in your local `.env` if you want to test the gate
locally too; leave it blank/unset locally and the site stays open.

## 6. Deploy to Vercel

1. Push this project to a GitHub repo.
2. Import the repo in Vercel.
3. In the Vercel project settings, make sure the Prisma Postgres integration
   is attached (this sets the `DATABASE_URL` / `DIRECT_URL` env vars in
   production automatically).
4. Deploy. Vercel runs `npm run build`, which runs `prisma generate` via the
   `postinstall` script.

If this is a brand-new production database, run the migration against it once
(Vercel won't do this for you automatically):

```bash
npx prisma migrate deploy
```

You can run that from your machine with `DATABASE_URL`/`DIRECT_URL` pointed
at the production database, or via `vercel env pull` first to grab them.

## Bringing over your test data

If you were testing the earlier browser-only version and used its "Export
data" button, you have a JSON file with your themes and items. This project
doesn't include an importer (schemas differ enough — cuid-based theme/item
ids, a join table for tags — that a straight JSON import isn't a great fit),
so the simplest path is to re-create that handful of items directly in the
running app once it's deployed. If you'd rather script the import, the JSON
shape is: `{ title, themes: [{name, color}], items: [{title, description,
status, when, themeIds: [themeName,...]}] }` — happy to write a one-off
import script if you want to hand me that export file.

## How the data is modeled

- **Theme** — a tag/section (name, color, position for tab order).
- **Item** — a roadmap entry (title, description, status, target date).
- **ThemeItem** — the join table connecting items to themes; it also stores
  a `position` so each theme can have its own manual item order (used when
  sorting by Status).

## Project structure

```
prisma/schema.prisma     Database schema
lib/prisma.js            Prisma client
lib/data.js              Fetches roadmap data for the page
lib/actions.js           Server Actions — every create/update/delete/reorder
lib/auth.js              Passcode check (Server Action)
lib/roadmapUtils.js      Sorting helpers shared by the UI
middleware.js            Passcode gate — redirects unauthenticated visitors
app/page.js              Loads data, renders <RoadmapApp>
app/layout.js            Root HTML layout
app/globals.css          All styling
app/enter-passcode/page.js  Passcode entry screen
components/RoadmapApp.jsx The interactive UI (tabs, sort, modals, present mode)
```
