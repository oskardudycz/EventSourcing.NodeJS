import {
  expectNothingPublished,
  expectPublished,
  expectResponse,
  htmlContaining,
  htmlNotContaining,
  redirectsTo,
  send,
  timePasses,
  Urns,
} from '@e-commerce/core';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { OrderId } from '../orders/order';
import { ShoppingCartId } from '../shoppingCarts/shoppingCart';
import { orderStatusIs, payNow } from '../orders/orderRequests';
import { trailRunningShoes } from '../shop/demoProducts';
import {
  aCustomer,
  capturingLocationOf,
  shopRequests,
} from '../shop/shopRequests';
import { orderPageOf } from '../shop/shopUrls';
import { shopTestApplication } from '../shopTestApplication';
import type { ShoppingCartCheckedOutExternal } from '../shoppingCarts/external/shoppingCartExternalEvent';
import {
  testedMessagingBuses,
  testApplication,
  type TestedMessagingBus,
} from '../testApplication';
import { paymentExternalEventTypes } from './external/paymentExternalEvent';
import { PaymentId } from './payment';
import {
  sandboxDeclinedCard,
  sandboxSuccessCard,
} from './sandbox/sandboxPaymentGateway';
import type {
  AuthorizePayment,
  CancelPayment,
  CapturePayment,
  ConfirmPaymentAuthorization,
  ConfirmPaymentCapture,
  FailPaymentCapture,
  TimeOutPayment,
} from './paymentCommand';

const oneDayInMs = 24 * 60 * 60 * 1000;
const sevenDaysInMs = 7 * oneDayInMs;
const amount = 62.5;

