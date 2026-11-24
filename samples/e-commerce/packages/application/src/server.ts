import { serve } from '@hono/node-server';
import { buildApplication } from './buildApplication';
import { readSettings } from './settings';
import { startTelemetryFor } from './telemetry/telemetry';

const settings = readSettings(process.env);
const telemetry = startTelemetryFor(settings);
const { start, stop, application } = buildApplication(settings, {});

await start();

const server = serve({
  fetch: application.fetch,
  port: Number(process.env.PORT ?? 8080),
});

const shutdown = async () => {
  server.close();
  await stop();
  await telemetry?.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
