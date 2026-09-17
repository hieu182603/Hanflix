import client from 'prom-client';
import type { Request, Response, NextFunction } from 'express';

const register = new client.Registry();

// Enable default metrics (Node.js runtime, memory, event loop, CPU)
client.collectDefaultMetrics({
  register,
  prefix: 'hanflix_',
});

// Custom HTTP Metrics
export const httpRequestsTotal = new client.Counter({
  name: 'hanflix_http_requests_total',
  help: 'Total number of HTTP requests made to HanFlix API',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'hanflix_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

export const videoJobsProcessedTotal = new client.Counter({
  name: 'hanflix_video_jobs_processed_total',
  help: 'Total number of video processing jobs',
  labelNames: ['status'],
  registers: [register],
});

/**
 * Middleware measuring request duration and counting requests for Prometheus
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime();

  res.on('finish', () => {
    const elapsed = process.hrtime(start);
    const durationInSeconds = elapsed[0] + elapsed[1] / 1e9;

    const route = req.baseUrl || req.path || 'unknown';
    const statusCode = res.statusCode.toString();

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: statusCode,
    });

    httpRequestDurationSeconds.observe(
      {
        method: req.method,
        route,
        status_code: statusCode,
      },
      durationInSeconds
    );
  });

  next();
}

/**
 * Returns serialized Prometheus metrics
 */
export async function getPrometheusMetrics(): Promise<{ contentType: string; metrics: string }> {
  return {
    contentType: register.contentType,
    metrics: await register.metrics(),
  };
}
