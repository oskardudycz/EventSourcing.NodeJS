import { expectResponse } from '@e-commerce/core';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { afterEach, describe, expect, it } from 'vitest';
import { getCart } from '../shoppingCarts/shoppingCartRequests';
import { testApplication } from '../testApplication';
import { startTelemetry } from './telemetry';

describe('HTTP metrics', () => {
  const application = testApplication();
  let stop: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await stop?.();
    stop = undefined;
  });

  it('aRequestIsTimedWithItsRouteAndStatus', async () => {
    const exporter = new InMemoryMetricExporter(
      AggregationTemporality.CUMULATIVE,
    );
    const reader = new PeriodicExportingMetricReader({
      exporter,
      exportIntervalMillis: 60_000,
    });
    ({ stop } = startTelemetry({ metricReaders: [reader] }));

    await application
      .given()
      .when(getCart(crypto.randomUUID()))
      .then(expectResponse(404), async () => {
        await reader.forceFlush();

        const attributes = exporter
          .getMetrics()
          .flatMap(({ scopeMetrics }) => scopeMetrics)
          .flatMap(({ metrics }) => metrics)
          .filter(
            ({ descriptor }) =>
              descriptor.name === 'http.server.request.duration',
          )
          .flatMap(({ dataPoints }) =>
            dataPoints.map(({ attributes }) => attributes),
          );

        expect(attributes).toContainEqual({
          'http.request.method': 'GET',
          'http.route': '/customers/:customerId/shopping-carts/current',
          'http.response.status_code': 404,
        });
      });
  });
});
