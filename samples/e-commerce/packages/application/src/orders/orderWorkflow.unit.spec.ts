import { WorkflowSpecification } from '@event-driven-io/emmett';
import { describe, it } from 'vitest';
import type { PaymentExternalEvent } from '../payments/external/paymentExternalEvent';
import { PaymentId } from '../payments/payment';
import type { ShipmentExternalEvent } from '../shipments/external/shipmentExternalEvent';
import { ShipmentId } from '../shipments/shipment';
import type { ShoppingCartCheckedOutExternal } from '../shoppingCarts/external/shoppingCartExternalEvent';
import { ShoppingCartId } from '../shoppingCarts/shoppingCart';
import { OrderId, type CancellationReason, type OrderEvent } from './order';
import {
  orderWorkflow,
  orderIdOf,
  type OrderWorkflowOutput,
} from './orderWorkflow';

const customerId = 'customer-1';
const cartId = ShoppingCartId.of(customerId, 1);
const orderId = OrderId.derivedFrom(cartId);
const paymentId = PaymentId.derivedFrom(orderId);
const retriedPaymentId = PaymentId.derivedFrom(orderId, 2);
const shipmentId = ShipmentId.derivedFrom(orderId);
const productItems = [{ productId: 'shoes', quantity: 2, unitPrice: 12.5 }];
const totalPrice = 25;

const at = (minutes: number) =>
  new Date(Date.UTC(2026, 0, 1, 10, minutes)).toISOString();
const now = at(0);

const clock = { current: new Date(now) };
const given = WorkflowSpecification.for(
  orderWorkflow({ now: () => clock.current }),
);
const atTime = (time: string) => {
  clock.current = new Date(time);
};

const checkedOut: ShoppingCartCheckedOutExternal = {
  type: 'shopping_carts.external.ShoppingCartCheckedOut',
  data: { cartId, customerId, productItems, totalPrice, checkedOutAt: at(-1) },
};
const paymentAuthorizedFor = (id: string): PaymentExternalEvent => ({
  type: 'payments.external.PaymentAuthorized',
  data: { referenceId: orderId, paymentId: id, authorizedAt: at(1) },
});
const paymentFailed: PaymentExternalEvent = {
  type: 'payments.external.PaymentFailed',
  data: { referenceId: orderId, paymentId, failedAt: at(2) },
};
const paymentCaptured: PaymentExternalEvent = {
  type: 'payments.external.PaymentCaptured',
  data: { referenceId: orderId, paymentId, capturedAt: at(4) },
};
const stockReserved: ShipmentExternalEvent = {
  type: 'shipments.external.StockReserved',
  data: { shipmentId, referenceId: orderId, reservedAt: at(2) },
};
const packageWasSent: ShipmentExternalEvent = {
  type: 'shipments.external.PackageWasSent',
  data: {
    shipmentId,
    referenceId: orderId,
    carrier: 'DHL',
    trackingNumber: 'JD01',
    sentAt: at(3),
  },
};
const shipmentFailed = (
  reason: 'ProductsOutOfStock' | 'FulfillmentRejected',
): ShipmentExternalEvent => ({
  type: 'shipments.external.ShipmentFailed',
  data: { shipmentId, referenceId: orderId, reason, failedAt: at(2) },
});

const placed: OrderEvent = {
  type: 'orders.OrderPlaced',
  data: {
    orderId,
    cartId,
    customerId,
    productItems,
    totalPrice,
    placedAt: now,
  },
};
const paymentAuthorized: OrderEvent = {
  type: 'orders.OrderPaymentAuthorized',
  data: { orderId, paymentId, authorizedAt: at(1) },
};
const stockWasReserved: OrderEvent = {
  type: 'orders.OrderStockReserved',
  data: { orderId, shipmentId, reservedAt: at(2) },
};
const confirmed: OrderEvent = {
  type: 'orders.OrderConfirmed',
  data: { orderId, paymentId, shipmentId, confirmedAt: at(2) },
};
const packageSent: OrderEvent = {
  type: 'orders.OrderPackageSent',
  data: { orderId, carrier: 'DHL', trackingNumber: 'JD01', sentAt: at(3) },
};
const paymentDue: OrderEvent = {
  type: 'orders.OrderPaymentDue',
  data: { orderId, paymentId, dueAt: at(3) },
};
const orderPaymentFailedAt = (failedAt: string): OrderEvent => ({
  type: 'orders.OrderPaymentFailed',
  data: {
    orderId,
    failedAt,
    dueAt: new Date(
      Date.parse(failedAt) + 7 * 24 * 60 * 60 * 1000,
    ).toISOString(),
  },
});
const authorizePayment: OrderWorkflowOutput = {
  type: 'payments.AuthorizePayment',
  data: { paymentId, referenceId: orderId, amount: totalPrice },
};
const reserveStock: OrderWorkflowOutput = {
  type: 'shipments.ReserveStock',
  data: {
    referenceId: orderId,
    productItems: [{ productId: 'shoes', quantity: 2 }],
  },
};
const cancelPayment: OrderWorkflowOutput = {
  type: 'payments.CancelPayment',
  data: { paymentId },
};
const releaseStock: OrderWorkflowOutput = {
  type: 'shipments.ReleaseStock',
  data: { shipmentId },
};
const canceledFor = (
  reason: CancellationReason,
  paymentStatus: 'Authorized' | 'NotAuthorized',
  shipmentStatus: 'Reserved' | 'NotReserved',
  canceledAt: string,
  knownShipmentId: string | null = shipmentId,
): OrderEvent => ({
  type: 'orders.OrderCanceled',
  data: {
    orderId,
    paymentId,
    paymentStatus,
    shipmentId: knownShipmentId,
    shipmentStatus,
    reason,
    canceledAt,
  },
});

