import { Injectable } from "@nestjs/common";

export interface HealthStatus {
  status: "ok";
  service: string;
}

export const SERVICE_NAME = "pixel-studio-api";

/**
 * Reports that the process is up and able to serve requests. Deliberately does
 * no I/O: dependency checks belong here only once there are dependencies.
 */
@Injectable()
export class HealthService {
  check(): HealthStatus {
    return { status: "ok", service: SERVICE_NAME };
  }
}