describe.each(testedMessagingBuses)(
  'payments API on MESSAGING_BUS=%s',
  (bus: TestedMessagingBus) => {
    const payments = testApplication({
      messagingBus: bus,
      publishedTypes: paymentExternalEventTypes,
      modules: ['payments'],
    });

    const aPayment = () => {
      const now = payments.clock.now().toISOString();
      const after = (milliseconds: number) =>
        new Date(Date.parse(now) + milliseconds).toISOString();
      const referenceId = OrderId.derivedFrom(
        ShoppingCartId.of(randomUUID(), 1),
      );
      const paymentId = PaymentId.derivedFrom(referenceId);
      const key = Urns.routingKeyOf(referenceId);

      const authorizePayment: AuthorizePayment = {
        type: 'payments.AuthorizePayment',
        data: { paymentId, referenceId, amount },
      };
      const confirmAuthorization: ConfirmPaymentAuthorization = {
        type: 'payments.ConfirmPaymentAuthorization',
        data: { paymentId, captureBefore: after(sevenDaysInMs) },
      };
      const capturePayment: CapturePayment = {
        type: 'payments.CapturePayment',
        data: { paymentId },
      };
      const confirmCapture: ConfirmPaymentCapture = {
        type: 'payments.ConfirmPaymentCapture',
        data: { paymentId },
      };
      const failCapture: FailPaymentCapture = {
        type: 'payments.FailPaymentCapture',
        data: { paymentId, reason: 'UnexpectedError' },
      };
      const cancelPayment: CancelPayment = {
        type: 'payments.CancelPayment',
        data: { paymentId },
      };
      const timeOutPayment: TimeOutPayment = {
        type: 'payments.TimeOutPayment',
        data: { paymentId, timedOutAt: now },
      };

      const requestedPayment = [send(authorizePayment)];
      const authorizedPayment = [
        ...requestedPayment,
        send(confirmAuthorization),
      ];
      const capturedPayment = [
        ...authorizedPayment,
        send(capturePayment),
        send(confirmCapture),
      ];

      const paymentFailedAt = (failedAt: string) => ({
        type: 'payments.external.PaymentFailed' as const,
        data: { referenceId, paymentId, failedAt },
        metadata: { key },
      });

      return {
        ...payments.about(paymentId),
        now,
        after,
        referenceId,
        paymentId,
        key,
        authorizePayment,
        confirmAuthorization,
        capturePayment,
        confirmCapture,
        failCapture,
        cancelPayment,
        timeOutPayment,
        requestedPayment,
        authorizedPayment,
        capturedPayment,
        paymentFailedAt,
      };
    };

    describe('authorizing a payment', () => {
      it('authorizingAPaymentAsksTheProviderForNothingAndWaitsForTheConfirmation', async () => {
        const {
          given,
          paymentProvider,
          referenceId,
          paymentId,
          key,
          authorizePayment,
          confirmAuthorization,
          now,
        } = aPayment();

        await given(send(authorizePayment))
          .when(send(confirmAuthorization))
          .then(
            expectPublished({
              type: 'payments.external.PaymentAuthorized',
              data: { referenceId, paymentId, authorizedAt: now },
              metadata: { key },
            }),
            () => expect(paymentProvider.callsFor(paymentId)).toEqual([]),
          );
      });

      it('authorizingTheSamePaymentAgainChangesNothing', () => {
        const { given, authorizePayment, authorizedPayment } = aPayment();

        return given(...authorizedPayment)
          .when(send(authorizePayment))
          .then(expectNothingPublished());
      });

      it('aConfirmedAuthorizationSendsPaymentAuthorizedKeyedByTheReference', () => {
        const {
          given,
          referenceId,
          paymentId,
          key,
          confirmAuthorization,
          requestedPayment,
          now,
        } = aPayment();

        return given(...requestedPayment)
          .when(send(confirmAuthorization))
          .then(
            expectPublished({
              type: 'payments.external.PaymentAuthorized',
              data: { referenceId, paymentId, authorizedAt: now },
              metadata: { key },
            }),
          );
      });

      it('confirmingAnAuthorizedPaymentAgainSendsNothing', () => {
        const { given, confirmAuthorization, authorizedPayment } = aPayment();

        return given(...authorizedPayment)
          .when(send(confirmAuthorization))
          .then(expectNothingPublished());
      });
    });

    describe('capturing a payment', () => {
      it('captureAsksTheProviderAndWaitsForItsConfirmation', async () => {
        const {
          given,
          paymentProvider,
          paymentId,
          capturePayment,
          authorizedPayment,
        } = aPayment();

        await given(...authorizedPayment)
          .when(send(capturePayment))
          .then(expectNothingPublished(), () =>
            expect(paymentProvider.callsFor(paymentId)).toEqual([
              `capture:${amount}`,
            ]),
          );
      });

      it('theProvidersConfirmationOfTheCaptureSendsPaymentCaptured', async () => {
        const {
          given,
          paymentProvider,
          referenceId,
          paymentId,
          key,
          capturePayment,
          authorizedPayment,
          now,
        } = aPayment();

        await given(...authorizedPayment, send(capturePayment))
          .when(paymentProvider.confirmsTheCapture(paymentId))
          .then(
            expectPublished({
              type: 'payments.external.PaymentCaptured',
              data: { referenceId, paymentId, capturedAt: now },
              metadata: { key },
            }),
          );
      });

      it('aRefusedCaptureFailsThePaymentAndLogsIt', async () => {
        const {
          given,
          paymentProvider,
          logs,
          paymentId,
          capturePayment,
          authorizedPayment,
          paymentFailedAt,
          now,
        } = aPayment();

        await given(
          ...authorizedPayment,
          paymentProvider.refusesTheFirstCaptureOf(paymentId),
        )
          .when(send(capturePayment))
          .then(expectPublished(paymentFailedAt(now)), () =>
            expect(logs().join('\n')).toContain(
              `Capturing payment ${paymentId} failed`,
            ),
          );
      });

      it('capturingAPaymentThatIsNotAuthorizedAsksNobodyAndLeavesItPending', async () => {
        const {
          given,
          paymentProvider,
          referenceId,
          paymentId,
          key,
          confirmAuthorization,
          capturePayment,
          requestedPayment,
          now,
        } = aPayment();

        await given(...requestedPayment, send(capturePayment))
          .when(send(confirmAuthorization))
          .then(
            expectPublished({
              type: 'payments.external.PaymentAuthorized',
              data: { referenceId, paymentId, authorizedAt: now },
              metadata: { key },
            }),
            () => expect(paymentProvider.callsFor(paymentId)).toEqual([]),
          );
      });

      it('aFailedCaptureAfterTheCaptureSendsNothing', () => {
        const { given, failCapture, capturedPayment } = aPayment();

        return given(...capturedPayment)
          .when(send(failCapture))
          .then(expectNothingPublished());
      });
    });

    describe('canceling a payment', () => {
      it('cancelingAnAuthorizedPaymentCancelsAtTheProviderWithoutTellingAnyone', async () => {
        const {
          given,
          paymentProvider,
          paymentId,
          cancelPayment,
          authorizedPayment,
        } = aPayment();

        await given(...authorizedPayment)
          .when(send(cancelPayment))
          .then(expectNothingPublished(), () =>
            expect(paymentProvider.callsFor(paymentId)).toEqual(['cancel']),
          );
      });

      it('authorizationClientLogsWhenTheProviderRefusesToCancel', async () => {
        const {
          given,
          paymentProvider,
          logs,
          paymentId,
          cancelPayment,
          authorizedPayment,
        } = aPayment();

        await given(
          ...authorizedPayment,
          paymentProvider.refusesEverythingAfterAuthorizing(paymentId),
        )
          .when(send(cancelPayment))
          .then(expectNothingPublished(), () => {
            expect(paymentProvider.callsFor(paymentId)).toEqual(['cancel']);
            expect(logs().join('\n')).toContain(
              `Canceling payment ${paymentId} failed`,
            );
          });
      });

      it('aCapturedPaymentStaysCapturedWhenCanceled', async () => {
        const {
          given,
          paymentProvider,
          paymentId,
          cancelPayment,
          capturedPayment,
        } = aPayment();

        await given(...capturedPayment)
          .when(send(cancelPayment))
          .then(expectNothingPublished(), () =>
            expect(paymentProvider.callsFor(paymentId)).toEqual([
              `capture:${amount}`,
            ]),
          );
      });
    });

    describe('timing out a payment', () => {
      it('after24hAPendingPaymentTimesOutAndItsCheckoutSessionExpires', async () => {
        const {
          given,
          paymentProvider,
          paymentId,
          requestedPayment,
          paymentFailedAt,
          after,
        } = aPayment();

        await given(...requestedPayment)
          .when(timePasses(oneDayInMs))
          .then(expectPublished(paymentFailedAt(after(oneDayInMs))), () =>
            expect(paymentProvider.callsFor(paymentId)).toEqual([
              'expire-checkout-session',
            ]),
          );
      });

      it('aPaymentTimesOutEvenWhenTheProviderRefusesToExpireTheCheckoutSession', async () => {
        const {
          given,
          paymentProvider,
          logs,
          paymentId,
          requestedPayment,
          paymentFailedAt,
          after,
        } = aPayment();

        await given(
          ...requestedPayment,
          paymentProvider.isUnreachableFor(paymentId),
        )
          .when(timePasses(oneDayInMs))
          .then(expectPublished(paymentFailedAt(after(oneDayInMs))), () =>
            expect(logs().join('\n')).toContain(
              `Expiring the checkout session of payment ${paymentId} failed`,
            ),
          );
      });

      it('aPaymentStaysPendingWhenTimedOutEarly', async () => {
        const {
          given,
          paymentProvider,
          referenceId,
          paymentId,
          key,
          confirmAuthorization,
          timeOutPayment,
          requestedPayment,
          now,
        } = aPayment();

        await given(...requestedPayment, send(timeOutPayment))
          .when(send(confirmAuthorization))
          .then(
            expectPublished({
              type: 'payments.external.PaymentAuthorized',
              data: { referenceId, paymentId, authorizedAt: now },
              metadata: { key },
            }),
            () => expect(paymentProvider.callsFor(paymentId)).toEqual([]),
          );
      });

      it('aTimedOutPaymentTimesOutOnlyOnce', async () => {
        const { given, paymentProvider, paymentId, requestedPayment } =
          aPayment();

        await given(...requestedPayment, timePasses(oneDayInMs))
          .when(timePasses(60_000))
          .then(expectNothingPublished(), () =>
            expect(paymentProvider.callsFor(paymentId)).toEqual([
              'expire-checkout-session',
            ]),
          );
      });

      it('anAuthorizedPaymentNeverTimesOut', () => {
        const { given, authorizedPayment } = aPayment();

        return given(...authorizedPayment)
          .when(timePasses(oneDayInMs))
          .then(expectNothingPublished());
      });
    });

    describe('expiring an authorization', () => {
      it('afterCaptureBeforeAnAuthorizationExpiresAndFailsThePayment', () => {
        const { given, authorizedPayment, paymentFailedAt, after } = aPayment();

        return given(...authorizedPayment)
          .when(timePasses(sevenDaysInMs))
          .then(expectPublished(paymentFailedAt(after(sevenDaysInMs))));
      });

      it('anAuthorizationDoesNotExpireBeforeItsDeadline', () => {
        const { given, authorizedPayment } = aPayment();

        return given(...authorizedPayment)
          .when(timePasses(sevenDaysInMs - 60_000))
          .then(expectNothingPublished());
      });

      it('anExpiredAuthorizationExpiresOnlyOnce', () => {
        const { given, authorizedPayment } = aPayment();

        return given(...authorizedPayment, timePasses(sevenDaysInMs))
          .when(timePasses(oneDayInMs))
          .then(expectNothingPublished());
      });

      it('aCanceledPaymentNeverExpires', async () => {
        const {
          given,
          paymentProvider,
          paymentId,
          cancelPayment,
          authorizedPayment,
        } = aPayment();

        await given(...authorizedPayment, send(cancelPayment))
          .when(timePasses(sevenDaysInMs))
          .then(expectNothingPublished(), () =>
            expect(paymentProvider.callsFor(paymentId)).toEqual(['cancel']),
          );
      });

      it('aCapturedPaymentNeverExpires', async () => {
        const { given, paymentProvider, paymentId, capturedPayment } =
          aPayment();

        await given(...capturedPayment)
          .when(timePasses(sevenDaysInMs))
          .then(expectNothingPublished(), () =>
            expect(paymentProvider.callsFor(paymentId)).toEqual([
              `capture:${amount}`,
            ]),
          );
      });

      it('capturingAfterTheAuthorizationExpiredAsksNobody', async () => {
        const {
          given,
          paymentProvider,
          paymentId,
          capturePayment,
          authorizedPayment,
        } = aPayment();

        await given(...authorizedPayment, timePasses(sevenDaysInMs))
          .when(send(capturePayment))
          .then(expectNothingPublished(), () =>
            expect(paymentProvider.callsFor(paymentId)).toEqual([]),
          );
      });
    });
  },
);

