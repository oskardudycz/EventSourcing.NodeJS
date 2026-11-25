import type { Expectation } from '@e-commerce/core';
import {
  HonoTestAgent,
  type TestRequest,
} from '@event-driven-io/emmett-honojs';
import { expect } from 'vitest';
import type { SignedInCustomer } from '../shop/customer';
import type { ShopRequests } from '../shop/shopRequests';
import {
  cancelOrderOf,
  orderPageOf,
  ordersPageOf,
  retryPaymentOf,
} from '../shop/shopUrls';

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

export const orderPagesOf = ({ getPage, postForm }: ShopRequests) => ({
  ordersPage: (customer: SignedInCustomer) =>
    getPage(ordersPageOf(customer.id), { as: customer }),
  orderPage: (customer: SignedInCustomer, orderNumber: string) =>
    getPage(orderPageOf(customer.id, orderNumber), { as: customer }),
  orderPart: (
    customer: SignedInCustomer,
    orderNumber: string,
    seenETag?: string,
  ) =>
    getPage(orderPageOf(customer.id, orderNumber), {
      as: customer,
      headers: {
        'HX-Request': 'true',
        ...(seenETag ? { 'If-None-Match': seenETag } : {}),
      },
    }),
  cancelOnPage: (customer: SignedInCustomer, orderNumber: string) =>
    postForm(cancelOrderOf(customer.id, orderNumber), {}, { as: customer }),
  retryPaymentOnPage: (customer: SignedInCustomer, orderNumber: string) =>
    postForm(retryPaymentOf(customer.id, orderNumber), {}, { as: customer }),
});

export const orderStatusIs =
  (
    fetch: (request: Request) => Response | Promise<Response>,
    customerId: string,
    orderNumber: string,
    expected: Record<string, unknown>,
  ): Expectation =>
  async () => {
    const request = getOrderStatus(
      customerId,
      orderNumber,
    )(new HonoTestAgent({ fetch }));
    const response =
      request instanceof Promise ? await request : await request.execute();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject(expected);
  };
