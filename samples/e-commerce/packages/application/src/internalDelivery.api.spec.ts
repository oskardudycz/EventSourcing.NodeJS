import {
  expectPublished,
  send,
  timePasses,
  Urns,
  type PublishedMessage,
} from '@e-commerce/core';
import { randomUUID } from 'node:crypto';
import { describe } from 'vitest';
import { failsOnEmmett } from './knownFailures';
import { OrderId } from './orders/order';
import { paymentExternalEventTypes } from './payments/external/paymentExternalEvent';
import { PaymentId } from './payments/payment';
import type { AuthorizePayment } from './payments/paymentCommand';
import { ShoppingCartId } from './shoppingCarts/shoppingCart';
import { testApplication } from './testApplication';

const now = '2026-01-01T10:00:00.000Z';
const oneDayInMs = 24 * 60 * 60 * 1000;
const referenceId = OrderId.derivedFrom(ShoppingCartId.of(randomUUID(), 1));
const paymentId = PaymentId.derivedFrom(referenceId);
const key = Urns.routingKeyOf(referenceId);

const authorizePayment: AuthorizePayment = {
  type: 'payments.AuthorizePayment',
  data: { paymentId, referenceId, amount: 62.5 },
};

const timeOutPaymentOnItsInternalChannel: PublishedMessage = {
  type: 'payments.TimeOutPayment',
  data: { paymentId },
  metadata: { key: Urns.routingKeyOf(paymentId) },
};

const paymentFailedAfterADay: PublishedMessage = {
  type: 'payments.external.PaymentFailed',
  data: {
    referenceId,
    paymentId,
    failedAt: new Date(Date.parse(now) + oneDayInMs).toISOString(),
  },
  metadata: { key },
};

describe('own commands of a module', () => {
  failsOnEmmett('#432')(
    'ownCommandsGoStraightToTheWorkflowInboxWhenDeliveredThroughTheStore',
    (signal) =>
      testApplication({
        internalDelivery: 'store',
        publishedTypes: [
          ...paymentExternalEventTypes,
          'payments.TimeOutPayment',
        ],
        modules: ['payments'],
        signal,
      })
        .given(send(authorizePayment))
        .when(timePasses(oneDayInMs))
        .then(expectPublished(paymentFailedAfterADay)),
  );

  failsOnEmmett('#432')(
    'ownCommandsGoThroughPaymentsInternalWhenDeliveredThroughTheBroker',
    (signal) =>
      testApplication({
        internalDelivery: 'broker',
        publishedTypes: [
          ...paymentExternalEventTypes,
          'payments.TimeOutPayment',
        ],
        modules: ['payments'],
        signal,
      })
        .given(send(authorizePayment))
        .when(timePasses(oneDayInMs))
        .then(
          expectPublished(
            timeOutPaymentOnItsInternalChannel,
            paymentFailedAfterADay,
          ),
        ),
  );
});
