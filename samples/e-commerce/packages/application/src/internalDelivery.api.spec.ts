import {
  expectPublished,
  send,
  timePasses,
  Urns,
  type PublishedMessage,
} from '@e-commerce/core';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'vitest';
import { OrderId } from './orders/order';
import { paymentExternalEventTypes } from './payments/external/paymentExternalEvent';
import { PaymentId } from './payments/payment';
import type { AuthorizePayment } from './payments/paymentCommand';
import { ShoppingCartId } from './shoppingCarts/shoppingCart';
import { testApplication } from './testApplication';

const oneDayInMs = 24 * 60 * 60 * 1000;
const publishedTypes = [
  ...paymentExternalEventTypes,
  'payments.TimeOutPayment',
];

const aPaymentOn = (application: ReturnType<typeof testApplication>) => {
  const aDayLater = new Date(
    application.clock.now().getTime() + oneDayInMs,
  ).toISOString();
  const referenceId = OrderId.derivedFrom(ShoppingCartId.of(randomUUID(), 1));
  const paymentId = PaymentId.derivedFrom(referenceId);
  const key = Urns.routingKeyOf(referenceId);

  const authorizePayment: AuthorizePayment = {
    type: 'payments.AuthorizePayment',
    data: { paymentId, referenceId, amount: 62.5 },
  };

  const timeOutPaymentOnItsInternalChannel: PublishedMessage = {
    type: 'payments.TimeOutPayment',
    data: { paymentId, timedOutAt: aDayLater },
    metadata: { key: Urns.routingKeyOf(paymentId) },
  };

  const paymentFailedAfterADay: PublishedMessage = {
    type: 'payments.external.PaymentFailed',
    data: { referenceId, paymentId, failedAt: aDayLater },
    metadata: { key },
  };

  return {
    ...application.about(paymentId),
    authorizePayment,
    timeOutPaymentOnItsInternalChannel,
    paymentFailedAfterADay,
  };
};

describe('own commands of a module', () => {
  const throughTheStore = testApplication({
    internalDelivery: 'store',
    publishedTypes,
    modules: ['payments'],
  });
  const throughTheBroker = testApplication({
    internalDelivery: 'broker',
    publishedTypes,
    modules: ['payments'],
  });

  it('ownCommandsGoStraightToTheWorkflowInboxWhenDeliveredThroughTheStore', () => {
    const { given, authorizePayment, paymentFailedAfterADay } =
      aPaymentOn(throughTheStore);

    return given(send(authorizePayment))
      .when(timePasses(oneDayInMs))
      .then(expectPublished(paymentFailedAfterADay));
  });

  it('ownCommandsGoThroughPaymentsInternalWhenDeliveredThroughTheBroker', () => {
    const {
      given,
      authorizePayment,
      timeOutPaymentOnItsInternalChannel,
      paymentFailedAfterADay,
    } = aPaymentOn(throughTheBroker);

    return given(send(authorizePayment))
      .when(timePasses(oneDayInMs))
      .then(
        expectPublished(
          timeOutPaymentOnItsInternalChannel,
          paymentFailedAfterADay,
        ),
      );
  });
});
