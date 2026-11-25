import {
  expectError,
  expectNothingPublished,
  expectPublished,
  expectResponse,
  htmlContaining,
  htmlNotContaining,
  send,
  timePasses,
  Urns,
  type Expectation,
  type PublishedMessage,
} from '@e-commerce/core';
import { toWeakETag, type TestRequest } from '@event-driven-io/emmett-honojs';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  paymentExternalEventTypes,
  type PaymentExternalEvent,
} from '../payments/external/paymentExternalEvent';
import { PaymentId } from '../payments/payment';
import { trailRunningShoes } from '../shop/demoProducts';
import type { ConfirmPaymentAuthorization } from '../payments/paymentCommand';
import { checkoutPageOf } from '../payments/paymentProvider';
import type { ShipmentExternalEvent } from '../shipments/external/shipmentExternalEvent';
import { ShipmentId } from '../shipments/shipment';
import type { ShoppingCartCheckedOutExternal } from '../shoppingCarts/external/shoppingCartExternalEvent';
import { ShoppingCartId } from '../shoppingCarts/shoppingCart';
import {
  testedMessagingBuses,
  type TestedMessagingBus,
  ordersPublishedTypes,
  testApplication,
} from '../testApplication';
import {
  addProductItem,
  checkOut,
} from '../shoppingCarts/shoppingCartRequests';
import { aCustomer, locationIs, shopRequests } from '../shop/shopRequests';
import { orderPageOf } from '../shop/shopUrls';
import { shopTestApplication } from '../shopTestApplication';
import { OrderId } from './order';
import {
  cancelOrder,
  orderPagesOf,
  getOrders,
  getOrderStatus,
  payNow,
  retryOrderPayment,
} from './orderRequests';

const oneDayInMs = 24 * 60 * 60 * 1000;
const unitPrice = 100;
const checkoutSessionLifetimeInMs = 30 * 60 * 1000;

