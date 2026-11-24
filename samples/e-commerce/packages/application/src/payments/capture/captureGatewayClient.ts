import type { Logger } from 'pino';
import type { PaymentCaptureRequested } from '../payment';
import type { FailPaymentCapture } from '../paymentCommand';
import type { PaymentGateway } from '../paymentGateway';

export const captureGatewayClient =
  ({ gateway, logger }: { gateway: PaymentGateway; logger: Logger }) =>
  async ({ data }: PaymentCaptureRequested): Promise<FailPaymentCapture[]> => {
    try {
      await gateway.capture(data.paymentId, data.amount);

      return [];
    } catch (error) {
      logger.error(
        { err: error, paymentId: data.paymentId },
        `Capturing payment ${data.paymentId} failed`,
      );

      return [
        {
          type: 'payments.FailPaymentCapture',
          data: { paymentId: data.paymentId, reason: 'UnexpectedError' },
        },
      ];
    }
  };