const sent = [
  placed,
  paymentAuthorized,
  stockWasReserved,
  confirmed,
  packageSent,
  paymentDue,
];
const sentWithFailedPayment = [...sent, orderPaymentFailedAt(at(5))];

describe('order workflow', () => {
  it('aCheckedOutCartPlacesTheOrderAndAsksForPaymentAndStock', () => {
    atTime(now);

    return given([])
      .when(checkedOut)
      .then([placed, authorizePayment, reserveStock]);
  });

  it('theSameCheckoutAgainDecidesNothing', () =>
    given([placed]).when(checkedOut).thenNothingHappened());

  it('theOrderIsPlacedAtTheTimeOfTheWorkflowsClock', () => {
    atTime(at(9));

    return given([])
      .when(checkedOut)
      .then([
        { ...placed, data: { ...placed.data, placedAt: at(9) } },
        authorizePayment,
        reserveStock,
      ]);
  });

  it('thePaymentAuthorizationOnItsOwnDoesNotConfirmTheOrder', () =>
    given([placed])
      .when(paymentAuthorizedFor(paymentId))
      .then([paymentAuthorized]));

  it('theStockReservationArrivingLastConfirmsTheOrderAndRequestsFulfillment', () =>
    given([placed, paymentAuthorized])
      .when(stockReserved)
      .then([
        stockWasReserved,
        confirmed,
        { type: 'shipments.RequestFulfillment', data: { shipmentId } },
      ]));

  it('theAuthorizationArrivingLastConfirmsTheOrderJustTheSame', () =>
    given([placed, stockWasReserved])
      .when(paymentAuthorizedFor(paymentId))
      .then([
        paymentAuthorized,
        { ...confirmed, data: { ...confirmed.data, confirmedAt: at(1) } },
        { type: 'shipments.RequestFulfillment', data: { shipmentId } },
      ]));

  it('aRepeatedAuthorizationDecidesNothing', () =>
    given([placed, paymentAuthorized])
      .when(paymentAuthorizedFor(paymentId))
      .thenNothingHappened());

  it('anyPaymentIdIsAcceptedWhileThePaymentIsPending', () =>
    given([placed])
      .when(paymentAuthorizedFor(retriedPaymentId))
      .then([
        {
          type: 'orders.OrderPaymentAuthorized',
          data: { orderId, paymentId: retriedPaymentId, authorizedAt: at(1) },
        },
      ]));

  it('aSentPackageMakesThePaymentDueAndAsksForTheCapture', () =>
    given([placed, paymentAuthorized, stockWasReserved, confirmed])
      .when(packageWasSent)
      .then([
        packageSent,
        paymentDue,
        { type: 'payments.CapturePayment', data: { paymentId } },
      ]));

  it('aPackageSentBeforeTheConfirmationDecidesNothing', () =>
    given([placed, paymentAuthorized])
      .when(packageWasSent)
      .thenNothingHappened());

  it('aCapturedPaymentCompletesTheOrder', () =>
    given(sent)
      .when(paymentCaptured)
      .then([
        {
          type: 'orders.OrderPaymentCaptured',
          data: { orderId, paymentId, amount: totalPrice, capturedAt: at(4) },
        },
        {
          type: 'orders.OrderCompleted',
          data: { orderId, completedAt: at(4) },
        },
      ]));

  it('aCaptureOfAnotherPaymentDecidesNothing', () =>
    given(sent)
      .when({
        type: 'payments.external.PaymentCaptured',
        data: {
          referenceId: orderId,
          paymentId: retriedPaymentId,
          capturedAt: at(4),
        },
      })
      .thenNothingHappened());

  it('outOfStockWhilePaymentIsPendingRecordsTheFailureAndKeepsTheOrderOpen', () =>
    given([placed])
      .when(shipmentFailed('ProductsOutOfStock'))
      .then([
        {
          type: 'orders.OrderShipmentFailed',
          data: { orderId, reason: 'ProductWasOutOfStock', failedAt: at(2) },
        },
      ]));

  it('theAuthorizationAfterAnOutOfStockCancelsTheOrderAndThePayment', () =>
    given([
      placed,
      {
        type: 'orders.OrderShipmentFailed',
        data: { orderId, reason: 'ProductWasOutOfStock', failedAt: at(2) },
      },
    ])
      .when(paymentAuthorizedFor(paymentId))
      .then([
        paymentAuthorized,
        canceledFor(
          'ProductWasOutOfStock',
          'Authorized',
          'NotReserved',
          at(1),
          null,
        ),
        cancelPayment,
      ]));

  it('aRejectedFulfillmentCancelsTheOrderCancelsThePaymentAndReleasesTheStock', () =>
    given([placed, paymentAuthorized, stockWasReserved, confirmed])
      .when(shipmentFailed('FulfillmentRejected'))
      .then([
        {
          type: 'orders.OrderShipmentFailed',
          data: { orderId, reason: 'CouldNotShip', failedAt: at(2) },
        },
        canceledFor('CouldNotShip', 'Authorized', 'Reserved', at(2)),
        cancelPayment,
        releaseStock,
      ]));

  it('aPaymentFailureSetsTheDueDateSevenDaysLaterAndKeepsTheOrderOpen', () =>
    given([placed])
      .when(paymentFailed)
      .then([orderPaymentFailedAt(at(2))]));

  it('aPaymentFailureOnAConfirmedOrderThatIsNotSentCancelsItAndReleasesTheStock', () =>
    given([placed, paymentAuthorized, stockWasReserved, confirmed])
      .when(paymentFailed)
      .then([
        orderPaymentFailedAt(at(2)),
        canceledFor('PaymentFailed', 'NotAuthorized', 'Reserved', at(2)),
        releaseStock,
      ]));

  it('aFailureOfAnotherPaymentDecidesNothing', () =>
    given(sent)
      .when({
        type: 'payments.external.PaymentFailed',
        data: {
          referenceId: orderId,
          paymentId: retriedPaymentId,
          failedAt: at(5),
        },
      })
      .thenNothingHappened());

  it('aSentOrderIsClosedUnpaidOnceItsDueDatePassed', () => {
    atTime(new Date(Date.parse(at(5)) + 7 * 24 * 60 * 60 * 1000).toISOString());

    return given(sentWithFailedPayment)
      .when({ type: 'orders.CloseUnpaidOrder', data: { orderId } })
      .then([
        {
          type: 'orders.OrderClosedUnpaid',
          data: { orderId, closedAt: clock.current.toISOString() },
        },
      ]);
  });

  it('anOpenedOrderIsCanceledForTheFailedPaymentOnceItsDueDatePassed', () => {
    atTime(new Date(Date.parse(at(2)) + 7 * 24 * 60 * 60 * 1000).toISOString());

    return given([placed, orderPaymentFailedAt(at(2))])
      .when({ type: 'orders.CloseUnpaidOrder', data: { orderId } })
      .then([
        canceledFor(
          'PaymentFailed',
          'NotAuthorized',
          'NotReserved',
          clock.current.toISOString(),
          null,
        ),
      ]);
  });

  it('closingBeforeTheDueDateDecidesNothing', () => {
    atTime(at(10));

    return given([placed, orderPaymentFailedAt(at(2))])
      .when({ type: 'orders.CloseUnpaidOrder', data: { orderId } })
      .thenNothingHappened();
  });

  it('retryingAFailedPaymentStartsANewPaymentAndAsksToAuthorizeIt', () => {
    atTime(at(6));

    return given([placed, orderPaymentFailedAt(at(2))])
      .when({ type: 'orders.RetryOrderPayment', data: { orderId } })
      .then([
        {
          type: 'orders.OrderPaymentRetried',
          data: {
            orderId,
            paymentId: retriedPaymentId,
            amount: totalPrice,
            retriedAt: at(6),
          },
        },
        {
          type: 'payments.AuthorizePayment',
          data: {
            paymentId: retriedPaymentId,
            referenceId: orderId,
            amount: totalPrice,
          },
        },
      ]);
  });

  it('retryingWithoutAFailedPaymentDecidesNothing', () =>
    given([placed])
      .when({ type: 'orders.RetryOrderPayment', data: { orderId } })
      .thenNothingHappened());

  it('cancelingAnOpenedOrderOnlyReleasesTheReservedStock', () => {
    atTime(at(7));

    return given([placed, stockWasReserved])
      .when({
        type: 'orders.CancelOrder',
        data: { orderId, cancellationReason: 'Requested' },
      })
      .then([
        canceledFor('Requested', 'NotAuthorized', 'Reserved', at(7)),
        releaseStock,
      ]);
  });

  it('cancelingACompletedOrderDecidesNothing', () =>
    given([
      ...sent,
      {
        type: 'orders.OrderPaymentCaptured',
        data: { orderId, paymentId, amount: totalPrice, capturedAt: at(4) },
      },
      { type: 'orders.OrderCompleted', data: { orderId, completedAt: at(4) } },
    ])
      .when({
        type: 'orders.CancelOrder',
        data: { orderId, cancellationReason: 'Requested' },
      })
      .thenNothingHappened());

  it('theOrderIdComesFromTheInputsOrderPaymentOrShipmentReference', () => {
    const ids = [
      orderIdOf(checkedOut.data),
      orderIdOf(paymentFailed.data),
      orderIdOf(stockReserved.data),
      orderIdOf({ orderId }),
    ];

    if (ids.some((id) => id !== orderId))
      throw new Error(`Order ids differ: ${ids.join(', ')}`);
  });
});
