import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  cartSchema,
  customerOrderSchema,
  orderStatusSchema,
  problemDetailsSchema,
  productItemSchema,
} from './httpContracts';

type MessageType = 'query' | 'command';

const customerId = z.string().describe('Id of the customer');
const orderId = z.string().describe('Number of the order of the customer');
const cartParameters = z.object({ customerId });
const orderParameters = z.object({ customerId, orderId });
const ifMatch = z
  .string()
  .describe('Weak ETag with the cart version, such as W/"3"');

const problem = (description: string) => ({
  description,
  content: { 'application/problem+json': { schema: problemDetailsSchema } },
});

const shoppingCartsTag = 'Shopping carts';
const ordersTag = 'Orders';

const eventCatalogMessageType = (type: MessageType) => ({
  'x-eventcatalog-message-type': type,
});

const cartPath = '/customers/{customerId}/shopping-carts/current';
const orderPath = '/customers/{customerId}/orders/{orderId}';

const routes = [
  createRoute({
    method: 'get',
    path: cartPath,
    operationId: 'getCurrentShoppingCart',
    summary: 'Get the current shopping cart',
    tags: [shoppingCartsTag],
    ...eventCatalogMessageType('query'),
    request: { params: cartParameters },
    responses: {
      200: {
        description: 'The cart. The ETag header holds its version.',
        content: { 'application/json': { schema: cartSchema } },
      },
      404: problem('The customer has no open cart'),
    },
  }),
  createRoute({
    method: 'post',
    path: `${cartPath}/product-items`,
    operationId: 'addProductItem',
    summary: 'Add a product to the current shopping cart',
    tags: [shoppingCartsTag],
    ...eventCatalogMessageType('command'),
    request: {
      params: cartParameters,
      body: {
        content: { 'application/json': { schema: productItemSchema } },
        required: true,
      },
    },
    responses: {
      200: { description: 'Added. The ETag header holds the new version.' },
      400: problem('The body is not a product item'),
    },
  }),
  createRoute({
    method: 'delete',
    path: `${cartPath}/product-items`,
    operationId: 'removeProductItem',
    summary: 'Remove a product from the current shopping cart',
    tags: [shoppingCartsTag],
    ...eventCatalogMessageType('command'),
    request: {
      params: cartParameters,
      query: z.object({
        productId: z.string(),
        quantity: z.coerce.number().positive(),
      }),
      headers: z.object({ 'If-Match': ifMatch }),
    },
    responses: {
      200: { description: 'Removed. The ETag header holds the new version.' },
      400: problem('The product or the If-Match header is not valid'),
      404: problem('The customer has no open cart'),
      409: problem('The cart does not have this product item'),
      412: problem('The cart version changed'),
    },
  }),
  createRoute({
    method: 'post',
    path: `${cartPath}/checkout`,
    operationId: 'checkOutShoppingCart',
    summary: 'Check out the current shopping cart',
    tags: [shoppingCartsTag],
    ...eventCatalogMessageType('command'),
    request: {
      params: cartParameters,
      headers: z.object({ 'If-Match': ifMatch }),
    },
    responses: {
      202: {
        description:
          'Accepted. The Location header points to the order that follows.',
      },
      409: problem('Prices changed. Read the cart and check out again.'),
      412: problem('The cart version changed'),
    },
  }),
  createRoute({
    method: 'get',
    path: '/customers/{customerId}/orders',
    operationId: 'getCustomerOrders',
    summary: 'List the orders of the customer',
    tags: [ordersTag],
    ...eventCatalogMessageType('query'),
    request: { params: cartParameters },
    responses: {
      200: {
        description: 'The orders',
        content: {
          'application/json': { schema: z.array(customerOrderSchema) },
        },
      },
    },
  }),
  createRoute({
    method: 'get',
    path: orderPath,
    operationId: 'getOrderStatus',
    summary: 'Get the status of an order',
    tags: [ordersTag],
    ...eventCatalogMessageType('query'),
    request: { params: orderParameters },
    responses: {
      200: {
        description:
          'The status. Send If-None-Match to get 304 when unchanged.',
        content: { 'application/json': { schema: orderStatusSchema } },
      },
      304: { description: 'The status did not change' },
      404: problem('The order does not exist'),
    },
  }),
  createRoute({
    method: 'post',
    path: `${orderPath}/cancel`,
    operationId: 'cancelOrder',
    summary: 'Cancel an order',
    tags: [ordersTag],
    ...eventCatalogMessageType('command'),
    request: { params: orderParameters },
    responses: {
      202: { description: 'Accepted' },
      404: problem('The order does not exist'),
      409: problem('The order cannot be canceled'),
    },
  }),
  createRoute({
    method: 'post',
    path: `${orderPath}/retry-payment`,
    operationId: 'retryOrderPayment',
    summary: 'Retry the payment of an order',
    tags: [ordersTag],
    ...eventCatalogMessageType('command'),
    request: { params: orderParameters },
    responses: {
      202: { description: 'Accepted' },
      404: problem('The order does not exist'),
      409: problem('The payment cannot be retried'),
    },
  }),
  createRoute({
    method: 'post',
    path: `${orderPath}/payments/{paymentId}/checkout-session`,
    operationId: 'createCheckoutSession',
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
  }),
];

export const openApiDocument = () => {
  const registry = new OpenAPIHono();
  routes.forEach((route) => registry.openAPIRegistry.registerPath(route));

  return registry.getOpenAPI31Document({
    openapi: '3.1.0',
    info: {
      title: 'E-commerce',
      version: '1.0.0',
      description: 'Shopping carts and orders of the e-commerce sample.',
    },
    tags: [{ name: shoppingCartsTag }, { name: ordersTag }],
  });
};
