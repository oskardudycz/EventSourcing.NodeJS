import {
  expectNothingPublished,
  expectPublished,
  expectResponse,
  htmlContaining,
  redirectsTo,
  send,
  Urns,
  type Expectation,
} from '@e-commerce/core';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { OrderId } from '../orders/order';
import { ShoppingCartId } from '../shoppingCarts/shoppingCart';
import { orderStatusIs } from '../orders/orderRequests';
import { soldOutDemoProduct, trailRunningShoes } from '../shop/demoProducts';
import { aCustomer, shopRequests } from '../shop/shopRequests';
import { shopTestApplication } from '../shopTestApplication';
import {
  addProductItem,
  checkOut,
} from '../shoppingCarts/shoppingCartRequests';
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

describe.each(testedMessagingBuses)(
  'shipments API on MESSAGING_BUS=%s',
  (bus: TestedMessagingBus) => {
    const shipments = testApplication({
      messagingBus: bus,
      publishedTypes: shipmentExternalEventTypes,
      modules: ['shipments'],
    });

    const aShipment = () => {
      const now = shipments.clock.now().toISOString();
      const referenceId = OrderId.derivedFrom(
        ShoppingCartId.of(randomUUID(), 1),
      );
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

      return {
        ...shipments.about(shipmentId, referenceId),
        now,
        referenceId,
        shipmentId,
        key,
        shoes,
        shirt,
        products,
        reserveStock,
        requestFulfillment,
        releaseStock,
        reservedStock,
        requestedFulfillment,
        shipmentFailed,
      };
    };

    describe('reserving stock', () => {
      it('allProductsAvailableReservesStockUnderTheIdDerivedFromTheReference', () => {
        const { given, referenceId, shipmentId, key, reserveStock, now } =
          aShipment();

        return given()
          .when(send(reserveStock()))
          .then(
            expectPublished({
              type: 'shipments.external.StockReserved',
              data: { shipmentId, referenceId, reservedAt: now },
              metadata: { key },
            }),
          );
      });

      it('oneProductOutOfStockReservesNothingAndFailsTheShipment', async () => {
        const { given, warehouse, shoes, shirt, reserveStock, shipmentFailed } =
          aShipment();

        await given(warehouse.isOutOf(shirt.productId))
          .when(send(reserveStock([shoes, shirt])))
          .then(expectPublished(shipmentFailed('ProductsOutOfStock')));
      });

      it('reservingStockDoesNotRequestTheFulfillmentYet', async () => {
        const {
          given,
          warehouse,
          referenceId,
          shipmentId,
          key,
          reserveStock,
          now,
        } = aShipment();

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
      });

      it('reservingStockRetriesTheStockCheckUntilTheWarehouseAnswers', async () => {
        const {
          given,
          warehouse,
          logs,
          referenceId,
          shipmentId,
          key,
          shoes,
          reserveStock,
          now,
        } = aShipment();

        await given(warehouse.stockCheckOfFails(shoes.productId, 2))
          .when(send(reserveStock()))
          .then(
            expectPublished({
              type: 'shipments.external.StockReserved',
              data: { shipmentId, referenceId, reservedAt: now },
              metadata: { key },
            }),
            () => {
              expect(warehouse.stockChecksOf(shoes.productId)).toBe(3);
              expect(logs().join('\n')).toContain(
                `Checking the stock for shipment ${shipmentId} failed`,
              );
            },
          );
      });

      it('reservingStockForTheSameReferenceAgainSendsNothingAndAsksTheWarehouseOnce', async () => {
        const { given, warehouse, shoes, reserveStock, reservedStock } =
          aShipment();

        await given(...reservedStock)
          .when(send(reserveStock()))
          .then(expectNothingPublished(), () =>
            expect(warehouse.stockChecksOf(shoes.productId)).toBe(1),
          );
      });
    });

    describe('requesting fulfillment', () => {
      it('aReservedShipmentRequestsFulfillmentFromTheWarehouse', async () => {
        const {
          given,
          warehouse,
          shipmentId,
          products,
          requestFulfillment,
          reservedStock,
        } = aShipment();

        await given(...reservedStock)
          .when(send(requestFulfillment))
          .then(expectNothingPublished(), () =>
            expect(warehouse.requestsFor(shipmentId)).toEqual([products]),
          );
      });

      it('fulfillmentClientLogsWhenTheWarehouseIsUnreachable', async () => {
        const {
          given,
          warehouse,
          logs,
          shipmentId,
          requestFulfillment,
          reservedStock,
        } = aShipment();

        await given(...reservedStock, warehouse.isUnreachableFor(shipmentId))
          .when(send(requestFulfillment))
          .then(expectNothingPublished(), () => {
            expect(warehouse.requestsFor(shipmentId)).toEqual([]);
            expect(logs().join('\n')).toContain(
              `Requesting fulfillment for shipment ${shipmentId} failed`,
            );
          });
      });

      it('requestingFulfillmentAgainAsksTheWarehouseOnlyOnce', async () => {
        const {
          given,
          warehouse,
          shipmentId,
          requestFulfillment,
          requestedFulfillment,
        } = aShipment();

        await given(...requestedFulfillment)
          .when(send(requestFulfillment))
          .then(expectNothingPublished(), () =>
            expect(warehouse.requestsFor(shipmentId)).toHaveLength(1),
          );
      });

      it('requestingFulfillmentWhenAProductWasOutOfStockAsksNobody', async () => {
        const {
          given,
          warehouse,
          shipmentId,
          shoes,
          reserveStock,
          requestFulfillment,
        } = aShipment();

        await given(warehouse.isOutOf(shoes.productId), send(reserveStock()))
          .when(send(requestFulfillment))
          .then(expectNothingPublished(), () =>
            expect(warehouse.requestsFor(shipmentId)).toEqual([]),
          );
      });

      it('requestingFulfillmentWithoutAReservationAsksNobody', async () => {
        const { given, warehouse, shipmentId, requestFulfillment } =
          aShipment();

        await given()
          .when(send(requestFulfillment))
          .then(expectNothingPublished(), () =>
            expect(warehouse.requestsFor(shipmentId)).toEqual([]),
          );
      });
    });

    describe('answers of the warehouse', () => {
      it('aSentPackageIsForwardedWithCarrierAndTracking', async () => {
        const {
          given,
          warehouse,
          referenceId,
          shipmentId,
          key,
          requestedFulfillment,
          now,
        } = aShipment();

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
      });

      it('aRejectedFulfillmentSendsShipmentFailed', async () => {
        const {
          given,
          warehouse,
          shipmentId,
          requestedFulfillment,
          shipmentFailed,
        } = aShipment();

        await given(...requestedFulfillment)
          .when(warehouse.rejectsTheRequest(shipmentId))
          .then(expectPublished(shipmentFailed('FulfillmentRejected')));
      });

      it('aDeliveredPackageSendsNothing', async () => {
        const { given, warehouse, shipmentId, requestedFulfillment } =
          aShipment();

        await given(
          ...requestedFulfillment,
          warehouse.sendsThePackage(shipmentId),
        )
          .when(warehouse.deliversThePackage(shipmentId))
          .then(expectNothingPublished());
      });

      it('aPackageThatWasNotSentCannotBeDeliveredAndSendsNothing', async () => {
        const { given, warehouse, shipmentId, reservedStock } = aShipment();

        await given(...reservedStock)
          .when(warehouse.deliversThePackage(shipmentId))
          .then(expectNothingPublished());
      });
    });

    describe('releasing stock', () => {
      it('releasedStockCannotBeRequestedForFulfillment', async () => {
        const {
          given,
          warehouse,
          shipmentId,
          requestFulfillment,
          releaseStock,
          reservedStock,
        } = aShipment();

        await given(...reservedStock, send(releaseStock))
          .when(send(requestFulfillment))
          .then(expectNothingPublished(), () =>
            expect(warehouse.requestsFor(shipmentId)).toEqual([]),
          );
      });

      it('stockOfASentPackageIsNotReleased', async () => {
        const {
          given,
          warehouse,
          shipmentId,
          releaseStock,
          requestedFulfillment,
        } = aShipment();

        await given(
          ...requestedFulfillment,
          warehouse.sendsThePackage(shipmentId),
        )
          .when(send(releaseStock))
          .then(expectNothingPublished());
      });
    });
  },
);

