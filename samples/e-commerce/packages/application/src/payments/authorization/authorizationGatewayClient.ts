import type { Logger } from 'pino';
import type { PaymentCanceled, PaymentTimedOut } from '../payment';
import type { PaymentGateway } from '../paymentGateway';

export const authorizationGatewayClient =
  ({ gateway, logger }: { gateway: PaymentGateway; logger: Logger }) =>
  async ({
    type,
    data: { paymentId },
  }: PaymentCanceled | PaymentTimedOut): Promise<void> => {
    try {
      await (type === 'payments.PaymentCanceled'
        ? gateway.cancel(paymentId)
        : gateway.expireCheckoutSession(paymentId));
    } catch (error) {
      logger.error(
        { err: error, paymentId },
        type === 'payments.PaymentCanceled'
          ? `Canceling payment ${paymentId} failed`
          : `Expiring the checkout session of payment ${paymentId} failed`,
      );
    }
  };
