import { createHash } from 'node:crypto';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';

export const customerCookie = 'customer';

export const customerIdOf = (name: string): string => {
  const bytes = createHash('md5')
    .update(name.trim().toLowerCase())
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x30;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
};

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
      : context.redirect('/shop/login', 303);
  };
