import { newerThan, retryIfNotFound } from '@e-commerce/core';
import { NotFoundError, assertNotEmptyString } from '@event-driven-io/emmett';
import { Accepted, type WebApiSetup } from '@event-driven-io/emmett-honojs';
import { PaymentId } from '../payments/payment';
import type { PaymentCheckoutSessions } from '../payments/paymentCheckoutSessions';
import type { CustomerOrders } from './getCustomerOrders/customerOrders';
import type { OrderStatuses } from './getOrderStatus/orderStatuses';
import { OrderId } from './order';
import type { OrderWorkflowInput } from './orderWorkflow';

const basePath = '/customers/:customerId/orders';

const unknownOrder = (orderId: string) =>
  new NotFoundError({ type: 'Order', id: orderId });

export const ordersApi =
  (dependencies: {
    sendToOrder: (command: OrderWorkflowInput) => Promise<unknown>;
    payments: Pick<PaymentCheckoutSessions, 'createCheckoutSession'>;
    customerOrders: CustomerOrders;
    orderStatuses: OrderStatuses;
  }): WebApiSetup =>
  (router) => {
    const { sendToOrder, payments, customerOrders, orderStatuses } =
      dependencies;

    const findStatus = async (customerId: string, orderNumber: string) => {
      const status = await orderStatuses.get(
        OrderId.of(`${customerId}-${orderNumber}`),
      );

      return status?.customerId === customerId ? status : null;
    };

    const statusOf = async (customerId: string, orderId: string) => {
      const status = await retryIfNotFound(() =>
        findStatus(customerId, orderId),
      );

      if (!status) throw unknownOrder(orderId);

      return status;
    };

    router.get(basePath, async (context) =>
      context.json(
        await customerOrders.of(
          assertNotEmptyString(context.req.param('customerId')),
        ),
      ),
    );

    router.get(`${basePath}/:orderId`, (context) => {
      const customerId = assertNotEmptyString(context.req.param('customerId'));
      const orderId = assertNotEmptyString(context.req.param('orderId'));

      return newerThan(context, () => findStatus(customerId, orderId), {
        whenMissing: () => unknownOrder(orderId),
      });
    });

    router.post(`${basePath}/:orderId/cancel`, async (context) => {
      const customerId = assertNotEmptyString(context.req.param('customerId'));
      const orderNumber = assertNotEmptyString(context.req.param('orderId'));
      const { orderId } = await statusOf(customerId, orderNumber);

      await sendToOrder({
        type: 'orders.CancelOrder',
        data: {
          orderId,
          cancellationReason: 'Requested',
        },
      });

      return Accepted({
        context,
        location: `/customers/${customerId}/orders/${orderNumber}`,
      });
    });

    router.post(`${basePath}/:orderId/retry-payment`, async (context) => {
      const customerId = assertNotEmptyString(context.req.param('customerId'));
      const orderNumber = assertNotEmptyString(context.req.param('orderId'));
      const { orderId } = await statusOf(customerId, orderNumber);

      await sendToOrder({
        type: 'orders.RetryOrderPayment',
        data: { orderId },
      });

      return Accepted({
        context,
        location: `/customers/${customerId}/orders/${orderNumber}`,
      });
    });

    router.post(
      `${basePath}/:orderId/payments/:paymentId/checkout-session`,
      async (context) => {
        const customerId = assertNotEmptyString(
          context.req.param('customerId'),
        );
        const orderNumber = assertNotEmptyString(context.req.param('orderId'));
        const paymentNumber = assertNotEmptyString(
          context.req.param('paymentId'),
        );
        const { orderId } = await statusOf(customerId, orderNumber);
        const orderStatusPage = `${new URL(context.req.url).origin}/shop/customers/${customerId}/orders/${orderNumber}`;

        const session = await payments.createCheckoutSession({
          paymentId: PaymentId.of(paymentNumber),
          referenceId: orderId,
          successUrl: orderStatusPage,
          cancelUrl: orderStatusPage,
        });

        return context.redirect(session.url, 303);
      },
    );
  };
