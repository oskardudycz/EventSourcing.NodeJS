import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { WebApiSetup } from '@event-driven-io/emmett-honojs';
import { deleteCookie, setCookie } from 'hono/cookie';
import { customerCookie, customerIdOf, signedInCustomer } from './customer';
import { ShopPage, type ShopLinks } from './shopLayout';
import { shopStyles } from './shopStyles';

const htmx = readFileSync(
  createRequire(import.meta.url).resolve('htmx.org/dist/htmx.min.js'),
  'utf8',
);

export const productsPageOf = (customerId: string) =>
  `/shop/customers/${customerId}/products`;

export const shopPages =
  ({ links }: { links: ShopLinks }): WebApiSetup =>
  (router) => {
    router.get('/css/shop.css', (context) =>
      context.body(shopStyles, 200, { 'content-type': 'text/css' }),
    );

    router.get('/assets/htmx.min.js', (context) =>
      context.body(htmx, 200, { 'content-type': 'text/javascript' }),
    );

    router.get('/shop', (context) => {
      const customer = signedInCustomer(context);

      return context.redirect(
        customer ? productsPageOf(customer.id) : '/shop/login',
        303,
      );
    });

    router.get('/shop/login', (context) => {
      const customer = signedInCustomer(context);

      return context.html(
        <ShopPage
          title="Log in"
          links={links}
          customerId={customer?.id}
          customerName={customer?.name}
        >
          <main class="page login">
            <h1>Log in</h1>
            <form class="card" method="post" action="/shop/login">
              <label for="name">Your name</label>
              <input
                id="name"
                name="name"
                required
                autofocus
                autocomplete="name"
                placeholder="Marty McFly"
              />
              <p class="muted">
                There is no password. The same name always opens the same
                orders.
              </p>
              <button class="button primary wide" type="submit">
                Log in
              </button>
            </form>
          </main>
        </ShopPage>,
      );
    });

    router.post('/shop/login', async (context) => {
      const body = await context.req.parseBody();
      const name = typeof body['name'] === 'string' ? body['name'].trim() : '';

      if (name === '') return context.redirect('/shop/login', 303);

      setCookie(context, customerCookie, name, {
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      });

      return context.redirect(productsPageOf(customerIdOf(name)), 303);
    });

    router.post('/shop/logout', (context) => {
      deleteCookie(context, customerCookie, { path: '/' });

      return context.redirect('/shop/login', 303);
    });
  };
