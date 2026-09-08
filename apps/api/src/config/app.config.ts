import { registerAs } from "@nestjs/config";

/** Everything the API reads from the environment, in one place. */
export interface AppConfig {
  port: number;
  /**
   * Origins allowed to call the API. Comma-separated in `CORS_ORIGINS`;
   * defaults to the local Next.js dev server.
   */
  corsOrigins: string[];
}

export const DEFAULT_PORT = 3001;
export const DEFAULT_CORS_ORIGIN = "http://localhost:3000";

export const APP_CONFIG_KEY = "app";

function parsePort(value: string | undefined): number {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536
    ? port
    : DEFAULT_PORT;
}

function parseOrigins(value: string | undefined): string[] {
  const origins = (value ?? DEFAULT_CORS_ORIGIN)
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return origins.length > 0 ? origins : [DEFAULT_CORS_ORIGIN];
}

export const appConfig = registerAs(
  APP_CONFIG_KEY,
  (): AppConfig => ({
    port: parsePort(process.env.PORT),
    corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
  }),
);
