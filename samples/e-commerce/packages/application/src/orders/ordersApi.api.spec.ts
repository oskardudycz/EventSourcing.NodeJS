import {
  expectError,
  expectNothingPublished,
  expectPublished,
  expectResponse,
  send,
  timePasses,
  Urns,
  type Expectation,
  type PublishedMessage,
} from '@e-commerce/core';
import { toWeakETag, type TestRequest } from '@event-driven-io/emmett-honojs';
import { randomUUID } from 'node:crypto';
import { failsOnEmmett } from '../knownFailures';
import { describe, expect, it } from 'vitest';
import {
  paymentExternalEventTypes,
  type PaymentExternalEvent,
} from '../payments/external/paymentExternalEvent';
import { PaymentId } from '../payments/payment';
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
import { OrderId } from './order';
import {
  cancelOrder,
  getOrders,
  getOrderStatus,
  payNow,
  retryOrderPayment,
} from './orderRequests';

const now = '2026-01-01T10:00:00.000Z';
const oneDayInMs = 24 * 60 * 60 * 1000;
const unitPrice = 100;

describe.each(testedMessagingBuses)(
  'orders API on MESSAGING_BUS=%s',
  (bus: TestedMessagingBus) => {
    const given = (
      ...steps: Parameters<ReturnType<typeof testApplication>['given']>
    ) =>
      testApplication({
        messagingBus: bus,
        publishedTypes: ordersPublishedTypes,
      }).given(...steps);

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

    describe('placing an order', () => {
      it('aCheckedOutCartAsksForPaymentAndStockWithTheDerivedIds', () =>
        given()
          .when(send(checkedOut()))
          .then(expectPublished(authorizePayment(paymentId), reserveStock)));

      failsOnEmmett('#432')(
        'aCheckedOutCartPlacesAnOpenOrderWithItsProducts',
        () =>
          given(send(checkedOut()))
            .when(getOrderStatus(customerId, orderNumber))
            .then(
              statusIs({
                orderId,
                customerId,
                stage: 'Opened',
                progress: 'AwaitingPayment',
                placedAt: now,
                totalPrice,
                productItems,
              }),
            ),
      );

      it('theSameCheckoutTwiceAsksForPaymentAndStockOnlyOnce', () =>
        given(send(redelivered))
          .when(send(redelivered))
          .then(expectNothingPublished()));
    });

    describe('holding payment and stock', () => {
      it('bothHoldsPaymentFirstRequestFulfillment', () =>
        given(...placedOrder, send(paymentAuthorized()))
          .when(send(stockReserved))
          .then(expectPublished(requestFulfillment)));

      it('bothHoldsStockFirstRequestFulfillment', () =>
        given(...placedOrder, send(stockReserved))
          .when(send(paymentAuthorized()))
          .then(expectPublished(requestFulfillment)));

      it('thePaymentAuthorizationOnItsOwnRequestsNothing', () =>
        given(...placedOrder)
          .when(send(paymentAuthorized()))
          .then(expectNothingPublished()));

      it('aSentPackageMakesThePaymentDueAndAsksForTheCapture', () =>
        given(...paidAndReservedOrder)
          .when(send(packageWasSent))
          .then(expectPublished(capturePayment)));

      failsOnEmmett('#432')('aCapturedPaymentCompletesTheOrder', () =>
        given(...sentOrder, send(paymentCaptured()))
          .when(getOrderStatus(customerId, orderNumber))
          .then(statusIs({ progress: 'Completed', stage: 'Ended' })),
      );

      failsOnEmmett('#432')(
        'anOldPaymentAuthorizationWhileRetryingIsIgnored',
        () =>
          given(
            ...sentOrderWithFailedPayment,
            retryOrderPayment(customerId, orderNumber),
            send(paymentAuthorized(paymentId)),
          )
            .when(getOrderStatus(customerId, orderNumber))
            .then(
              statusIs({ paymentId: retriedPaymentId, payment: 'Pending' }),
            ),
      );

      failsOnEmmett('#432')(
        'anyPaymentIdIsAcceptedWhileThePaymentIsPending',
        () =>
          given(...placedOrder, send(paymentAuthorized(retriedPaymentId)))
            .when(getOrderStatus(customerId, orderNumber))
            .then(
              statusIs({ paymentId: retriedPaymentId, payment: 'Authorized' }),
            ),
      );

      failsOnEmmett('#432')(
        'captureOrFailureForAnotherPaymentIdIsIgnored',
        () =>
          given(
            ...sentOrder,
            send(
              paymentCaptured(retriedPaymentId),
              paymentFailed(retriedPaymentId),
            ),
          )
            .when(getOrderStatus(customerId, orderNumber))
            .then(statusIs({ payment: 'Authorized', progress: 'Shipped' })),
      );

      it('aRepeatedAuthorizationRequestsNothing', () =>
        given(...placedOrder, send(paymentAuthorized()))
          .when(send(paymentAuthorized()))
          .then(expectNothingPublished()));

      failsOnEmmett('#432')(
        'aLatePackageSentOnACompletedOrderKeepsItCompleted',
        () =>
          given(...completedOrder, send(packageWasSent))
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
            ),
      );
    });

    describe('compensating', () => {
      it('outOfStockWhilePaymentPendingKeepsTheOrderOpenAndRequestsNothing', () =>
        given(...placedOrder)
          .when(send(shipmentFailed('ProductsOutOfStock')))
          .then(expectNothingPublished()));

      failsOnEmmett('#432')(
        'outOfStockWhilePaymentPendingShowsTheOutOfStockProgress',
        () =>
          given(...placedOrder, send(shipmentFailed('ProductsOutOfStock')))
            .when(getOrderStatus(customerId, orderNumber))
            .then(statusIs({ progress: 'OutOfStock', stage: 'Opened' })),
      );

      it('thenAnAuthorizationCancelsThePayment', () =>
        given(...placedOrder, send(shipmentFailed('ProductsOutOfStock')))
          .when(send(paymentAuthorized()))
          .then(expectPublished(cancelPayment)));

      it('aRejectedFulfillmentCancelsThePaymentAndReleasesTheStock', () =>
        given(...paidAndReservedOrder)
          .when(send(shipmentFailed('FulfillmentRejected')))
          .then(expectPublished(cancelPayment, releaseStock)));

      failsOnEmmett('#432')(
        'aPaymentFailureKeepsTheOrderOpenUntilTheDueDate',
        () =>
          given(...orderWithFailedPayment)
            .when(getOrderStatus(customerId, orderNumber))
            .then(
              statusIs({
                progress: 'PaymentFailed',
                stage: 'Opened',
                actions: ['RetryPayment', 'CancelOrder'],
              }),
            ),
      );

      it('aPaymentFailureOnAConfirmedOrderReleasesTheStock', () =>
        given(...paidAndReservedOrder)
          .when(send(paymentFailed()))
          .then(expectPublished(releaseStock)));

      failsOnEmmett('#432')('afterDueAtASentUnpaidOrderIsClosedUnpaid', () =>
        given(...sentOrderWithFailedPayment, timePasses(7 * oneDayInMs))
          .when(getOrderStatus(customerId, orderNumber))
          .then(statusIs({ progress: 'ClosedUnpaid', stage: 'Ended' })),
      );

      failsOnEmmett('#432')(
        'afterDueAtAnOpenedUnpaidOrderIsCanceledForTheFailedPayment',
        () =>
          given(...orderWithFailedPayment, timePasses(7 * oneDayInMs))
            .when(getOrderStatus(customerId, orderNumber))
            .then(statusIs({ progress: 'Canceled', stage: 'Ended' })),
      );

      failsOnEmmett('#432')('beforeDueAtTheOrderStaysOpen', () =>
        given(...orderWithFailedPayment, timePasses(oneDayInMs))
          .when(getOrderStatus(customerId, orderNumber))
          .then(statusIs({ progress: 'PaymentFailed', stage: 'Opened' })),
      );
    });

    describe('retrying the payment', () => {
      failsOnEmmett('#432')(
        'retryingAFailedPaymentAsksToAuthorizeTheNewPayment',
        () =>
          given(...orderWithFailedPayment)
            .when(retryOrderPayment(customerId, orderNumber))
            .then(
              expectResponse(202),
              expectPublished(authorizePayment(retriedPaymentId)),
            ),
      );

      failsOnEmmett('#432')(
        'retryingWithoutAFailedPaymentRequestsNothing',
        () =>
          given(...placedOrder)
            .when(retryOrderPayment(customerId, orderNumber))
            .then(expectResponse(202), expectNothingPublished()),
      );

      it('retryingForAnUnknownOrderAnswers404', () =>
        given()
          .when(retryOrderPayment(customerId, orderNumber))
          .then(expectError(404, { status: 404 })));

      failsOnEmmett('#432')('aRetryIsDecidedOnce', () =>
        given(
          ...orderWithFailedPayment,
          retryOrderPayment(customerId, orderNumber),
        )
          .when(getOrderStatus(customerId, orderNumber))
          .then(statusIs({ paymentId: retriedPaymentId })),
      );
    });

    describe('canceling', () => {
      failsOnEmmett('#432')('cancelingAnUnpaidOrderReleasesTheStockOnly', () =>
        given(...placedOrder, send(stockReserved))
          .when(cancelOrder(customerId, orderNumber))
          .then(expectResponse(202), expectPublished(releaseStock)),
      );

      failsOnEmmett('#432')('cancelingACompletedOrderRequestsNothing', () =>
        given(...completedOrder)
          .when(cancelOrder(customerId, orderNumber))
          .then(expectResponse(202), expectNothingPublished()),
      );

      failsOnEmmett('#432')(
        'cancelingAConfirmedOrderThatIsNotSentRequestsNothing',
        () =>
          given(...paidAndReservedOrder)
            .when(cancelOrder(customerId, orderNumber))
            .then(expectResponse(202), expectNothingPublished()),
      );

      it('cancelingAnUnknownOrderAnswers404', () =>
        given()
          .when(cancelOrder(customerId, orderNumber))
          .then(expectError(404, { status: 404 })));

      it('anotherCustomersOrderAnswers404', () =>
        given(...placedOrder)
          .when(cancelOrder(randomUUID(), orderNumber))
          .then(expectError(404, { status: 404 })));
    });

    describe('many customers at once', () => {
      const customers = Array.from({ length: 12 }, () => randomUUID());
      const orderIdOf = (customer: string) =>
        OrderId.derivedFrom(ShoppingCartId.of(customer, 1));
      const checkoutOf = (customer: ReturnType<typeof randomUUID>) =>
        checkedOut(customer, ShoppingCartId.of(customer, 1));
      const holdsOf = (customer: string) => {
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
        return given(send(...customers.map(checkoutOf)))
          .when(send(...customers.flatMap(holdsOf)))
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
      failsOnEmmett('#432')('customerOrdersAreListedNewestFirst', () => {
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
                  shipped: false,
                },
                { orderId, progress: 'Completed', shipped: true },
              ],
            }),
            (outcome) => expect(outcome.response?.json()).toHaveLength(2),
          );
      });

      it('aCustomerWithoutOrdersGetsAnEmptyList', () =>
        given()
          .when(getOrders(customerId))
          .then(expectResponse(200, { body: [] })));

      failsOnEmmett('#432')('orderStatusShowsProgressActionsAndETag', () =>
        given(...placedOrder)
          .when(getOrderStatus(customerId, orderNumber))
          .then(
            expectResponse(200, {
              headers: { ETag: toWeakETag(1) },
              body: {
                orderId,
                customerId,
                progress: 'AwaitingPayment',
                stage: 'Opened',
                payment: 'Pending',
                shipment: 'Pending',
                paymentId,
                totalPrice,
                placedAt: now,
                productItems,
                actions: ['PayNow', 'CancelOrder'],
              },
            }),
          ),
      );

      failsOnEmmett('#432')('aCompletedOrderShowsTheCarrierAndNoActions', () =>
        given(...completedOrder)
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
          ),
      );

      failsOnEmmett('#432')('anOutOfStockOrderOffersOnlyToCancel', () =>
        given(...placedOrder, send(shipmentFailed('ProductsOutOfStock')))
          .when(getOrderStatus(customerId, orderNumber))
          .then(
            expectResponse(200, {
              body: { progress: 'OutOfStock', actions: ['CancelOrder'] },
            }),
          ),
      );

      failsOnEmmett('#432')(
        'aRetriedPaymentOffersPayNowWithTheNewPayment',
        () =>
          given(
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
            ),
      );

      it('anUnknownOrderAnswers404', () =>
        given()
          .when(getOrderStatus(customerId, orderNumber))
          .then(expectError(404)));

      it('anotherCustomersOrderAnswers404ForItsStatus', () =>
        given(...placedOrder)
          .when(getOrderStatus(randomUUID(), orderNumber))
          .then(expectError(404)));

      failsOnEmmett('#432')(
        'orderStatusRightAfterCheckoutWaitsUpTo1s',
        async () => {
          const { given, priceOf } = testApplication({
            messagingBus: bus,
            publishedTypes: ordersPublishedTypes,
          });
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
        },
      );

      failsOnEmmett('#432')('orderStatusWithTheCurrentVersionAnswers304', () =>
        given(...placedOrder)
          .when(getOrderStatus(customerId, orderNumber, toWeakETag(1)))
          .then(expectResponse(304, { headers: { ETag: toWeakETag(1) } })),
      );
    });

    describe('paying now', () => {
      const checkoutSessionLifetimeInMs = 30 * 60 * 1000;
      const paymentNumber = PaymentId.tailOf(paymentId);
      const orderStatusPage = `http://localhost/shop/customers/${customerId}/orders/${orderNumber}`;
      const namesThePayment =
        (id: string): Expectation =>
        (outcome) =>
          expect(outcome.response?.body ?? '').toContain(PaymentId.tailOf(id));
      const payingNowApplication = (signal?: AbortSignal) =>
        testApplication({
          messagingBus: bus,
          publishedTypes: paymentExternalEventTypes,
          modules: ['orders', 'payments'],
          signal,
        });
      const checkoutSessionCall = (expiresAtInMs: number) =>
        `checkout-session:${totalPrice}:${orderStatusPage}:${orderStatusPage}:${new Date(
          Date.parse(now) + expiresAtInMs,
        ).toISOString()}`;

      failsOnEmmett('#432')(
        'payingNowRedirectsToTheProvidersCheckout',
        async (signal) => {
          const { given, paymentProvider } = payingNowApplication(signal);

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
        },
      );

      failsOnEmmett('#432')(
        'payingNowAgainReusesTheOpenSession',
        async (signal) => {
          const { given, paymentProvider } = payingNowApplication(signal);

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
        },
      );

      failsOnEmmett('#432')(
        'payingNowOpensANewSessionOnceTheOpenOneExpired',
        async (signal) => {
          const { given, paymentProvider } = payingNowApplication(signal);

          await given(
            ...placedOrder,
            payNow(customerId, orderNumber, paymentNumber),
            timePasses(checkoutSessionLifetimeInMs),
          )
            .when(payNow(customerId, orderNumber, paymentNumber))
            .then(expectResponse(303), () =>
              expect(paymentProvider.callsFor(paymentId)).toHaveLength(2),
            );
        },
      );

      failsOnEmmett('#432')(
        'payingNowForAPaymentOfAnotherOrderAnswers404',
        (signal) => {
          const otherCustomerId = randomUUID();
          const otherPaymentId = PaymentId.derivedFrom(
            OrderId.derivedFrom(ShoppingCartId.of(otherCustomerId, 1)),
          );

          return payingNowApplication(signal)
            .given(
              ...placedOrder,
              send(
                checkedOut(
                  otherCustomerId,
                  ShoppingCartId.of(otherCustomerId, 1),
                ),
              ),
            )
            .when(
              payNow(customerId, orderNumber, PaymentId.tailOf(otherPaymentId)),
            )
            .then(
              expectError(404, { status: 404 }),
              namesThePayment(otherPaymentId),
            );
        },
      );

      if (bus === 'none') {
        const loadedCustomers = Array.from({ length: 12 }, () => randomUUID());
        const loadedPayments = loadedCustomers.map((customer) =>
          PaymentId.derivedFrom(
            OrderId.derivedFrom(ShoppingCartId.of(customer, 1)),
          ),
        );

        failsOnEmmett('#432')(
          'ordersAndPaymentsWritingIntoEachOtherUnderLoadAllGetAuthorized',
          (signal) =>
            testApplication({
              messagingBus: bus,
              publishedTypes: ['payments.external.PaymentAuthorized'],
              modules: ['orders', 'payments'],
              signal,
            })
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
              ),
        );
      }

      it('payingNowForAnUnknownOrderAnswers404', () =>
        payingNowApplication()
          .given()
          .when(payNow(customerId, orderNumber, paymentNumber))
          .then(expectError(404, { status: 404 })));

      const unknownPaymentId = PaymentId.of(randomUUID());

      failsOnEmmett('#432')(
        'payingNowForAnUnknownPaymentOfAKnownOrderAnswers404',
        (signal) =>
          payingNowApplication(signal)
            .given(...placedOrder)
            .when(
              payNow(
                customerId,
                orderNumber,
                PaymentId.tailOf(unknownPaymentId),
              ),
            )
            .then(
              expectError(404, { status: 404 }),
              namesThePayment(unknownPaymentId),
              expectNothingPublished(),
            ),
      );

      failsOnEmmett('#432')(
        'payingNowForAPaymentThatIsNotPendingAnswers409',
        (signal) =>
          payingNowApplication(signal)
            .given(
              ...placedOrder,
              send({
                type: 'payments.ConfirmPaymentAuthorization',
                data: { paymentId, captureBefore: now },
              }),
            )
            .when(payNow(customerId, orderNumber, paymentNumber))
            .then(expectError(409, { status: 409 }), expectNothingPublished()),
      );

      failsOnEmmett('#432')(
        'payingNowWithAnUnreachableProviderAnswers502AndRecordsNothing',
        async (signal) => {
          const { given, paymentProvider } = payingNowApplication(signal);

          await given(
            ...placedOrder,
            paymentProvider.isUnreachableFor(paymentId),
          )
            .when(payNow(customerId, orderNumber, paymentNumber))
            .then(
              expectError(502, { status: 502 }),
              expectNothingPublished(),
              () => expect(paymentProvider.callsFor(paymentId)).toHaveLength(1),
            );
        },
      );
    });
  },
);
