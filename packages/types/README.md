# @pixel-studio/types

The shared design domain: the schema of a persisted `DesignDocument` and every
element and style it contains.

The package is **type-only**. It is consumed straight from TypeScript source
(`main` and `types` both point at `src/index.ts`), so there is no build step to
keep in sync and no chance of a stale `dist`. Because every export is a type,
imports are erased at compile time and nothing ships to the browser or the
server.

What belongs here: anything that is part of a saved design.
What does not: editor state (selection, camera, history), runtime factories,
rendering helpers, and interaction logic. Those live in `apps/web`.
