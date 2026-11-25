import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { startTelemetryFor } from './telemetry';

const collectorReceiving = async (paths: string[]) => {
  const server = createServer((request, response) => {
    paths.push(request.url ?? '');
    request.resume();
    response.writeHead(200).end();
  });
  server.listen(0);
  await once(server, 'listening');

  return server;
};

const portOf = (server: Server) => {
  const address = server.address();

  if (typeof address !== 'object' || address === null)
    throw new Error('The collector has no port');

  return address.port;
};

describe('telemetry', () => {
  const paths: string[] = [];
  let collector: Server | undefined;

  afterEach(() => {
    paths.length = 0;
    collector?.close();
  });

  it('exportsTheMetricsToTheConfiguredOtlpEndpoint', async () => {
    collector = await collectorReceiving(paths);

    await startTelemetryFor({
      otlpEndpoint: `http://localhost:${portOf(collector)}`,
    }).stop();

    expect(paths).toContain('/v1/metrics');
  });
});
