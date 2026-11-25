import type { CheckoutSession } from '../payment';
import type { CheckoutSessionRequest, PaymentGateway } from '../paymentGateway';
import type {
  ConfirmPaymentAuthorization,
  ConfirmPaymentCapture,
} from '../paymentCommand';

export const sandboxSuccessCard = '4242424242424242';
export const sandboxDeclinedCard = '4000000000000002';

const authorizationValidityInMs = 7 * 24 * 60 * 60 * 1000;

export type SandboxCheckout = {
  id: string;
  paymentId: string;
  amount: number;
  successUrl: string;
  cancelUrl: string;
  expiresAt: string;
  expired: boolean;
};

export type CardOutcome = 'Paid' | 'Declined' | 'Expired' | 'UnknownCard';

export type SandboxPaymentGateway = PaymentGateway & {
  checkout: (sessionId: string) => SandboxCheckout | undefined;
  checkoutOf: (paymentId: string) => SandboxCheckout | undefined;
  pay: (checkout: SandboxCheckout, cardNumber: string) => Promise<CardOutcome>;
  refuseNextCaptureOf: (paymentId: string) => void;
};

export const sandboxPaymentGateway = ({
  deliver,
  now,
}: {
  deliver: (
    command: ConfirmPaymentAuthorization | ConfirmPaymentCapture,
  ) => Promise<unknown>;
  now: () => Date;
}): SandboxPaymentGateway => {
  const checkouts = new Map<string, SandboxCheckout>();
  const refusingNextCapture = new Set<string>();

  const checkoutOf = (paymentId: string) =>
    [...checkouts.values()].findLast(
      (checkout) => checkout.paymentId === paymentId,
    );

  return {
    checkout: (sessionId) => checkouts.get(sessionId),
    checkoutOf,
    createCheckoutSession: ({
      paymentId,
      amount,
      successUrl,
      cancelUrl,
      expiresAt,
    }: CheckoutSessionRequest): Promise<CheckoutSession> => {
      const id = crypto.randomUUID();
      checkouts.set(id, {
        id,
        paymentId,
        amount,
        successUrl,
        cancelUrl,
        expiresAt,
        expired: false,
      });

      return Promise.resolve({ url: `/sandbox/checkout/${id}`, expiresAt });
    },
    expireCheckoutSession: (paymentId) => {
      for (const [id, checkout] of checkouts)
        if (checkout.paymentId === paymentId)
          checkouts.set(id, { ...checkout, expired: true });

      return Promise.resolve();
    },
    refuseNextCaptureOf: (paymentId) => void refusingNextCapture.add(paymentId),
    capture: async (paymentId) => {
      if (refusingNextCapture.delete(paymentId))
        throw new Error('The sandbox refuses the capture');

      await deliver({
        type: 'payments.ConfirmPaymentCapture',
        data: { paymentId },
      });
    },
    cancel: () => Promise.resolve(),
    pay: async (checkout, cardNumber) => {
      const paidAt = now();

      if (checkout.expired || paidAt >= new Date(checkout.expiresAt))
        return 'Expired';

      switch (cardNumber.replaceAll(/\s/g, '')) {
        case sandboxSuccessCard:
          await deliver({
            type: 'payments.ConfirmPaymentAuthorization',
            data: {
              paymentId: checkout.paymentId,
              captureBefore: new Date(
                paidAt.getTime() + authorizationValidityInMs,
              ).toISOString(),
            },
          });
          return 'Paid';
        case sandboxDeclinedCard:
          return 'Declined';
        default:
          return 'UnknownCard';
      }
    },
  };
};