describe.each(testedMessagingBuses)(
  'orders API on MESSAGING_BUS=%s',
  (bus: TestedMessagingBus) => {
    const orders = testApplication({
      messagingBus: bus,
      publishedTypes: ordersPublishedTypes,
    });

    const anOrder = (
      application: ReturnType<typeof testApplication> = orders,
    ) => {
      const now = application.clock.now().toISOString();
      const customerId = randomUUID();
      const shoes = randomUUID();
      const cartId = ShoppingCartId.of(customerId, 1);
      const orderId = OrderId.derivedFrom(cartId);
      const orderNumber = OrderId.numberOf(orderId);
      const paymentId = PaymentId.derivedFrom(orderId);
      const retriedPaymentId = PaymentId.derivedFrom(orderId, 2);
      const shipmentId = ShipmentId.derivedFrom(orderId);
      const productItems = [{ productId: shoes, quantity: 2, unitPrice }];
      const totalPrice = 200;

      const checkedOut = (
        forCustomerId = customerId,
        forCartId = cartId,
      ): ShoppingCartCheckedOutExternal => ({
        type: 'shopping_carts.external.ShoppingCartCheckedOut',
        data: {
          cartId: forCartId,
          customerId: forCustomerId,
          productItems,
          totalPrice,
          checkedOutAt: now,
        },
      });
      const paymentAuthorized = (id = paymentId): PaymentExternalEvent => ({
        type: 'payments.external.PaymentAuthorized',
        data: { referenceId: orderId, paymentId: id, authorizedAt: now },
      });
      const paymentCaptured = (id = paymentId): PaymentExternalEvent => ({
        type: 'payments.external.PaymentCaptured',
        data: { referenceId: orderId, paymentId: id, capturedAt: now },
      });
      const paymentFailed = (id = paymentId): PaymentExternalEvent => ({
        type: 'payments.external.PaymentFailed',
        data: { referenceId: orderId, paymentId: id, failedAt: now },
      });
      const stockReserved: ShipmentExternalEvent = {
        type: 'shipments.external.StockReserved',
        data: { shipmentId, referenceId: orderId, reservedAt: now },
      };
      const packageWasSent: ShipmentExternalEvent = {
        type: 'shipments.external.PackageWasSent',
        data: {
          shipmentId,
          referenceId: orderId,
          carrier: 'UPS',
          trackingNumber: '1Z999',
          sentAt: now,
        },
      };
      const shipmentFailed = (
        reason: 'ProductsOutOfStock' | 'FulfillmentRejected',
      ): ShipmentExternalEvent => ({
        type: 'shipments.external.ShipmentFailed',
        data: { shipmentId, referenceId: orderId, reason, failedAt: now },
      });

      const redelivered = {
        ...checkedOut(),
        metadata: { messageId: randomUUID() },
      };
      const placedOrder = [send(checkedOut())];
      const paidAndReservedOrder = [
        ...placedOrder,
        send(paymentAuthorized()),
        send(stockReserved),
      ];
      const sentOrder = [...paidAndReservedOrder, send(packageWasSent)];
      const completedOrder = [...sentOrder, send(paymentCaptured())];
      const orderWithFailedPayment = [...placedOrder, send(paymentFailed())];
      const sentOrderWithFailedPayment = [...sentOrder, send(paymentFailed())];

      const keyOfOrder = Urns.routingKeyOf(orderId);
      const requestOf = <Type extends string>(
        type: Type,
        data: PublishedMessage['data'],
        key: string,
      ) => ({ type, data, metadata: { key } });
      const authorizePayment = (id: string) =>
        requestOf(
          'payments.AuthorizePayment',
          { paymentId: id, referenceId: orderId, amount: totalPrice },
          Urns.routingKeyOf(id),
        );
      const reserveStock = requestOf(
        'shipments.ReserveStock',
        {
          referenceId: orderId,
          productItems: [{ productId: shoes, quantity: 2 }],
        },
        keyOfOrder,
      );
      const requestFulfillment = requestOf(
        'shipments.RequestFulfillment',
        { shipmentId },
        Urns.routingKeyOf(shipmentId),
      );
      const capturePayment = requestOf(
        'payments.CapturePayment',
        { paymentId },
        Urns.routingKeyOf(paymentId),
      );
      const cancelPayment = requestOf(
        'payments.CancelPayment',
        { paymentId },
        Urns.routingKeyOf(paymentId),
      );
      const releaseStock = requestOf(
        'shipments.ReleaseStock',
        { shipmentId },
        Urns.routingKeyOf(shipmentId),
      );
      const statusIs = (body: Record<string, unknown>) =>
        expectResponse(200, { body });
      const paymentNumber = PaymentId.tailOf(paymentId);
      const orderStatusPage = `http://localhost/shop/customers/${customerId}/orders/${orderNumber}`;
      const checkoutSessionCall = (expiresAtInMs: number) =>
        `checkout-session:${totalPrice}:${orderStatusPage}:${orderStatusPage}:${new Date(
          Date.parse(now) + expiresAtInMs,
        ).toISOString()}`;

      return {
        ...application.about(customerId),
        now,
        customerId,
        shoes,
        cartId,
        orderId,
        orderNumber,
        paymentId,
        retriedPaymentId,
        shipmentId,
        productItems,
        totalPrice,
        checkedOut,
        paymentAuthorized,
        paymentCaptured,
        paymentFailed,
        stockReserved,
        packageWasSent,
        shipmentFailed,
        redelivered,
        placedOrder,
        paidAndReservedOrder,
        sentOrder,
        completedOrder,
        orderWithFailedPayment,
        sentOrderWithFailedPayment,
        keyOfOrder,
        requestOf,
        authorizePayment,
        reserveStock,
        requestFulfillment,
        capturePayment,
        cancelPayment,
        releaseStock,
        statusIs,
        paymentNumber,
        orderStatusPage,
        checkoutSessionCall,
      };
    };

    describe('placing an order', () => {
      it('aCheckedOutCartAsksForPaymentAndStockWithTheDerivedIds', () => {
        const { given, paymentId, checkedOut, authorizePayment, reserveStock } =
          anOrder();

        return given()
          .when(send(checkedOut()))
          .then(expectPublished(authorizePayment(paymentId), reserveStock));
      });

      it('aCheckedOutCartPlacesAnOpenOrderWithItsProducts', () => {
        const {
          given,
          customerId,
          orderId,
          orderNumber,
          productItems,
          totalPrice,
          checkedOut,
          statusIs,
          now,
        } = anOrder();

        return given(send(checkedOut()))
          .when(getOrderStatus(customerId, orderNumber))
          .then(
            statusIs({
              orderId,
              customerId,
              progress: 'AwaitingPayment',
              placedAt: now,
              totalPrice,
              productItems,
            }),
          );
      });

      it('theSameCheckoutTwiceAsksForPaymentAndStockOnlyOnce', () => {
        const { given, redelivered } = anOrder();

        return given(send(redelivered))
          .when(send(redelivered))
          .then(expectNothingPublished());
      });
    });

    describe('holding payment and stock', () => {
      it('bothHoldsPaymentFirstRequestFulfillment', () => {
        const {
          given,
          paymentAuthorized,
          stockReserved,
          placedOrder,
          requestFulfillment,
        } = anOrder();

        return given(...placedOrder, send(paymentAuthorized()))
          .when(send(stockReserved))
          .then(expectPublished(requestFulfillment));
      });

      it('bothHoldsStockFirstRequestFulfillment', () => {
        const {
          given,
          paymentAuthorized,
          stockReserved,
          placedOrder,
          requestFulfillment,
        } = anOrder();

        return given(...placedOrder, send(stockReserved))
          .when(send(paymentAuthorized()))
          .then(expectPublished(requestFulfillment));
      });

      it('thePaymentAuthorizationOnItsOwnRequestsNothing', () => {
        const { given, paymentAuthorized, placedOrder } = anOrder();

        return given(...placedOrder)
          .when(send(paymentAuthorized()))
          .then(expectNothingPublished());
      });

      it('aSentPackageMakesThePaymentDueAndAsksForTheCapture', () => {
        const { given, packageWasSent, paidAndReservedOrder, capturePayment } =
          anOrder();

        return given(...paidAndReservedOrder)
          .when(send(packageWasSent))
          .then(expectPublished(capturePayment));
      });

      it('aCapturedPaymentCompletesTheOrder', () => {
        const {
          given,
          customerId,
          orderNumber,
          paymentCaptured,
          sentOrder,
          statusIs,
        } = anOrder();

        return given(...sentOrder, send(paymentCaptured()))
          .when(getOrderStatus(customerId, orderNumber))
          .then(statusIs({ progress: 'Completed' }));
      });

      it('anOldPaymentAuthorizationWhileRetryingIsIgnored', () => {
        const {
          given,
          customerId,
          orderNumber,
          paymentId,
          retriedPaymentId,
          paymentAuthorized,
          sentOrderWithFailedPayment,
          statusIs,
        } = anOrder();

        return given(
          ...sentOrderWithFailedPayment,
          retryOrderPayment(customerId, orderNumber),
          send(paymentAuthorized(paymentId)),
        )
          .when(getOrderStatus(customerId, orderNumber))
          .then(statusIs({ paymentId: retriedPaymentId, actions: ['PayNow'] }));
      });

      it('anyPaymentIdIsAcceptedWhileThePaymentIsPending', () => {
        const {
          given,
          customerId,
          orderNumber,

          retriedPaymentId,
          paymentAuthorized,
          placedOrder,
          statusIs,
        } = anOrder();

        return given(...placedOrder, send(paymentAuthorized(retriedPaymentId)))
          .when(getOrderStatus(customerId, orderNumber))
          .then(
            statusIs({ paymentId: retriedPaymentId, progress: 'Processing' }),
          );
      });

      it('captureOrFailureForAnotherPaymentIdIsIgnored', () => {
        const {
          given,
          customerId,
          orderNumber,
          retriedPaymentId,
          paymentCaptured,
          paymentFailed,
          sentOrder,
          statusIs,
        } = anOrder();

        return given(
          ...sentOrder,
          send(
            paymentCaptured(retriedPaymentId),
            paymentFailed(retriedPaymentId),
          ),
        )
          .when(getOrderStatus(customerId, orderNumber))
          .then(statusIs({ progress: 'Shipped', actions: [] }));
      });

      it('aRepeatedAuthorizationRequestsNothing', () => {
        const { given, paymentAuthorized, placedOrder } = anOrder();

        return given(...placedOrder, send(paymentAuthorized()))
          .when(send(paymentAuthorized()))
          .then(expectNothingPublished());
      });

      it('aLatePackageSentOnACompletedOrderKeepsItCompleted', () => {
        const {
          given,
          customerId,
          orderNumber,
          packageWasSent,
          completedOrder,
        } = anOrder();

        return given(...completedOrder, send(packageWasSent))
          .when(getOrderStatus(customerId, orderNumber))
          .then(
            expectResponse(200, {
              body: {
                progress: 'Completed',
                carrier: 'UPS',
                trackingNumber: '1Z999',
                actions: [],
              },
            }),
          );
      });
    });

    describe('compensating', () => {
      it('outOfStockWhilePaymentPendingKeepsTheOrderOpenAndRequestsNothing', () => {
        const { given, shipmentFailed, placedOrder } = anOrder();

        return given(...placedOrder)
          .when(send(shipmentFailed('ProductsOutOfStock')))
          .then(expectNothingPublished());
      });

      it('outOfStockWhilePaymentPendingShowsTheOutOfStockProgress', () => {
        const {
          given,
          customerId,
          orderNumber,
          shipmentFailed,
          placedOrder,
          statusIs,
        } = anOrder();

        return given(...placedOrder, send(shipmentFailed('ProductsOutOfStock')))
          .when(getOrderStatus(customerId, orderNumber))
          .then(statusIs({ progress: 'OutOfStock' }));
      });

      it('thenAnAuthorizationCancelsThePayment', () => {
        const {
          given,
          paymentAuthorized,
          shipmentFailed,
          placedOrder,
          cancelPayment,
        } = anOrder();

        return given(...placedOrder, send(shipmentFailed('ProductsOutOfStock')))
          .when(send(paymentAuthorized()))
          .then(expectPublished(cancelPayment));
      });

      it('aRejectedFulfillmentCancelsThePaymentAndReleasesTheStock', () => {
        const {
          given,
          shipmentFailed,
          paidAndReservedOrder,
          cancelPayment,
          releaseStock,
        } = anOrder();

        return given(...paidAndReservedOrder)
          .when(send(shipmentFailed('FulfillmentRejected')))
          .then(expectPublished(cancelPayment, releaseStock));
      });

      it('aPaymentFailureKeepsTheOrderOpenUntilTheDueDate', () => {
        const {
          given,
          customerId,
          orderNumber,
          orderWithFailedPayment,
          statusIs,
        } = anOrder();

        return given(...orderWithFailedPayment)
          .when(getOrderStatus(customerId, orderNumber))
          .then(
            statusIs({
              progress: 'PaymentFailed',
              actions: ['RetryPayment', 'CancelOrder'],
            }),
          );
      });

      it('aPaymentFailureOnAConfirmedOrderReleasesTheStock', () => {
        const { given, paymentFailed, paidAndReservedOrder, releaseStock } =
          anOrder();

        return given(...paidAndReservedOrder)
          .when(send(paymentFailed()))
          .then(expectPublished(releaseStock));
      });

      it('afterDueAtASentUnpaidOrderIsClosedUnpaid', () => {
        const {
          given,
          customerId,
          orderNumber,
          sentOrderWithFailedPayment,
          statusIs,
        } = anOrder();

        return given(...sentOrderWithFailedPayment, timePasses(7 * oneDayInMs))
          .when(getOrderStatus(customerId, orderNumber))
          .then(statusIs({ progress: 'ClosedUnpaid' }));
      });

      it('afterDueAtAnOpenedUnpaidOrderIsCanceledForTheFailedPayment', () => {
        const {
          given,
          customerId,
          orderNumber,
          orderWithFailedPayment,
          statusIs,
        } = anOrder();

        return given(...orderWithFailedPayment, timePasses(7 * oneDayInMs))
          .when(getOrderStatus(customerId, orderNumber))
          .then(statusIs({ progress: 'Canceled' }));
      });

      it('beforeDueAtTheOrderStaysOpen', () => {
        const {
          given,
          customerId,
          orderNumber,
          orderWithFailedPayment,
          statusIs,
        } = anOrder();

        return given(...orderWithFailedPayment, timePasses(oneDayInMs))
          .when(getOrderStatus(customerId, orderNumber))
          .then(statusIs({ progress: 'PaymentFailed' }));
      });
    });

    describe('retrying the payment', () => {
      it('retryingAFailedPaymentAsksToAuthorizeTheNewPayment', () => {
        const {
          given,
          customerId,
          orderNumber,
          retriedPaymentId,
          orderWithFailedPayment,
          authorizePayment,
        } = anOrder();

        return given(...orderWithFailedPayment)
          .when(retryOrderPayment(customerId, orderNumber))
          .then(
            expectResponse(202),
            expectPublished(authorizePayment(retriedPaymentId)),
          );
      });

      it('retryingWithoutAFailedPaymentRequestsNothing', () => {
        const { given, customerId, orderNumber, placedOrder } = anOrder();

        return given(...placedOrder)
          .when(retryOrderPayment(customerId, orderNumber))
          .then(expectResponse(202), expectNothingPublished());
      });

      it('retryingForAnUnknownOrderAnswers404', () => {
        const { given, customerId, orderNumber } = anOrder();

        return given()
          .when(retryOrderPayment(customerId, orderNumber))
          .then(expectError(404, { status: 404 }));
      });

      it('aRetryIsDecidedOnce', () => {
        const {
          given,
          customerId,
          orderNumber,

          retriedPaymentId,
          orderWithFailedPayment,
          statusIs,
        } = anOrder();

        return given(
          ...orderWithFailedPayment,
          retryOrderPayment(customerId, orderNumber),
        )
          .when(getOrderStatus(customerId, orderNumber))
          .then(statusIs({ paymentId: retriedPaymentId }));
      });
    });

    describe('canceling', () => {
      it('cancelingAnUnpaidOrderReleasesTheStockOnly', () => {
        const {
          given,
          customerId,
          orderNumber,
          stockReserved,
          placedOrder,
          releaseStock,
        } = anOrder();

        return given(...placedOrder, send(stockReserved))
          .when(cancelOrder(customerId, orderNumber))
          .then(expectResponse(202), expectPublished(releaseStock));
      });

      it('cancelingACompletedOrderRequestsNothing', () => {
        const { given, customerId, orderNumber, completedOrder } = anOrder();

        return given(...completedOrder)
          .when(cancelOrder(customerId, orderNumber))
          .then(expectResponse(202), expectNothingPublished());
      });

      it('cancelingAConfirmedOrderThatIsNotSentRequestsNothing', () => {
        const { given, customerId, orderNumber, paidAndReservedOrder } =
          anOrder();

        return given(...paidAndReservedOrder)
          .when(cancelOrder(customerId, orderNumber))
          .then(expectResponse(202), expectNothingPublished());
      });

      it('cancelingAnUnknownOrderAnswers404', () => {
        const { given, customerId, orderNumber } = anOrder();

        return given()
          .when(cancelOrder(customerId, orderNumber))
          .then(expectError(404, { status: 404 }));
      });

      it('anotherCustomersOrderAnswers404', () => {
        const { given, orderNumber, placedOrder } = anOrder();

        return given(...placedOrder)
          .when(cancelOrder(randomUUID(), orderNumber))
          .then(expectError(404, { status: 404 }));
      });
    });

    describe('many customers at once', () => {
      const customers = Array.from({ length: 12 }, () => randomUUID());
      const orderIdOf = (customer: string) =>
        OrderId.derivedFrom(ShoppingCartId.of(customer, 1));
      const holdsOf = (customer: string, now: string) => {
        const referenceId = orderIdOf(customer);

        return [
          {
            type: 'payments.external.PaymentAuthorized' as const,
            data: {
              referenceId,
              paymentId: PaymentId.derivedFrom(referenceId),
              authorizedAt: now,
            },
          },
          {
            type: 'shipments.external.StockReserved' as const,
            data: {
              referenceId,
              shipmentId: ShipmentId.derivedFrom(referenceId),
              reservedAt: now,
            },
          },
        ];
      };

      it('manyOrdersPlacedAtOnceAreAllConfirmed', () => {
        const { checkedOut, now } = anOrder();

        return orders
          .about(...customers)
          .given(
            send(
              ...customers.map((customer) =>
                checkedOut(customer, ShoppingCartId.of(customer, 1)),
              ),
            ),
          )
          .when(
            send(...customers.flatMap((customer) => holdsOf(customer, now))),
          )
          .then((outcome) => {
            expect(
              outcome.published.filter(
                ({ type }) => type === 'shipments.RequestFulfillment',
              ),
            ).toHaveLength(customers.length);
          });
      });
    });

    describe('reading orders', () => {
      it('customerOrdersAreListedNewestFirst', () => {
        const {
          given,
          customerId,
          orderId,
          totalPrice,
          checkedOut,
          completedOrder,
        } = anOrder();

        const secondCartId = ShoppingCartId.of(customerId, 2);

        return given(
          ...completedOrder,
          timePasses(60_000),
          send(checkedOut(customerId, secondCartId)),
        )
          .when(getOrders(customerId))
          .then(
            expectResponse(200, {
              body: [
                {
                  orderId: OrderId.derivedFrom(secondCartId),
                  progress: 'AwaitingPayment',
                  totalPrice,
                },
                { orderId, progress: 'Completed' },
              ],
            }),
            (outcome) => expect(outcome.response?.json()).toHaveLength(2),
          );
      });

      it('aCustomerWithoutOrdersGetsAnEmptyList', () => {
        const { given, customerId } = anOrder();

        return given()
          .when(getOrders(customerId))
          .then(expectResponse(200, { body: [] }));
      });

      it('orderStatusShowsProgressActionsAndETag', () => {
        const {
          given,
          customerId,
          orderId,
          orderNumber,
          paymentId,
          productItems,
          totalPrice,
          placedOrder,
          now,
        } = anOrder();

        return given(...placedOrder)
          .when(getOrderStatus(customerId, orderNumber))
          .then(
            expectResponse(200, {
              headers: { ETag: toWeakETag(1) },
              body: {
                orderId,
                customerId,
                progress: 'AwaitingPayment',
                paymentId,
                totalPrice,
                placedAt: now,
                productItems,
                actions: ['PayNow', 'CancelOrder'],
              },
            }),
          );
      });

      it('aCompletedOrderShowsTheCarrierAndNoActions', () => {
        const { given, customerId, orderNumber, completedOrder } = anOrder();

        return given(...completedOrder)
          .when(getOrderStatus(customerId, orderNumber))
          .then(
            expectResponse(200, {
              body: {
                progress: 'Completed',
                carrier: 'UPS',
                trackingNumber: '1Z999',
                actions: [],
              },
            }),
          );
      });

      it('anOutOfStockOrderOffersOnlyToCancel', () => {
        const { given, customerId, orderNumber, shipmentFailed, placedOrder } =
          anOrder();

        return given(...placedOrder, send(shipmentFailed('ProductsOutOfStock')))
          .when(getOrderStatus(customerId, orderNumber))
          .then(
            expectResponse(200, {
              body: { progress: 'OutOfStock', actions: ['CancelOrder'] },
            }),
          );
      });

      it('aRetriedPaymentOffersPayNowWithTheNewPayment', () => {
        const {
          given,
          customerId,
          orderNumber,

          retriedPaymentId,
          orderWithFailedPayment,
        } = anOrder();

        return given(
          ...orderWithFailedPayment,
          retryOrderPayment(customerId, orderNumber),
        )
          .when(getOrderStatus(customerId, orderNumber))
          .then(
            expectResponse(200, {
              body: {
                progress: 'AwaitingPayment',
                paymentId: retriedPaymentId,
                actions: ['PayNow', 'CancelOrder'],
              },
            }),
          );
      });

      it('anUnknownOrderAnswers404', () => {
        const { given, customerId, orderNumber } = anOrder();

        return given()
          .when(getOrderStatus(customerId, orderNumber))
          .then(expectError(404));
      });

      it('anotherCustomersOrderAnswers404ForItsStatus', () => {
        const { given, orderNumber, placedOrder } = anOrder();

        return given(...placedOrder)
          .when(getOrderStatus(randomUUID(), orderNumber))
          .then(expectError(404));
      });

      it('orderStatusRightAfterCheckoutWaitsUpTo1s', async () => {
        const {
          given,
          customerId,
          shoes,
          orderId,
          orderNumber,
          statusIs,
          priceOf,
        } = anOrder();

        const checkOutAndReadTheOrder: TestRequest = async (agent) => {
          const checkingOut = checkOut(customerId, toWeakETag(1))(agent);

          await (checkingOut instanceof Promise
            ? checkingOut
            : checkingOut.execute());

          const reading = getOrderStatus(customerId, orderNumber)(agent);

          return reading instanceof Promise ? reading : reading.execute();
        };

        await given(
          priceOf(shoes, unitPrice),
          addProductItem(customerId, { productId: shoes, quantity: 2 }),
        )
          .when(checkOutAndReadTheOrder)
          .then(statusIs({ orderId, progress: 'AwaitingPayment' }));
      });

      it('orderStatusWithTheCurrentVersionAnswers304', () => {
        const { given, customerId, orderNumber, placedOrder } = anOrder();

        return given(...placedOrder)
          .when(getOrderStatus(customerId, orderNumber, toWeakETag(1)))
          .then(expectResponse(304, { headers: { ETag: toWeakETag(1) } }));
      });
    });

    describe('paying now', () => {
      const namesThePayment =
        (id: string): Expectation =>
        (outcome) =>
          expect(outcome.response?.body ?? '').toContain(PaymentId.tailOf(id));
      const payingNow = testApplication({
        messagingBus: bus,
        publishedTypes: paymentExternalEventTypes,
        modules: ['orders', 'payments'],
      });

      it('payingNowRedirectsToTheProvidersCheckout', async () => {
        const {
          given,
          customerId,
          orderNumber,
          paymentId,
          placedOrder,
          paymentNumber,
          checkoutSessionCall,
          paymentProvider,
        } = anOrder(payingNow);

        await given(...placedOrder)
          .when(payNow(customerId, orderNumber, paymentNumber))
          .then(
            expectResponse(303, {
              headers: { Location: checkoutPageOf(paymentId) },
            }),
            () =>
              expect(paymentProvider.callsFor(paymentId)).toEqual([
                checkoutSessionCall(checkoutSessionLifetimeInMs),
              ]),
          );
      });

      it('payingNowAgainReusesTheOpenSession', async () => {
        const {
          given,
          customerId,
          orderNumber,
          paymentId,
          placedOrder,
          paymentNumber,
          paymentProvider,
        } = anOrder(payingNow);

        await given(
          ...placedOrder,
          payNow(customerId, orderNumber, paymentNumber),
          timePasses(checkoutSessionLifetimeInMs - 60_000),
        )
          .when(payNow(customerId, orderNumber, paymentNumber))
          .then(
            expectResponse(303, {
              headers: { Location: checkoutPageOf(paymentId) },
            }),
            () => expect(paymentProvider.callsFor(paymentId)).toHaveLength(1),
          );
      });

      it('payingNowOpensANewSessionOnceTheOpenOneExpired', async () => {
        const {
          given,
          customerId,
          orderNumber,
          paymentId,
          placedOrder,
          paymentNumber,
          paymentProvider,
        } = anOrder(payingNow);

        await given(
          ...placedOrder,
          payNow(customerId, orderNumber, paymentNumber),
          timePasses(checkoutSessionLifetimeInMs),
        )
          .when(payNow(customerId, orderNumber, paymentNumber))
          .then(expectResponse(303), () =>
            expect(paymentProvider.callsFor(paymentId)).toHaveLength(2),
          );
      });

      it('payingNowForAPaymentOfAnotherOrderAnswers404', () => {
        const {
          given,
          customerId,
          orderNumber,

          checkedOut,
          placedOrder,
        } = anOrder(payingNow);
        const otherCustomerId = randomUUID();
        const otherPaymentId = PaymentId.derivedFrom(
          OrderId.derivedFrom(ShoppingCartId.of(otherCustomerId, 1)),
        );

        return given(
          ...placedOrder,
          send(
            checkedOut(otherCustomerId, ShoppingCartId.of(otherCustomerId, 1)),
          ),
        )
          .when(
            payNow(customerId, orderNumber, PaymentId.tailOf(otherPaymentId)),
          )
          .then(
            expectError(404, { status: 404 }),
            namesThePayment(otherPaymentId),
          );
      });

      if (bus === 'none') {
        const loaded = testApplication({
          messagingBus: bus,
          publishedTypes: ['payments.external.PaymentAuthorized'],
          modules: ['orders', 'payments'],
        });
        const loadedCustomers = Array.from({ length: 12 }, () => randomUUID());
        const loadedPayments = loadedCustomers.map((customer) =>
          PaymentId.derivedFrom(
            OrderId.derivedFrom(ShoppingCartId.of(customer, 1)),
          ),
        );

        it('ordersAndPaymentsWritingIntoEachOtherUnderLoadAllGetAuthorized', () => {
          const { checkedOut, now } = anOrder(loaded);

          return loaded
            .about(...loadedCustomers)
            .given(
              send(
                ...loadedCustomers.map((customer) =>
                  checkedOut(customer, ShoppingCartId.of(customer, 1)),
                ),
              ),
            )
            .when(
              send(
                ...loadedPayments.map(
                  (loadedPaymentId): ConfirmPaymentAuthorization => ({
                    type: 'payments.ConfirmPaymentAuthorization',
                    data: { paymentId: loadedPaymentId, captureBefore: now },
                  }),
                ),
              ),
            )
            .then((outcome) =>
              expect(outcome.published).toHaveLength(loadedCustomers.length),
            );
        });
      }

      it('payingNowForAnUnknownOrderAnswers404', () => {
        const { given, customerId, orderNumber, paymentNumber } =
          anOrder(payingNow);

        return given()
          .when(payNow(customerId, orderNumber, paymentNumber))
          .then(expectError(404, { status: 404 }));
      });

      const unknownPaymentId = PaymentId.of(randomUUID());

      it('payingNowForAnUnknownPaymentOfAKnownOrderAnswers404', () => {
        const { given, customerId, orderNumber, placedOrder } =
          anOrder(payingNow);

        return given(...placedOrder)
          .when(
            payNow(customerId, orderNumber, PaymentId.tailOf(unknownPaymentId)),
          )
          .then(
            expectError(404, { status: 404 }),
            namesThePayment(unknownPaymentId),
            expectNothingPublished(),
          );
      });

      it('payingNowForAPaymentThatIsNotPendingAnswers409', () => {
        const {
          given,
          customerId,
          orderNumber,
          paymentId,
          placedOrder,
          paymentNumber,
          now,
        } = anOrder(payingNow);

        return given(
          ...placedOrder,
          send({
            type: 'payments.ConfirmPaymentAuthorization',
            data: { paymentId, captureBefore: now },
          }),
        )
          .when(payNow(customerId, orderNumber, paymentNumber))
          .then(expectError(409, { status: 409 }), expectNothingPublished());
      });

      it('payingNowWithAnUnreachableProviderAnswers502AndRecordsNothing', async () => {
        const {
          given,
          customerId,
          orderNumber,
          paymentId,
          placedOrder,
          paymentNumber,
          paymentProvider,
        } = anOrder(payingNow);

        await given(...placedOrder, paymentProvider.isUnreachableFor(paymentId))
          .when(payNow(customerId, orderNumber, paymentNumber))
          .then(
            expectError(502, { status: 502 }),
            expectNothingPublished(),
            () => expect(paymentProvider.callsFor(paymentId)).toHaveLength(1),
          );
      });
    });
  },
);

