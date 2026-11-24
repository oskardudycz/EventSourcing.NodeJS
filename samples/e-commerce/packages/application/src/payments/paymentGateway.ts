import type { CheckoutSession } from './payment';

export type CheckoutSessionRequest = {
  paymentId: string;
  amount: number;
  successUrl: string;
  cancelUrl: string;
  expiresAt: string;
};

export type PaymentGateway = {
  createCheckoutSession: (
    request: CheckoutSessionRequest,
  ) => Promise<CheckoutSession>;
  expireCheckoutSession: (paymentId: string) => Promise<void>;
  capture: (paymentId: string, amount: number) => Promise<void>;
  cancel: (paymentId: string) => Promise<void>;
};
