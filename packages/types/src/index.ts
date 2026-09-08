/**
 * `@pixel-studio/types` - the shared design domain.
 *
 * This package holds the schema of a persisted design document and nothing
 * else: no editor state, no runtime helpers, no rendering concerns. It is
 * type-only, so importing it costs nothing at runtime and both the web app and
 * the API can depend on it without pulling in each other's code.
 */

export type * from "./design";
