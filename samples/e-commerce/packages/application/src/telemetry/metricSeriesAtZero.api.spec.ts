import { expectResponse } from '@e-commerce/core';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { afterEach, describe, expect, it } from 'vitest';
import {
  orderEventTypes,
  orderWorkflowCommandTypes,
} from '../orders/orderWorkflow';
import { paymentCommandTypes } from '../payments/paymentCommand';
import { paymentEventTypes } from '../payments/paymentWorkflow';
import { shipmentCommandTypes } from '../shipments/shipmentCommand';
import { shipmentEventTypes } from '../shipments/shipmentWorkflow';
import { getCart } from '../shoppingCarts/shoppingCartRequests';
import { testApplication } from '../testApplication';
import { startTelemetry } from './telemetry';

const shoppingCartEventTypes = [
  'shopping_carts.ProductItemAddedToShoppingCart',
  'shopping_carts.ProductItemRemovedFromShoppingCart',
  'shopping_carts.ProductItemPriceChanged',
  'shopping_carts.ShoppingCartCheckedOut',
];
const shoppingCartCommandTypes = [
  'shopping_carts.AddProductItemToShoppingCart',
  'shopping_carts.RemoveProductItemFromShoppingCart',
  'shopping_carts.CheckOutShoppingCart',
];

describe('telemetry of a started application', () => {
  const application = testApplication({
    modules: ['shopping_carts', 'orders', 'payments', 'shipments'],
  });
  let stop: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await stop?.();
    stop = undefined;
  });

  it('emmettCountersStartAtZeroForEveryCommandAndEventTypeOfEveryModule', async () => {
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

        const points = (name: string, attribute: string) =>
          exporter
            .getMetrics()
            .flatMap(({ scopeMetrics }) => scopeMetrics)
            .flatMap(({ metrics }) => metrics)
            .filter(({ descriptor }) => descriptor.name === name)
            .flatMap(({ dataPoints }) =>
              dataPoints.map(({ attributes, value }) => ({
                type: attributes[attribute],
                status: attributes['emmett.command.status'],
                value,
              })),
            );
        const events = points(
          'emmett.event.appending.count',
          'emmett.event.type',
        );
        const commands = points(
          'emmett.command.handling.count',
          'emmett.command.type',
        );

        expect(events.every(({ value }) => value === 0)).toBe(true);
        expect(events.map(({ type }) => type)).toEqual(
          expect.arrayContaining([
            ...shoppingCartEventTypes,
            ...orderEventTypes,
            ...paymentEventTypes,
            ...shipmentEventTypes,
          ]),
        );
        expect(commands.every(({ value }) => value === 0)).toBe(true);

        for (const type of [
          ...shoppingCartCommandTypes,
          ...orderWorkflowCommandTypes,
          ...paymentCommandTypes,
          ...shipmentCommandTypes,
        ])
          expect(
            commands
              .filter((point) => point.type === type)
              .map(({ status }) => status)
              .sort(),
          ).toEqual(['failure', 'success']);
      });
  });
});
