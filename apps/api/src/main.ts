import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import {
  APP_CONFIG_KEY,
  DEFAULT_CORS_ORIGIN,
  DEFAULT_PORT,
  type AppConfig,
} from "./config/app.config";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService).get<AppConfig>(APP_CONFIG_KEY);

  const port = config?.port ?? DEFAULT_PORT;
  const origins = config?.corsOrigins ?? [DEFAULT_CORS_ORIGIN];

  // Local development only: the web app runs on a different port, so it needs
  // an explicit allow-list. Tighten this per environment when deploying.
  app.enableCors({ origin: origins, credentials: true });

  await app.listen(port);
  Logger.log(
    `Pixel Studio API listening on http://localhost:${port} (CORS: ${origins.join(", ")})`,
    "Bootstrap",
  );
}

void bootstrap();
