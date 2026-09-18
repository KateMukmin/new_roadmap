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

## 3. Create the database tables (only needed for local dev)

```bash
npx prisma migrate deploy
```

This applies the migration already included in `prisma/migrations/` to your
database, creating the `Setting`, `Theme`, `Item`, and `ThemeItem` tables.
You only need to run this yourself for local development, on Vercel this
happens automatically (see step 6).

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
4. Deploy. The `build` script runs `prisma migrate deploy` before building
   the app, so the database tables get created (or updated) automatically
   on every deploy, using whatever migrations exist in `prisma/migrations/`.
   You never need to run a migration by hand for a normal deploy.

## Importing and exporting data

Both are built into the app's UI (top right, in Edit mode):
- **Export data** downloads a JSON file with the current title, themes, and
  items (including phases and theme tags).
- **Import data** takes that same JSON shape (from this app's own Export,
  or from the earlier browser-only prototype's Export) and adds it on top
  of whatever's already there. It does not de-duplicate, importing the
  same file twice creates two copies of everything, so only import a given
  file once.

## Making future schema changes

If the data model ever changes (a new field, a new table), that needs a new
migration file added to `prisma/migrations/`, generated with
`npx prisma migrate dev --name <something>` against a database you're okay
running it against (or ask me to do this for you). Once that migration is
committed and pushed, the next Vercel deploy applies it automatically, same
as the initial one.

## How the data is modeled

- **Setting** — the roadmap's title (singleton row).
- **Theme** — a tag/section (name, color, position for tab order).
- **Item** — a roadmap entry (title, description, status, target date).
- **ThemeItem** — the join table connecting items to themes; it also stores
  a `position` so each theme can have its own manual item order (used when
  sorting by Status).
- **Phase** — an optional step within one item (label, its own target date,
  position), for a feature that's really several dated steps under one
  status (e.g. "Drug Testing" split into Phase 1/2/3 + Billing).

## Views

Besides the themed roadmap list, there's a view switcher for:
- **Gantt** — a timeline: each dated item (or each of its phases) plotted
  against a quarter axis. Items with no date aren't shown, since there's
  nothing to plot.
- **By theme** — a pie chart of item counts per theme (an item tagged to
  several themes counts toward each).
- **By date** — a pie chart grouping items by target-date quarter, with
  "No target date" as its own slice.

These use `chart.js` (an npm dependency, already in `package.json`) for the
pie charts, and a hand-built SVG for the Gantt/timeline.

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
