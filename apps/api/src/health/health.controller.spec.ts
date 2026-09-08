import { Test, type TestingModule } from "@nestjs/testing";

import { HealthController } from "./health.controller";
import { HealthService, SERVICE_NAME } from "./health.service";

describe("HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    controller = module.get(HealthController);
  });

  it("is wired up", () => {
    expect(controller).toBeDefined();
  });

  it("reports the service as healthy", () => {
    expect(controller.check()).toEqual({
      status: "ok",
      service: SERVICE_NAME,
    });
  });
});
