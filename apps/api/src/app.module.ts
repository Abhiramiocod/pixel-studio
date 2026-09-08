import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { appConfig } from "./config/app.config";
import { HealthModule } from "./health/health.module";

/**
 * The API root. Feature modules are registered here; each one owns its own
 * controllers and providers so modules stay independently testable.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig],
    }),
    HealthModule,
  ],
})
export class AppModule {}
