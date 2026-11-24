import {
  action,
  send,
  type ActionStep,
  type MessagesStep,
} from '@e-commerce/core';
import type { CheckoutSession } from './payment';
import { PaymentId } from './payment';
import type { PaymentGateway } from './paymentGateway';

export type PaymentProvider = PaymentGateway & {
  isUnreachableFor: (paymentId: string) => ActionStep;
  refusesEverythingAfterAuthorizing: (paymentId: string) => ActionStep;
  refusesTheFirstCaptureOf: (paymentId: string) => ActionStep;
  confirmsTheCapture: (paymentId: string) => MessagesStep;
  callsFor: (paymentId: string) => string[];
};

export const checkoutPageOf = (paymentId: string): string =>
  `https://checkout.example/c/pay/${PaymentId.tailOf(paymentId)}`;

export const paymentProvider = (): PaymentProvider => {
  const calls = new Map<string, string[]>();
  const unreachable = new Set<string>();
  const refusingAfterAuthorization = new Set<string>();
  const refusingFirstCapture = new Set<string>();

  const record = (paymentId: string, call: string) =>
    calls.set(paymentId, [...(calls.get(paymentId) ?? []), call]);

  const answer = <Result>(refused: boolean, result: Result): Promise<Result> =>
    refused
      ? Promise.reject(new Error('Payment provider is unreachable'))
      : Promise.resolve(result);

  return {
    isUnreachableFor: (paymentId) =>
      action(() => {
        unreachable.add(paymentId);
      }),
    refusesEverythingAfterAuthorizing: (paymentId) =>
      action(() => {
        refusingAfterAuthorization.add(paymentId);
      }),
    refusesTheFirstCaptureOf: (paymentId) =>
      action(() => {
        refusingFirstCapture.add(paymentId);
      }),
    confirmsTheCapture: (paymentId) =>
      send({ type: 'payments.ConfirmPaymentCapture', data: { paymentId } }),
    callsFor: (paymentId) => calls.get(paymentId) ?? [],
    createCheckoutSession: ({
      paymentId,
      amount,
      successUrl,
      cancelUrl,
      expiresAt,
    }): Promise<CheckoutSession> => {
      record(
        paymentId,
        `checkout-session:${amount}:${successUrl}:${cancelUrl}:${expiresAt}`,
      );

      return answer(unreachable.has(paymentId), {
        url: checkoutPageOf(paymentId),
        expiresAt,
      });
    },
    expireCheckoutSession: (paymentId) => {
      record(paymentId, 'expire-checkout-session');

      return answer(
        unreachable.has(paymentId) || refusingAfterAuthorization.has(paymentId),
        undefined,
      );
    },
    capture: (paymentId, amount) => {
      record(paymentId, `capture:${amount}`);

      return answer(
        unreachable.has(paymentId) ||
          refusingAfterAuthorization.has(paymentId) ||
          refusingFirstCapture.delete(paymentId),
        undefined,
      );
    },
    cancel: (paymentId) => {
      record(paymentId, 'cancel');

      return answer(
        unreachable.has(paymentId) || refusingAfterAuthorization.has(paymentId),
        undefined,
      );
    },
  };
};
