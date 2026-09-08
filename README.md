# Pixel Studio

A Canva-style visual design editor, built as a pnpm monorepo.

```
apps/
  web/        Next.js 16 editor - canvas engine, editor state, UI
  api/        NestJS API - health endpoint today, design services later
packages/
  types/      @pixel-studio/types - the shared design document schema
```

## Getting started

```bash
pnpm install
pnpm dev:web   # http://localhost:3000  (editor at /editor)
pnpm dev:api   # http://localhost:3001  (GET /health)
```

Copy the example environment files if you need to change the defaults:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

## Workspace scripts

| Command | What it does |
| --- | --- |
| `pnpm build` | Builds every package |
| `pnpm lint` | Lints every package |
| `pnpm test` | Runs vitest (web) and jest (api) |
| `pnpm typecheck` | `tsc --noEmit` across the workspace |

Add `--filter @pixel-studio/web` (or `api`, `types`) to scope any of them to one
package.

## Packages

**`@pixel-studio/web`** - the editor. A canvas rendering engine, an
operation-based undo/redo system, and a document tree supporting shapes, text,
images, groups and frames.

**`@pixel-studio/api`** - the backend. Currently exposes `GET /health` and is
configured for local CORS against the web app.

**`@pixel-studio/types`** - the design document schema shared by both. Type-only,
consumed directly from TypeScript source, so there is one definition of what a
saved design looks like.
