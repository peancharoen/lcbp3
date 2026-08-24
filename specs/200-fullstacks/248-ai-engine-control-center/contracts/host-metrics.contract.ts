// File: specs/200-fullstacks/248-ai-engine-control-center/contracts/host-metrics.contract.ts

/**
 * GET /ai/admin/host/metrics
 * Header: Authorization: Bearer <token>
 * Permission: system.manage_all
 */

export interface GetHostMetricsResponse {
  success: boolean;
  data: {
    timestamp: string;
    cpu: {
      overallPercentage: number;
      coreCount: number;
      perCorePercentage: number[];
    };
    memory: {
      totalBytes: number;
      usedBytes: number;
      availableBytes: number;
      usedPercentage: number;
    };
    temperature: {
      cpuCelsius: number | null;
      sensorName: string | null;
    };
    isEstimated: boolean;
    history: Array<{
      timestamp: string;
      cpuPercentage: number;
      memoryPercentage: number;
      temperatureCelsius: number | null;
    }>;
  };
}
