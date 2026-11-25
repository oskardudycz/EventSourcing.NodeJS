import { metrics } from '@opentelemetry/api';
import type { Context, Hono, Next } from 'hono';
import { routePath } from 'hono/route';

export const httpMetrics = (router: Hono) => {
  const duration = metrics
    .getMeter('e-commerce')
    .createHistogram('http.server.request.duration', {
      description: 'How long the application took to answer a request',
      unit: 's',
      advice: {
        explicitBucketBoundaries: [
          0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5,
          10,
        ],
      },
    });

  router.use('*', async (context: Context, next: Next) => {
    const startedAt = performance.now();

    await next();

    duration.record((performance.now() - startedAt) / 1000, {
      'http.request.method': context.req.method,
      'http.route': routePath(context, -1),
      'http.response.status_code': context.res.status,
    });
  });
};
