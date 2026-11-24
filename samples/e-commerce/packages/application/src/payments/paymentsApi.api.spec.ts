import {
  expectNothingPublished,
  expectPublished,
  send,
  timePasses,
  Urns,
} from '@e-commerce/core';
import { randomUUID } from 'node:crypto';
import { describe, expect } from 'vitest';
import { OrderId } from '../orders/order';
import { ShoppingCartId } from '../shoppingCarts/shoppingCart';
import { failsOnEmmett } from '../knownFailures';
import {
  testedMessagingBuses,
  testApplication,
  type TestedMessagingBus,
} from '../testApplication';
import { paymentExternalEventTypes } from './external/paymentExternalEvent';
import { PaymentId } from './payment';
import type {
  AuthorizePayment,
  CancelPayment,
  CapturePayment,
  ConfirmPaymentAuthorization,
  ConfirmPaymentCapture,
  FailPaymentCapture,
  TimeOutPayment,
} from './paymentCommand';

const now = '2026-01-01T10:00:00.000Z';
const oneDayInMs = 24 * 60 * 60 * 1000;
const sevenDaysInMs = 7 * oneDayInMs;
const after = (milliseconds: number) =>
  new Date(Date.parse(now) + milliseconds).toISOString();
const amount = 62.5;

describe.each(testedMessagingBuses)(
  'payments API on MESSAGING_BUS=%s',
  (bus: TestedMessagingBus) => {
    const paymentsApplication = (signal?: AbortSignal) =>
      testApplication({
        messagingBus: bus,
        publishedTypes: paymentExternalEventTypes,
        modules: ['payments'],
        signal,
      });

    const referenceId = OrderId.derivedFrom(ShoppingCartId.of(randomUUID(), 1));
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
      data: { paymentId },
    };

    const requestedPayment = [send(authorizePayment)];
    const authorizedPayment = [...requestedPayment, send(confirmAuthorization)];
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

    describe('authorizing a payment', () => {
      failsOnEmmett('#432')(
        'authorizingAPaymentAsksTheProviderForNothingAndWaitsForTheConfirmation',
        async (signal) => {
          const { given, paymentProvider } = paymentsApplication(signal);

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
        },
      );

      failsOnEmmett('#432')(
        'authorizingTheSamePaymentAgainChangesNothing',
        (signal) =>
          paymentsApplication(signal)
            .given(...authorizedPayment)
            .when(send(authorizePayment))
            .then(expectNothingPublished()),
      );

      failsOnEmmett('#432')(
        'aConfirmedAuthorizationSendsPaymentAuthorizedKeyedByTheReference',
        (signal) =>
          paymentsApplication(signal)
            .given(...requestedPayment)
            .when(send(confirmAuthorization))
            .then(
              expectPublished({
                type: 'payments.external.PaymentAuthorized',
                data: { referenceId, paymentId, authorizedAt: now },
                metadata: { key },
              }),
            ),
      );

      failsOnEmmett('#432')(
        'confirmingAnAuthorizedPaymentAgainSendsNothing',
        (signal) =>
          paymentsApplication(signal)
            .given(...authorizedPayment)
            .when(send(confirmAuthorization))
            .then(expectNothingPublished()),
      );
    });

    describe('capturing a payment', () => {
      failsOnEmmett('#432')(
        'captureAsksTheProviderAndWaitsForItsConfirmation',
        async (signal) => {
          const { given, paymentProvider } = paymentsApplication(signal);

          await given(...authorizedPayment)
            .when(send(capturePayment))
            .then(expectNothingPublished(), () =>
              expect(paymentProvider.callsFor(paymentId)).toEqual([
                `capture:${amount}`,
              ]),
            );
        },
      );

      failsOnEmmett('#432')(
        'theProvidersConfirmationOfTheCaptureSendsPaymentCaptured',
        async (signal) => {
          const { given, paymentProvider } = paymentsApplication(signal);

          await given(...authorizedPayment, send(capturePayment))
            .when(paymentProvider.confirmsTheCapture(paymentId))
            .then(
              expectPublished({
                type: 'payments.external.PaymentCaptured',
                data: { referenceId, paymentId, capturedAt: now },
                metadata: { key },
              }),
            );
        },
      );

      failsOnEmmett('#432')(
        'aRefusedCaptureFailsThePaymentAndLogsIt',
        async (signal) => {
          const { given, paymentProvider, logs } = paymentsApplication(signal);

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
        },
      );

      failsOnEmmett('#432')(
        'capturingAPaymentThatIsNotAuthorizedAsksNobodyAndLeavesItPending',
        async (signal) => {
          const { given, paymentProvider } = paymentsApplication(signal);

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
        },
      );

      failsOnEmmett('#432')(
        'aFailedCaptureAfterTheCaptureSendsNothing',
        (signal) =>
          paymentsApplication(signal)
            .given(...capturedPayment)
            .when(send(failCapture))
            .then(expectNothingPublished()),
      );
    });

    describe('canceling a payment', () => {
      failsOnEmmett('#432')(
        'cancelingAnAuthorizedPaymentCancelsAtTheProviderWithoutTellingAnyone',
        async (signal) => {
          const { given, paymentProvider } = paymentsApplication(signal);

          await given(...authorizedPayment)
            .when(send(cancelPayment))
            .then(expectNothingPublished(), () =>
              expect(paymentProvider.callsFor(paymentId)).toEqual(['cancel']),
            );
        },
      );

      failsOnEmmett('#432')(
        'authorizationClientLogsWhenTheProviderRefusesToCancel',
        async (signal) => {
          const { given, paymentProvider, logs } = paymentsApplication(signal);

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
        },
      );

      failsOnEmmett('#432')(
        'aCapturedPaymentStaysCapturedWhenCanceled',
        async (signal) => {
          const { given, paymentProvider } = paymentsApplication(signal);

          await given(...capturedPayment)
            .when(send(cancelPayment))
            .then(expectNothingPublished(), () =>
              expect(paymentProvider.callsFor(paymentId)).toEqual([
                `capture:${amount}`,
              ]),
            );
        },
      );
    });

    describe('timing out a payment', () => {
      failsOnEmmett('#432')(
        'after24hAPendingPaymentTimesOutAndItsCheckoutSessionExpires',
        async (signal) => {
          const { given, paymentProvider } = paymentsApplication(signal);

          await given(...requestedPayment)
            .when(timePasses(oneDayInMs))
            .then(expectPublished(paymentFailedAt(after(oneDayInMs))), () =>
              expect(paymentProvider.callsFor(paymentId)).toEqual([
                'expire-checkout-session',
              ]),
            );
        },
      );

      failsOnEmmett('#432')(
        'aPaymentTimesOutEvenWhenTheProviderRefusesToExpireTheCheckoutSession',
        async (signal) => {
          const { given, paymentProvider, logs } = paymentsApplication(signal);

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
        },
      );

      failsOnEmmett('#432')(
        'aPaymentStaysPendingWhenTimedOutEarly',
        async (signal) => {
          const { given, paymentProvider } = paymentsApplication(signal);

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
        },
      );

      failsOnEmmett('#432')(
        'aTimedOutPaymentTimesOutOnlyOnce',
        async (signal) => {
          const { given, paymentProvider } = paymentsApplication(signal);

          await given(...requestedPayment, timePasses(oneDayInMs))
            .when(timePasses(60_000))
            .then(expectNothingPublished(), () =>
              expect(paymentProvider.callsFor(paymentId)).toEqual([
                'expire-checkout-session',
              ]),
            );
        },
      );

      failsOnEmmett('#432')('anAuthorizedPaymentNeverTimesOut', (signal) =>
        paymentsApplication(signal)
          .given(...authorizedPayment)
          .when(timePasses(oneDayInMs))
          .then(expectNothingPublished()),
      );
    });

    describe('expiring an authorization', () => {
      failsOnEmmett('#432')(
        'afterCaptureBeforeAnAuthorizationExpiresAndFailsThePayment',
        (signal) =>
          paymentsApplication(signal)
            .given(...authorizedPayment)
            .when(timePasses(sevenDaysInMs))
            .then(expectPublished(paymentFailedAt(after(sevenDaysInMs)))),
      );

      failsOnEmmett('#432')(
        'anAuthorizationDoesNotExpireBeforeItsDeadline',
        (signal) =>
          paymentsApplication(signal)
            .given(...authorizedPayment)
            .when(timePasses(sevenDaysInMs - 60_000))
            .then(expectNothingPublished()),
      );

      failsOnEmmett('#432')('anExpiredAuthorizationExpiresOnlyOnce', (signal) =>
        paymentsApplication(signal)
          .given(...authorizedPayment, timePasses(sevenDaysInMs))
          .when(timePasses(oneDayInMs))
          .then(expectNothingPublished()),
      );

      failsOnEmmett('#432')('aCanceledPaymentNeverExpires', async (signal) => {
        const { given, paymentProvider } = paymentsApplication(signal);

        await given(...authorizedPayment, send(cancelPayment))
          .when(timePasses(sevenDaysInMs))
          .then(expectNothingPublished(), () =>
            expect(paymentProvider.callsFor(paymentId)).toEqual(['cancel']),
          );
      });

      failsOnEmmett('#432')('aCapturedPaymentNeverExpires', async (signal) => {
        const { given, paymentProvider } = paymentsApplication(signal);

        await given(...capturedPayment)
          .when(timePasses(sevenDaysInMs))
          .then(expectNothingPublished(), () =>
            expect(paymentProvider.callsFor(paymentId)).toEqual([
              `capture:${amount}`,
            ]),
          );
      });

      failsOnEmmett('#432')(
        'capturingAfterTheAuthorizationExpiredAsksNobody',
        async (signal) => {
          const { given, paymentProvider } = paymentsApplication(signal);

          await given(...authorizedPayment, timePasses(sevenDaysInMs))
            .when(send(capturePayment))
            .then(expectNothingPublished(), () =>
              expect(paymentProvider.callsFor(paymentId)).toEqual([]),
            );
        },
      );
    });
  },
);
