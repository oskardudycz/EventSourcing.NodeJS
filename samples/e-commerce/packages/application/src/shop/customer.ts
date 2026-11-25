import { v5 } from 'uuid';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';

import { loginPage } from './shopUrls';

export const customerCookie = 'customer';

const customerNamespace = '6f1d3a52-0c5e-4b8a-9d61-1f3c2a7e9b00';

export const customerIdOf = (name: string): string =>
  v5(name.trim().toLowerCase(), customerNamespace);

export type SignedInCustomer = { name: string; id: string };

export const signedInCustomer = (
  context: Context,
): SignedInCustomer | undefined => {
  const name = getCookie(context, customerCookie);

  return name ? { name, id: customerIdOf(name) } : undefined;
};

export const customerPage =
  (
    handle: (
      context: Context,
      customer: SignedInCustomer,
    ) => Response | Promise<Response>,
  ) =>
  (context: Context): Response | Promise<Response> => {
    const customer = signedInCustomer(context);

    return customer && customer.id === context.req.param('customerId')
      ? handle(context, customer)
      : context.redirect(loginPage, 303);
  };
