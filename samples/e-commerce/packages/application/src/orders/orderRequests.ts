import type { TestRequest } from '@event-driven-io/emmett-honojs';

const ordersPath = (customerId: string) => `/customers/${customerId}/orders`;

export const getOrders =
  (customerId: string): TestRequest =>
  (request) =>
    request.get(ordersPath(customerId));

export const getOrderStatus =
  (customerId: string, orderNumber: string, seenETag?: string): TestRequest =>
  (request) => {
    const call = request.get(`${ordersPath(customerId)}/${orderNumber}`);
    return seenETag === undefined
      ? call
      : call.set({ 'If-None-Match': seenETag });
  };

export const cancelOrder =
  (customerId: string, orderNumber: string): TestRequest =>
  (request) =>
    request.post(`${ordersPath(customerId)}/${orderNumber}/cancel`);

export const retryOrderPayment =
  (customerId: string, orderNumber: string): TestRequest =>
  (request) =>
    request.post(`${ordersPath(customerId)}/${orderNumber}/retry-payment`);

export const payNow =
  (
    customerId: string,
    orderNumber: string,
    paymentNumber: string,
  ): TestRequest =>
  (request) =>
    request.post(
      `${ordersPath(customerId)}/${orderNumber}/payments/${paymentNumber}/checkout-session`,
    );
