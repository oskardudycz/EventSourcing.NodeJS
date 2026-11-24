import { WorkflowSpecification } from '@event-driven-io/emmett';
import { describe, it } from 'vitest';
import { OrderId } from '../orders/order';
import { ShoppingCartId } from '../shoppingCarts/shoppingCart';
import { ShipmentId, type ShipmentEvent } from './shipment';
import { shipmentWorkflow } from './shipmentWorkflow';

const referenceId = OrderId.derivedFrom(ShoppingCartId.of('customer-1', 1));
const shipmentId = ShipmentId.derivedFrom(referenceId);
const productItems = [{ productId: 'shoes', quantity: 2 }];
const now = new Date(Date.UTC(2026, 0, 1, 10)).toISOString();

const given = WorkflowSpecification.for(shipmentWorkflow(() => new Date(now)));

const stockCheckRequested: ShipmentEvent = {
  type: 'shipments.StockCheckRequested',
  data: { shipmentId, referenceId, productItems, requestedAt: now },
};
const reserved: ShipmentEvent = {
  type: 'shipments.StockReserved',
  data: { shipmentId, referenceId, productItems, reservedAt: now },
};
const wasOutOfStock: ShipmentEvent = {
  type: 'shipments.ProductWasOutOfStock',
  data: { shipmentId, referenceId, productItems, availabilityCheckedAt: now },
};
const fulfillmentRequested: ShipmentEvent = {
  type: 'shipments.FulfillmentRequested',
  data: { shipmentId, productItems, requestedAt: now },
};
const fulfillmentRejected: ShipmentEvent = {
  type: 'shipments.FulfillmentRejected',
  data: { shipmentId, rejectedAt: now },
};
const packageSent: ShipmentEvent = {
  type: 'shipments.PackageWasSent',
  data: { shipmentId, carrier: 'UPS', trackingNumber: '1Z999', sentAt: now },
};
const stockReleased: ShipmentEvent = {
  type: 'shipments.StockReleased',
  data: { shipmentId, releasedAt: now },
};

describe('shipment workflow', () => {
  it('reservingStockAsksTheWarehouseUnderTheDerivedId', () =>
    given([])
      .when({
        type: 'shipments.ReserveStock',
        data: { referenceId, productItems },
      })
      .then([stockCheckRequested]));

  it('aRedeliveredReserveStockDoesNotAskTheWarehouseAgain', () =>
    given([stockCheckRequested])
      .when({
        type: 'shipments.ReserveStock',
        data: { referenceId, productItems },
      })
      .thenNothingHappened());

  it('reservingAgainAfterTheAnswerDecidesNothing', () =>
    given([stockCheckRequested, reserved])
      .when({
        type: 'shipments.ReserveStock',
        data: { referenceId, productItems },
      })
      .thenNothingHappened());

  it('allProductsAvailableReservesTheStock', () =>
    given([stockCheckRequested])
      .when({
        type: 'shipments.ConfirmStockAvailability',
        data: { shipmentId, productsAvailable: true },
      })
      .then([reserved]));

  it('aProductOutOfStockReservesNothing', () =>
    given([stockCheckRequested])
      .when({
        type: 'shipments.ConfirmStockAvailability',
        data: { shipmentId, productsAvailable: false },
      })
      .then([wasOutOfStock]));

  it('noProductsRecordsOutOfStockWhateverTheWarehouseSays', () =>
    given([
      {
        ...stockCheckRequested,
        data: { ...stockCheckRequested.data, productItems: [] },
      },
    ])
      .when({
        type: 'shipments.ConfirmStockAvailability',
        data: { shipmentId, productsAvailable: true },
      })
      .then([
        {
          type: 'shipments.ProductWasOutOfStock',
          data: {
            shipmentId,
            referenceId,
            productItems: [],
            availabilityCheckedAt: now,
          },
        },
      ]));

  it('aRedeliveredAnswerDoesNotDecideDifferently', () =>
    given([stockCheckRequested, reserved])
      .when({
        type: 'shipments.ConfirmStockAvailability',
        data: { shipmentId, productsAvailable: false },
      })
      .thenNothingHappened());

  it('anAnswerWithoutAStockCheckDecidesNothing', () =>
    given([])
      .when({
        type: 'shipments.ConfirmStockAvailability',
        data: { shipmentId, productsAvailable: true },
      })
      .thenNothingHappened());

  it('aReservedShipmentRequestsFulfillment', () =>
    given([reserved])
      .when({ type: 'shipments.RequestFulfillment', data: { shipmentId } })
      .then([fulfillmentRequested]));

  it('aShipmentWithoutReservedStockDoesNotRequestFulfillment', () =>
    given([wasOutOfStock])
      .when({ type: 'shipments.RequestFulfillment', data: { shipmentId } })
      .thenNothingHappened());

  it('theWarehouseSendingThePackageRecordsCarrierAndTracking', () =>
    given([reserved, fulfillmentRequested])
      .when({
        type: 'shipments.ConfirmPackageSent',
        data: { shipmentId, carrier: 'UPS', trackingNumber: '1Z999' },
      })
      .then([packageSent]));

  it('aPackageIsNotSentBeforeFulfillmentWasRequested', () =>
    given([reserved])
      .when({
        type: 'shipments.ConfirmPackageSent',
        data: { shipmentId, carrier: 'UPS', trackingNumber: '1Z999' },
      })
      .thenNothingHappened());

  it('theWarehouseRejectingTheRequestRecordsTheRejection', () =>
    given([reserved, fulfillmentRequested])
      .when({ type: 'shipments.RejectFulfillment', data: { shipmentId } })
      .then([fulfillmentRejected]));

  it('aSentPackageCanBeDelivered', () =>
    given([reserved, fulfillmentRequested, packageSent])
      .when({ type: 'shipments.DeliverPackage', data: { shipmentId } })
      .then([
        {
          type: 'shipments.PackageWasDelivered',
          data: { shipmentId, deliveredAt: now },
        },
      ]));

  it('aPackageThatWasNotSentCannotBeDelivered', () =>
    given([reserved, fulfillmentRequested])
      .when({ type: 'shipments.DeliverPackage', data: { shipmentId } })
      .thenNothingHappened());

  it('releasingReservedStockRecordsTheRelease', () =>
    given([reserved])
      .when({ type: 'shipments.ReleaseStock', data: { shipmentId } })
      .then([stockReleased]));

  it('releasingStockOfARejectedFulfillmentRecordsTheRelease', () =>
    given([reserved, fulfillmentRequested, fulfillmentRejected])
      .when({ type: 'shipments.ReleaseStock', data: { shipmentId } })
      .then([stockReleased]));

  it('releasingStockOfASentPackageDecidesNothing', () =>
    given([reserved, fulfillmentRequested, packageSent])
      .when({ type: 'shipments.ReleaseStock', data: { shipmentId } })
      .thenNothingHappened());

  it('releasingStockThatWasNeverReservedDecidesNothing', () =>
    given([wasOutOfStock])
      .when({ type: 'shipments.ReleaseStock', data: { shipmentId } })
      .thenNothingHappened());
});