describe('order pages', () => {
  const shopApplication = shopTestApplication({ modules: ['orders'] });

  const shop = () => {
    const application = shopApplication;
    const now = application.clock.now().toISOString();
    const requests = shopRequests(application.fetch);
    const customer = aCustomer();
    const cartId = ShoppingCartId.of(customer.id, 1);
    const orderId = OrderId.derivedFrom(cartId);
    const orderNumber = OrderId.numberOf(orderId);
    const paymentId = PaymentId.derivedFrom(orderId);
    const shoes = trailRunningShoes;
    const checkedOut: ShoppingCartCheckedOutExternal = {
      type: 'shopping_carts.external.ShoppingCartCheckedOut',
      data: {
        cartId,
        customerId: customer.id,
        productItems: [{ productId: shoes.id, quantity: 1, unitPrice: 100 }],
        totalPrice: 100,
        checkedOutAt: now,
      },
    };
    const paymentFailed = send({
      type: 'payments.external.PaymentFailed',
      data: { referenceId: orderId, paymentId, failedAt: now },
    });

    return {
      ...application,
      ...orderPagesOf(requests),
      customer,
      orderNumber,
      orderPageOfCustomer: orderPageOf(customer.id, orderNumber),
      checkedOut,
      checkedOutCart: send(checkedOut),
      paymentFailed,
    };
  };

  it('theOrderPageShowsBeingPlacedWithAMetaRefreshFallbackUntilTheOrderExists', () => {
    const { given, orderPage, customer, orderNumber } = shop();

    return given()
      .when(orderPage(customer, orderNumber))
      .then(
        expectResponse(200),
        htmlContaining(
          'Your order is being placed',
          '<meta http-equiv="refresh" content="1"',
          'hx-trigger="every 1s"',
        ),
      );
  });

  it('anOrderListWithoutOrdersIsEmpty', () => {
    const { given, ordersPage, customer } = shop();

    return given()
      .when(ordersPage(customer))
      .then(htmlContaining('You have no orders yet.'));
  });

  it('cancelingAnUnknownOrderAnswers404', () => {
    const { given, cancelOnPage, customer, orderNumber } = shop();

    return given()
      .when(cancelOnPage(customer, orderNumber))
      .then(expectResponse(404));
  });

  it('retryingThePaymentOfAnUnknownOrderAnswers404', () => {
    const { given, retryPaymentOnPage, customer, orderNumber } = shop();

    return given()
      .when(retryPaymentOnPage(customer, orderNumber))
      .then(expectResponse(404));
  });

  it('thePlacedOrderPageOffersToPayAndToCancel', () => {
    const { given, checkedOutCart, orderPage, customer, orderNumber } = shop();

    return given(checkedOutCart)
      .when(orderPage(customer, orderNumber))
      .then(
        expectResponse(200),
        htmlContaining('Awaiting payment', 'Pay now', 'Cancel order'),
        htmlNotContaining('Your order is being placed'),
      );
  });

  it('theBeingPlacedPageBecomesTheOrderWhenItIsPlacedWhileTheCustomerWaits', () => {
    const {
      given,
      specification,
      checkedOut,
      orderPage,
      customer,
      orderNumber,
    } = shop();
    const openedBeforeTheOrderExists: TestRequest = async () => {
      const placed = new Promise((resolve) => setTimeout(resolve, 200)).then(
        () => specification.sendMessages([checkedOut]),
      );
      const response = await orderPage(customer, orderNumber)();

      await placed;

      return response;
    };

    return given()
      .when(openedBeforeTheOrderExists)
      .then(htmlContaining('Awaiting payment'));
  });

  it('theOrderPartPollsWhileTheOrderIsNotFinal', () => {
    const { given, checkedOutCart, orderPart, customer, orderNumber } = shop();

    return given(checkedOutCart)
      .when(orderPart(customer, orderNumber))
      .then(
        expectResponse(200),
        htmlContaining('hx-trigger="every 1s"', 'Awaiting payment'),
      );
  });

  it('theOrderPartAnswers304WhenNothingChanged', () => {
    const { given, checkedOutCart, orderPart, customer, orderNumber } = shop();

    return given(checkedOutCart)
      .when(orderPart(customer, orderNumber, toWeakETag(1)))
      .then(expectResponse(304));
  });

  it('aCanceledOrderPartStopsPolling', () => {
    const {
      given,
      checkedOutCart,
      cancelOnPage,
      orderPart,
      customer,
      orderNumber,
    } = shop();

    return given(checkedOutCart, cancelOnPage(customer, orderNumber))
      .when(orderPart(customer, orderNumber))
      .then(htmlContaining('Canceled'), htmlNotContaining('hx-trigger'));
  });

  it('theCancelFormRedirectsToTheOrderPage', () => {
    const {
      given,
      checkedOutCart,
      cancelOnPage,
      customer,
      orderNumber,
      orderPageOfCustomer,
    } = shop();

    return given(checkedOutCart)
      .when(cancelOnPage(customer, orderNumber))
      .then(expectResponse(303), locationIs(orderPageOfCustomer));
  });

  it('theOrderPageShowsTheCanceledOrder', () => {
    const {
      given,
      checkedOutCart,
      cancelOnPage,
      orderPage,
      customer,
      orderNumber,
    } = shop();

    return given(checkedOutCart, cancelOnPage(customer, orderNumber))
      .when(orderPage(customer, orderNumber))
      .then(htmlContaining('Canceled'), htmlNotContaining('Pay now'));
  });

  it('aFailedPaymentOffersTheRetryFormAndNoPayNow', () => {
    const {
      given,
      checkedOutCart,
      paymentFailed,
      orderPage,
      customer,
      orderNumber,
    } = shop();

    return given(checkedOutCart, paymentFailed)
      .when(orderPage(customer, orderNumber))
      .then(
        htmlContaining('Payment failed', 'Retry payment'),
        htmlNotContaining('Pay now'),
      );
  });

  it('theRetryFormRedirectsToTheOrderPageThatOffersPayNowAgain', () => {
    const {
      given,
      checkedOutCart,
      paymentFailed,
      retryPaymentOnPage,
      customer,
      orderNumber,
      orderPageOfCustomer,
    } = shop();

    return given(checkedOutCart, paymentFailed)
      .when(retryPaymentOnPage(customer, orderNumber))
      .then(expectResponse(303), locationIs(orderPageOfCustomer));
  });

  it('theRetriedOrderPageOffersPayNowAgain', () => {
    const {
      given,
      checkedOutCart,
      paymentFailed,
      retryPaymentOnPage,
      orderPage,
      customer,
      orderNumber,
    } = shop();

    return given(
      checkedOutCart,
      paymentFailed,
      retryPaymentOnPage(customer, orderNumber),
    )
      .when(orderPage(customer, orderNumber))
      .then(htmlContaining('Awaiting payment', 'Pay now'));
  });
});
