import { expectResponse } from '@e-commerce/core';
import { diag, DiagLogLevel } from '@opentelemetry/api';
import { createServer } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
  const application = testApplication();
  const diagnostics: string[] = [];
  let stop: (() => Promise<void>) | undefined;

  beforeEach(async () => {
    diagnostics.length = 0;
    const record = (...messages: unknown[]) => {
      diagnostics.push(messages.map(String).join(' '));
    };
    diag.setLogger(
      {
        error: record,
        warn: record,
        info: record,
        debug: record,
        verbose: record,
      },
      DiagLogLevel.WARN,
    );
    ({ stop } = startTelemetry(
      exportingOverOtlp(`http://localhost:${await closedPort()}`, 600_000),
    ));
  });

  afterEach(async () => {
    await stop?.();
    diag.disable();
  });

  it('noOtlpEndpointLogsNoConnectionErrors', () =>
    application
      .given()
      .when(
        addProductItem(crypto.randomUUID(), {
          productId: crypto.randomUUID(),
          quantity: 1,
        }),
      )
      .then(expectResponse(200), () => {
        expect(diagnostics).toEqual([]);
      }));
});
