import { newerThan, retryIfNotFound } from '@e-commerce/core';
import { NotFoundError, assertNotEmptyString } from '@event-driven-io/emmett';
import { Accepted } from '@event-driven-io/emmett-honojs';
import { createRoute } from '@hono/zod-openapi';
import {
  eventCatalogMessageType,
  openApiRouter,
  problem,
  z,
} from '../documentation/openApi';
import { PaymentId } from '../payments/payment';
import type { PaymentCheckoutSessions } from '../payments/paymentCheckoutSessions';
import type { CustomerOrders } from './getCustomerOrders/customerOrders';
import type { OrderStatuses } from './getOrderStatus/orderStatuses';
import { orderPageOf } from '../shop/shopUrls';
import { publicOrderStatusOf } from './getOrderStatus/orderStatuses';
import { OrderId } from './order';
import { customerOrderSchema, orderStatusSchema } from './orderContracts';
import type { OrderWorkflowInput } from './orderWorkflow';

export const ordersTag = 'Orders';

const basePath = '/customers/{customerId}/orders';
const orderPath = `${basePath}/{orderId}`;

const customerParameters = z.object({
  customerId: z.uuid().describe('Id of the customer'),
});
const orderParameters = customerParameters.extend({
  orderId: z.string().describe('Number of the order of the customer'),
});

const getCustomerOrdersRoute = createRoute({
  method: 'get',
  path: basePath,
  operationId: 'CustomerOrders',
  summary: 'List the orders of the customer',
  tags: [ordersTag],
  ...eventCatalogMessageType('query'),
  request: { params: customerParameters },
  responses: {
    200: {
      description: 'The orders',
      content: {
        'application/json': { schema: z.array(customerOrderSchema) },
      },
    },
  },
});

const getOrderStatusRoute = createRoute({
  method: 'get',
  path: orderPath,
  operationId: 'OrderStatus',
  summary: 'Get the status of an order',
  tags: [ordersTag],
  ...eventCatalogMessageType('query'),
  request: {
    params: orderParameters,
    headers: z.object({
      'If-None-Match': z
        .string()
        .optional()
        .describe('Weak ETag of the version already seen, such as W/"3"'),
    }),
  },
  responses: {
    200: {
      description: 'The status. Send If-None-Match to get 304 when unchanged.',
      content: { 'application/json': { schema: orderStatusSchema } },
    },
    304: { description: 'The status did not change' },
    404: problem('The order does not exist'),
  },
});

const cancelOrderRoute = createRoute({
  method: 'post',
  path: `${orderPath}/cancel`,
  operationId: 'CancelOrder',
  summary: 'Cancel an order',
  tags: [ordersTag],
  ...eventCatalogMessageType('command'),
  request: { params: orderParameters },
  responses: {
    202: { description: 'Accepted' },
    404: problem('The order does not exist'),
    409: problem('The order cannot be canceled'),
  },
});

const retryOrderPaymentRoute = createRoute({
  method: 'post',
  path: `${orderPath}/retry-payment`,
  operationId: 'RetryOrderPayment',
  summary: 'Retry the payment of an order',
  tags: [ordersTag],
  ...eventCatalogMessageType('command'),
  request: { params: orderParameters },
  responses: {
    202: { description: 'Accepted' },
    404: problem('The order does not exist'),
    409: problem('The payment cannot be retried'),
  },
});

const createCheckoutSessionRoute = createRoute({
  method: 'post',
  path: `${orderPath}/payments/{paymentId}/checkout-session`,
  operationId: 'CreateCheckoutSession',
  summary: 'Pay now: start a checkout session of the payment provider',
  tags: [ordersTag],
  ...eventCatalogMessageType('command'),
  request: {
    params: orderParameters.extend({
      paymentId: z.string().describe('Number of the payment of the order'),
    }),
  },
  responses: {
    303: { description: 'Redirects to the checkout page of the provider' },
    404: problem('The order does not exist'),
    502: problem('The payment provider failed'),
  },
});

const unknownOrder = (orderId: string) =>
  new NotFoundError({ type: 'Order', id: orderId });

export const ordersApi = (dependencies: {
  sendToOrder: (command: OrderWorkflowInput) => Promise<unknown>;
  payments: Pick<PaymentCheckoutSessions, 'createCheckoutSession'>;
  customerOrders: CustomerOrders;
  orderStatuses: OrderStatuses;
}) => {
  const api = openApiRouter();
  const { sendToOrder, payments, customerOrders, orderStatuses } = dependencies;

  const findStatus = async (customerId: string, orderNumber: string) => {
    const status = await orderStatuses.get(
      OrderId.of(`${customerId}-${orderNumber}`),
    );

    return status?.customerId === customerId ? status : null;
  };

  const statusOf = async (customerId: string, orderId: string) => {
    const status = await retryIfNotFound(() => findStatus(customerId, orderId));

    if (!status) throw unknownOrder(orderId);

    return status;
  };

  api.openapi(getCustomerOrdersRoute, async (context) =>
    context.json(
      await customerOrders.of(
        assertNotEmptyString(context.req.param('customerId')),
      ),
    ),
  );

  api.openapi(getOrderStatusRoute, (context) => {
    const customerId = assertNotEmptyString(context.req.param('customerId'));
    const orderId = assertNotEmptyString(context.req.param('orderId'));

    return newerThan(
      context,
      async () => {
        const status = await findStatus(customerId, orderId);

        return status && publicOrderStatusOf(status);
      },
      { whenMissing: () => unknownOrder(orderId) },
    );
  });

  api.openapi(cancelOrderRoute, async (context) => {
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

  api.openapi(retryOrderPaymentRoute, async (context) => {
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

  api.openapi(createCheckoutSessionRoute, async (context) => {
    const customerId = assertNotEmptyString(context.req.param('customerId'));
    const orderNumber = assertNotEmptyString(context.req.param('orderId'));
    const paymentNumber = assertNotEmptyString(context.req.param('paymentId'));
    const { orderId } = await statusOf(customerId, orderNumber);
    const orderStatusPage = `${new URL(context.req.url).origin}${orderPageOf(customerId, orderNumber)}`;

    const session = await payments.createCheckoutSession({
      paymentId: PaymentId.of(paymentNumber),
      referenceId: orderId,
      successUrl: orderStatusPage,
      cancelUrl: orderStatusPage,
    });

    return context.redirect(session.url, 303);
  });

  return api;
};
