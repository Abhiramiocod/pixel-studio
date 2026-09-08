# Pixel Studio

A pnpm monorepo. Work inside the package that owns the code you are changing.

```
apps/web      @pixel-studio/web    Next.js visual design editor
apps/api      @pixel-studio/api    NestJS API
packages/types @pixel-studio/types Shared design document schema (type-only)
```

## Commands

Run these from the repository root; each one fans out with pnpm filters.

```bash
pnpm install       # install every workspace package
pnpm dev:web       # Next.js on http://localhost:3000
pnpm dev:api       # NestJS on http://localhost:3001
pnpm build         # build every package
pnpm lint          # lint every package
pnpm test          # vitest (web) + jest (api)
pnpm typecheck     # tsc --noEmit everywhere
```

`apps/web` has its own `AGENTS.md` with Next.js-specific guidance; read it before
changing frontend code.

## Boundaries

- Anything that is part of a **saved design** belongs in `packages/types`. It is
  type-only, so it stays free of runtime code and either app can depend on it.
- Editor state (selection, camera, history, interaction) and all rendering,
  geometry and factory code stay in `apps/web`.
- Do not reach across packages with relative paths. `apps/web` imports the shared
  schema as `@pixel-studio/types`.
