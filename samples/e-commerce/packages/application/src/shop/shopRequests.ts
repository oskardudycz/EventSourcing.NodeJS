import type { Expectation } from '@e-commerce/core';
import { HonoResponse, type TestRequest } from '@event-driven-io/emmett-honojs';
import { expect } from 'vitest';
import { customerIdOf, type SignedInCustomer } from './customer';
import { loginPage, productsPageOf } from './shopUrls';

type Fetch = (request: Request) => Response | Promise<Response>;

export type PageRequest = () => Promise<HonoResponse>;

type PageOptions = {
  as?: SignedInCustomer | string;
  headers?: Record<string, string>;
};

export const aCustomer = (): SignedInCustomer => {
  const name = `Marty ${crypto.randomUUID().slice(0, 8)}`;

  return { name, id: customerIdOf(name) };
};

const cookieOf = (as: SignedInCustomer | string) =>
  `customer=${encodeURIComponent(typeof as === 'string' ? as : as.name)}`;

export const locationIs =
  (location: string): Expectation =>
  ({ response }) =>
    expect(response?.headers['location']).toBe(location);

export const capturingLocationOf = (request: TestRequest) => {
  let location = '';

  return {
    request: (async (agent) => {
      const result = request(agent);
      const response =
        result instanceof Promise ? await result : await result.execute();

      location = response.headers['location'] ?? '';

      return response;
    }) satisfies TestRequest,
    followedBy:
      (next: (location: string) => PageRequest): PageRequest =>
      () =>
        next(location)(),
  };
};

export const measured = (request: PageRequest) => {
  let tookInMs = 0;

  return {
    request: async () => {
      const startedAt = Date.now();
      const response = await request();

      tookInMs = Date.now() - startedAt;

      return response;
    },
    tookInMs: () => tookInMs,
  };
};

export const shopRequests = (fetch: Fetch) => {
  const call =
    (
      method: 'GET' | 'POST',
      path: string,
      { as, headers = {} }: PageOptions,
      form?: Record<string, string>,
    ): PageRequest =>
    async () =>
      new HonoResponse(
        await fetch(
          new Request(`http://localhost${path}`, {
            method,
            headers: {
              ...(as ? { cookie: cookieOf(as) } : {}),
              ...(form
                ? { 'content-type': 'application/x-www-form-urlencoded' }
                : {}),
              ...headers,
            },
            ...(form ? { body: new URLSearchParams(form).toString() } : {}),
          }),
        ),
      );

  const getPage = (path: string, options: PageOptions = {}) =>
    call('GET', path, options);
  const postForm = (
    path: string,
    form: Record<string, string> = {},
    options: PageOptions = {},
  ) => call('POST', path, options, form);

  return {
    getPage,
    postForm,
    openTheShop: (as?: SignedInCustomer) => getPage('/shop', as ? { as } : {}),
    loginPage: () => getPage(loginPage),
    logsIn: (name: string) => postForm(loginPage, { name }),
    logsOut: (as: SignedInCustomer) => postForm('/shop/logout', {}, { as }),
    productsPage: (customer: SignedInCustomer) =>
      getPage(productsPageOf(customer.id), { as: customer }),
  };
};

export type ShopRequests = ReturnType<typeof shopRequests>;
