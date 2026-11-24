import {
  expectNothingPublished,
  expectPublished,
  send,
  Urns,
} from '@e-commerce/core';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { OrderId } from '../orders/order';
import { ShoppingCartId } from '../shoppingCarts/shoppingCart';
import { failsOnEmmett } from '../knownFailures';
import {
  testedMessagingBuses,
  testApplication,
  type TestedMessagingBus,
} from '../testApplication';
import { shipmentExternalEventTypes } from './external/shipmentExternalEvent';
import { ShipmentId } from './shipment';
import type {
  ReleaseStock,
  RequestFulfillment,
  ReserveStock,
} from './shipmentCommand';
import { carrier, trackingNumber } from './warehouse';

const now = '2026-01-01T10:00:00.000Z';

describe.each(testedMessagingBuses)(
  'shipments API on MESSAGING_BUS=%s',
  (bus: TestedMessagingBus) => {
    const shipmentsApplication = (signal?: AbortSignal) =>
      testApplication({
        messagingBus: bus,
        publishedTypes: shipmentExternalEventTypes,
        modules: ['shipments'],
        signal,
      });

    const referenceId = OrderId.derivedFrom(ShoppingCartId.of(randomUUID(), 1));
    const shipmentId = ShipmentId.derivedFrom(referenceId);
    const key = Urns.routingKeyOf(referenceId);
    const shoes = { productId: randomUUID(), quantity: 2 };
    const shirt = { productId: randomUUID(), quantity: 1 };
    const products = [shoes];

    const reserveStock = (productItems = products): ReserveStock => ({
      type: 'shipments.ReserveStock',
      data: { referenceId, productItems },
    });
    const requestFulfillment: RequestFulfillment = {
      type: 'shipments.RequestFulfillment',
      data: { shipmentId },
    };
    const releaseStock: ReleaseStock = {
      type: 'shipments.ReleaseStock',
      data: { shipmentId },
    };

    const reservedStock = [send(reserveStock())];
    const requestedFulfillment = [...reservedStock, send(requestFulfillment)];

    const shipmentFailed = (
      reason: 'ProductsOutOfStock' | 'FulfillmentRejected',
    ) => ({
      type: 'shipments.external.ShipmentFailed' as const,
      data: { shipmentId, referenceId, reason, failedAt: now },
      metadata: { key },
    });

    describe('reserving stock', () => {
      failsOnEmmett('#432')(
        'allProductsAvailableReservesStockUnderTheIdDerivedFromTheReference',
        (signal) =>
          shipmentsApplication(signal)
            .given()
            .when(send(reserveStock()))
            .then(
              expectPublished({
                type: 'shipments.external.StockReserved',
                data: { shipmentId, referenceId, reservedAt: now },
                metadata: { key },
              }),
            ),
      );

      failsOnEmmett('#432')(
        'oneProductOutOfStockReservesNothingAndFailsTheShipment',
        async (signal) => {
          const { given, warehouse } = shipmentsApplication(signal);

          await given(warehouse.isOutOf(shirt.productId))
            .when(send(reserveStock([shoes, shirt])))
            .then(expectPublished(shipmentFailed('ProductsOutOfStock')));
        },
      );

      failsOnEmmett('#432')(
        'reservingStockDoesNotRequestTheFulfillmentYet',
        async (signal) => {
          const { given, warehouse } = shipmentsApplication(signal);

          await given()
            .when(send(reserveStock()))
            .then(
              expectPublished({
                type: 'shipments.external.StockReserved',
                data: { shipmentId, referenceId, reservedAt: now },
                metadata: { key },
              }),
              () => expect(warehouse.requestsFor(shipmentId)).toEqual([]),
            );
        },
      );

      failsOnEmmett('#432')(
        'reservingStockRetriesTheStockCheckUntilTheWarehouseAnswers',
        async (signal) => {
          const { given, warehouse, logs } = shipmentsApplication(signal);

          await given(warehouse.stockCheckFails(2))
            .when(send(reserveStock()))
            .then(
              expectPublished({
                type: 'shipments.external.StockReserved',
                data: { shipmentId, referenceId, reservedAt: now },
                metadata: { key },
              }),
              () => {
                expect(warehouse.stockChecks()).toBe(3);
                expect(logs().join('\n')).toContain(
                  `Checking the stock for shipment ${shipmentId} failed`,
                );
              },
            );
        },
      );

      failsOnEmmett('#432')(
        'reservingStockForTheSameReferenceAgainSendsNothingAndAsksTheWarehouseOnce',
        async (signal) => {
          const { given, warehouse } = shipmentsApplication(signal);

          await given(...reservedStock)
            .when(send(reserveStock()))
            .then(expectNothingPublished(), () =>
              expect(warehouse.stockChecks()).toBe(products.length),
            );
        },
      );
    });

    describe('requesting fulfillment', () => {
      failsOnEmmett('#432')(
        'aReservedShipmentRequestsFulfillmentFromTheWarehouse',
        async (signal) => {
          const { given, warehouse } = shipmentsApplication(signal);

          await given(...reservedStock)
            .when(send(requestFulfillment))
            .then(expectNothingPublished(), () =>
              expect(warehouse.requestsFor(shipmentId)).toEqual([products]),
            );
        },
      );

      failsOnEmmett('#432')(
        'fulfillmentClientLogsWhenTheWarehouseIsUnreachable',
        async (signal) => {
          const { given, warehouse, logs } = shipmentsApplication(signal);

          await given(...reservedStock, warehouse.isUnreachableFor(shipmentId))
            .when(send(requestFulfillment))
            .then(expectNothingPublished(), () => {
              expect(warehouse.requestsFor(shipmentId)).toEqual([]);
              expect(logs().join('\n')).toContain(
                `Requesting fulfillment for shipment ${shipmentId} failed`,
              );
            });
        },
      );

      failsOnEmmett('#432')(
        'requestingFulfillmentAgainAsksTheWarehouseOnlyOnce',
        async (signal) => {
          const { given, warehouse } = shipmentsApplication(signal);

          await given(...requestedFulfillment)
            .when(send(requestFulfillment))
            .then(expectNothingPublished(), () =>
              expect(warehouse.requestsFor(shipmentId)).toHaveLength(1),
            );
        },
      );

      failsOnEmmett('#432')(
        'requestingFulfillmentWhenAProductWasOutOfStockAsksNobody',
        async (signal) => {
          const { given, warehouse } = shipmentsApplication(signal);

          await given(warehouse.isOutOf(shoes.productId), send(reserveStock()))
            .when(send(requestFulfillment))
            .then(expectNothingPublished(), () =>
              expect(warehouse.requestsFor(shipmentId)).toEqual([]),
            );
        },
      );

      it('requestingFulfillmentWithoutAReservationAsksNobody', async ({
        signal,
      }) => {
        const { given, warehouse } = shipmentsApplication(signal);

        await given()
          .when(send(requestFulfillment))
          .then(expectNothingPublished(), () =>
            expect(warehouse.requestsFor(shipmentId)).toEqual([]),
          );
      });
    });

    describe('answers of the warehouse', () => {
      failsOnEmmett('#432')(
        'aSentPackageIsForwardedWithCarrierAndTracking',
        async (signal) => {
          const { given, warehouse } = shipmentsApplication(signal);

          await given(...requestedFulfillment)
            .when(warehouse.sendsThePackage(shipmentId))
            .then(
              expectPublished({
                type: 'shipments.external.PackageWasSent',
                data: {
                  shipmentId,
                  referenceId,
                  carrier,
                  trackingNumber,
                  sentAt: now,
                },
                metadata: { key },
              }),
            );
        },
      );

      failsOnEmmett('#432')(
        'aRejectedFulfillmentSendsShipmentFailed',
        async (signal) => {
          const { given, warehouse } = shipmentsApplication(signal);

          await given(...requestedFulfillment)
            .when(warehouse.rejectsTheRequest(shipmentId))
            .then(expectPublished(shipmentFailed('FulfillmentRejected')));
        },
      );

      failsOnEmmett('#432')('aDeliveredPackageSendsNothing', async (signal) => {
        const { given, warehouse } = shipmentsApplication(signal);

        await given(
          ...requestedFulfillment,
          warehouse.sendsThePackage(shipmentId),
        )
          .when(warehouse.deliversThePackage(shipmentId))
          .then(expectNothingPublished());
      });

      failsOnEmmett('#432')(
        'aPackageThatWasNotSentCannotBeDeliveredAndSendsNothing',
        async (signal) => {
          const { given, warehouse } = shipmentsApplication(signal);

          await given(...reservedStock)
            .when(warehouse.deliversThePackage(shipmentId))
            .then(expectNothingPublished());
        },
      );
    });

    describe('releasing stock', () => {
      failsOnEmmett('#432')(
        'releasedStockCannotBeRequestedForFulfillment',
        async (signal) => {
          const { given, warehouse } = shipmentsApplication(signal);

          await given(...reservedStock, send(releaseStock))
            .when(send(requestFulfillment))
            .then(expectNothingPublished(), () =>
              expect(warehouse.requestsFor(shipmentId)).toEqual([]),
            );
        },
      );

      failsOnEmmett('#432')(
        'stockOfASentPackageIsNotReleased',
        async (signal) => {
          const { given, warehouse } = shipmentsApplication(signal);

          await given(
            ...requestedFulfillment,
            warehouse.sendsThePackage(shipmentId),
          )
            .when(send(releaseStock))
            .then(expectNothingPublished());
        },
      );
    });
  },
);