describe('payment sandbox checkout page', () => {
  const sevenDaysInMs = 7 * oneDayInMs;
  const checkoutExpiryInMs = 30 * 60 * 1000;

  const shopApplication = shopTestApplication({
    modules: ['orders', 'payments'],
  });

  const shop = () => {
    const application = shopApplication;
    const requests = shopRequests(application.fetch);
    const now = application.clock.now().toISOString();
    const customer = aCustomer();
    const cartId = ShoppingCartId.of(customer.id, 1);
    const orderId = OrderId.derivedFrom(cartId);
    const orderNumber = OrderId.numberOf(orderId);
    const paymentId = PaymentId.derivedFrom(orderId);
    const checkedOut: ShoppingCartCheckedOutExternal = {
      type: 'shopping_carts.external.ShoppingCartCheckedOut',
      data: {
        cartId,
        customerId: customer.id,
        productItems: [
          { productId: trailRunningShoes.id, quantity: 2, unitPrice: 100 },
        ],
        totalPrice: 200,
        checkedOutAt: now,
      },
    };
    const session = capturingLocationOf(
      payNow(customer.id, orderNumber, PaymentId.tailOf(paymentId)),
    );
    const paying = (cardNumber: string) =>
      session.followedBy((location) =>
        requests.postForm(location, { cardNumber }),
      );

    return {
      ...application,
      ...requests,
      placedOrder: send(checkedOut),
      payingNow: session.request,
      checkoutPage: session.followedBy((location) =>
        requests.getPage(location),
      ),
      paying,
      orderPage: orderPageOf(customer.id, orderNumber),
      orderStatus: (expected: Record<string, unknown>) =>
        orderStatusIs(application.fetch, customer.id, orderNumber, expected),
    };
  };

  it('theCheckoutPageShowsTheAmountAndTheTestCards', () => {
    const { given, placedOrder, payingNow, checkoutPage } = shop();

    return given(placedOrder, payingNow)
      .when(checkoutPage)
      .then(
        expectResponse(200),
        htmlContaining('Pay $200.00', '4242 4242 4242 4242'),
      );
  });

  it('card4242ConfirmsAndRedirects', () => {
    const { given, placedOrder, payingNow, paying, orderPage } = shop();

    return given(placedOrder, payingNow)
      .when(paying(sandboxSuccessCard))
      .then(expectResponse(303), redirectsTo(orderPage));
  });

  it('anAuthorizationConfirmedByTheSandboxHoldsForSevenDays', () => {
    const { given, placedOrder, payingNow, paying, orderStatus } = shop();

    return given(
      placedOrder,
      payingNow,
      paying(sandboxSuccessCard),
      timePasses(sevenDaysInMs - 1),
    )
      .when(timePasses(0))
      .then(orderStatus({ progress: 'Processing' }));
  });

  it('anAuthorizationConfirmedByTheSandboxExpiresAfterSevenDays', () => {
    const { given, placedOrder, payingNow, paying, orderStatus } = shop();

    return given(placedOrder, payingNow, paying(sandboxSuccessCard))
      .when(timePasses(sevenDaysInMs))
      .then(orderStatus({ progress: 'PaymentFailed' }));
  });

  it('card0002IsDeclinedAndNothingChanges', () => {
    const { given, placedOrder, payingNow, paying, orderStatus } = shop();

    return given(placedOrder, payingNow)
      .when(paying(sandboxDeclinedCard))
      .then(
        expectResponse(200),
        htmlContaining('Your card was declined.'),
        orderStatus({ progress: 'AwaitingPayment' }),
      );
  });

  it('anUnknownCardAsksForATestCard', () => {
    const { given, placedOrder, payingNow, paying } = shop();

    return given(placedOrder, payingNow)
      .when(paying('1234123412341234'))
      .then(
        expectResponse(200),
        htmlContaining('Use a test card'),
        htmlNotContaining('Your card was declined.'),
      );
  });

  it('anExpiredSessionCannotBePaid', () => {
    const { given, placedOrder, payingNow, paying } = shop();

    return given(placedOrder, payingNow, timePasses(checkoutExpiryInMs + 1))
      .when(paying(sandboxSuccessCard))
      .then(htmlContaining('This checkout session has expired'));
  });

  it('anUnknownCheckoutSessionAnswers404', () => {
    const { given, getPage } = shop();

    return given()
      .when(getPage(`/sandbox/checkout/${randomUUID()}`))
      .then(expectResponse(404));
  });
});
