import { expectResponse } from '@e-commerce/core';
import { createServer } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addProductItem } from '../shoppingCarts/shoppingCartRequests';
import { testApplication } from '../testApplication';
import { exportingOverOtlp, startTelemetry } from './telemetry';

const closedPort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const address = server.address();
      server.close(() =>
        typeof address === 'object' && address !== null
          ? resolve(address.port)
          : reject(new Error('No port')),
      );
    });
  });

describe('telemetry without an OTLP endpoint', () => {
  const logged: string[] = [];
  let stop: (() => Promise<void>) | undefined;
  beforeEach(async () => {
    logged.length = 0;
    const port = await closedPort();
    ({ stop } = startTelemetry(
      exportingOverOtlp(`http://localhost:${port}`, 100),
    ));
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const)
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logged.push(args.join(' '));
      });
    for (const stream of [process.stdout, process.stderr])
      vi.spyOn(stream, 'write').mockImplementation((chunk: unknown) => {
        logged.push(String(chunk));
        return true;
      });
  });

  afterEach(async () => {
    await stop?.();
    vi.restoreAllMocks();
  });

  it('noOtlpEndpointLogsNoConnectionErrors', () =>
    testApplication()
      .given()
      .when(addProductItem('customer-1', { productId: 'shoes', quantity: 1 }))
      .then(expectResponse(200), async () => {
        await sleep(1500);

        expect(logged).toEqual([]);
      }));
});