describe('warehouse sandbox page', () => {
  const warehousePage = '/sandbox/warehouse';

  const warehouseOnly = shopTestApplication({ modules: ['shipments'] });
  const demoStock = shopTestApplication({
    modules: ['shipments'],
    restartsForEachTest: true,
  });
  const withOrders = shopTestApplication({
    modules: ['shopping_carts', 'orders', 'shipments'],
    restartsForEachTest: true,
  });

  const shop = (application = warehouseOnly) => {
    const requests = shopRequests(application.fetch);
    const referenceId = OrderId.derivedFrom(ShoppingCartId.of(randomUUID(), 1));
    const shipmentId = ShipmentId.derivedFrom(referenceId);
    const rowOf = (body: string) =>
      body
        .split('<tr>')
        .find((row) =>
          row.includes(`title="${ShipmentId.tailOf(shipmentId)}"`),
        ) ?? '';
    const shipmentRowContaining =
      (...texts: string[]): Expectation =>
      ({ response }) => {
        for (const text of texts)
          expect(rowOf(response?.body ?? '')).toContain(text);
      };
    const shipmentRowNotContaining =
      (...texts: string[]): Expectation =>
      ({ response }) => {
        for (const text of texts)
          expect(rowOf(response?.body ?? '')).not.toContain(text);
      };
    const button = (what: string) =>
      requests.postForm(
        `${warehousePage}/shipments/${ShipmentId.tailOf(shipmentId)}/${what}`,
      );
    const stock = (productId: string, inStock: boolean) =>
      requests.postForm(`${warehousePage}/products/${productId}/stock`, {
        inStock: String(inStock),
      });
    const requestedFulfillment = [
      send({
        type: 'shipments.ReserveStock',
        data: {
          referenceId,
          productItems: [{ productId: trailRunningShoes.id, quantity: 1 }],
        },
      }),
      send({
        type: 'shipments.RequestFulfillment',
        data: { shipmentId },
      }),
    ];

    return {
      ...application,
      ...requests,
      shipmentRowContaining,
      shipmentRowNotContaining,
      requestedFulfillment,
      page: requests.getPage(warehousePage),
      button,
      stock,
    };
  };

  const countsOf =
    (text: string, count: number): Expectation =>
    ({ response }) =>
      expect((response?.body ?? '').split(text).length - 1).toBe(count);

  it('aRequestedPackageWaitsForTheWarehouse', () => {
    const { given, requestedFulfillment, page, shipmentRowContaining } = shop();

    return given(...requestedFulfillment)
      .when(page)
      .then(shipmentRowContaining('Waiting', 'Send', 'Reject'));
  });

  it('sendingAPackageRedirectsToTheWarehouse', () => {
    const { given, requestedFulfillment, button } = shop();

    return given(...requestedFulfillment)
      .when(button('send'))
      .then(expectResponse(303), redirectsTo(warehousePage));
  });

  it('aSentPackageCanBeDelivered', () => {
    const {
      given,
      requestedFulfillment,
      button,
      page,
      shipmentRowContaining,
      shipmentRowNotContaining,
    } = shop();

    return given(...requestedFulfillment, button('send'), button('deliver'))
      .when(page)
      .then(
        shipmentRowContaining('Delivered'),
        shipmentRowNotContaining('Waiting'),
      );
  });

  it('aRejectedPackageIsMarkedRejected', () => {
    const {
      given,
      requestedFulfillment,
      button,
      page,
      shipmentRowContaining,
      shipmentRowNotContaining,
    } = shop();

    return given(...requestedFulfillment, button('reject'))
      .when(page)
      .then(
        shipmentRowContaining('Rejected'),
        shipmentRowNotContaining('Waiting'),
      );
  });

  it('aPackageThatWasNotSentCannotBeDelivered', () => {
    const {
      given,
      requestedFulfillment,
      button,
      page,
      shipmentRowContaining,
      shipmentRowNotContaining,
    } = shop();

    return given(...requestedFulfillment, button('deliver'))
      .when(page)
      .then(
        shipmentRowContaining('Waiting'),
        shipmentRowNotContaining('Delivered'),
      );
  });

  it('aSentPackageCannotBeRejected', () => {
    const {
      given,
      requestedFulfillment,
      button,
      page,
      shipmentRowContaining,
      shipmentRowNotContaining,
    } = shop();

    return given(...requestedFulfillment, button('send'), button('reject'))
      .when(page)
      .then(
        shipmentRowContaining('Sent'),
        shipmentRowNotContaining('Rejected'),
      );
  });

  it('aShipmentTheWarehouseWasNeverAskedAboutIsNotFound', () => {
    const { given, button } = shop();

    return given().when(button('send')).then(expectResponse(404));
  });

  it('theSoldOutDemoProductIsOutOfStockFromTheStart', () => {
    const { given, page } = shop(demoStock);

    return given()
      .when(page)
      .then(
        htmlContaining(soldOutDemoProduct.name),
        countsOf('>Out of stock<', 1),
        countsOf('>In stock<', 4),
      );
  });

  it('markingAProductOutOfStockShowsItAsOutOfStock', () => {
    const { given, stock, page } = shop(demoStock);

    return given(stock(trailRunningShoes.id, false))
      .when(page)
      .then(countsOf('>Out of stock<', 2), countsOf('>In stock<', 3));
  });

  it('restockingAProductShowsItAsInStock', () => {
    const { given, stock, page } = shop(demoStock);

    return given(stock(soldOutDemoProduct.id, true))
      .when(page)
      .then(countsOf('>Out of stock<', 0), countsOf('>In stock<', 5));
  });

  it('markingAProductOutOfStockRedirectsToTheWarehouse', () => {
    const { given, stock } = shop(demoStock);

    return given()
      .when(stock(trailRunningShoes.id, false))
      .then(expectResponse(303), redirectsTo(warehousePage));
  });

  it('markingAProductOutOfStockFailsTheReservationOfLaterOrders', () => {
    const { given, stock, fetch } = shop(withOrders);
    const customer = aCustomer();
    const orderNumber = OrderId.numberOf(
      OrderId.derivedFrom(ShoppingCartId.of(customer.id, 1)),
    );

    return given(
      stock(trailRunningShoes.id, false),
      addProductItem(customer.id, {
        productId: trailRunningShoes.id,
        quantity: 1,
      }),
    )
      .when(checkOut(customer.id, 'W/"1"'))
      .then(
        expectResponse(202),
        orderStatusIs(fetch, customer.id, orderNumber, {
          progress: 'OutOfStock',
        }),
      );
  });

  it('restockingAProductLetsLaterOrdersReserveIt', () => {
    const { given, stock, fetch } = shop(withOrders);
    const customer = aCustomer();
    const orderNumber = OrderId.numberOf(
      OrderId.derivedFrom(ShoppingCartId.of(customer.id, 1)),
    );

    return given(
      stock(soldOutDemoProduct.id, true),
      addProductItem(customer.id, {
        productId: soldOutDemoProduct.id,
        quantity: 1,
      }),
    )
      .when(checkOut(customer.id, 'W/"1"'))
      .then(
        expectResponse(202),
        orderStatusIs(fetch, customer.id, orderNumber, {
          progress: 'AwaitingPayment',
        }),
      );
  });
});
