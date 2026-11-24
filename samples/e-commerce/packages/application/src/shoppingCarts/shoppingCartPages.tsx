import { retryUntil } from '@e-commerce/core';
import {
  ConcurrencyError,
  IllegalStateError,
} from '@event-driven-io/emmett';
import type { WebApiSetup } from '@event-driven-io/emmett-honojs';
import { OrderId } from '../orders/order';
import { customerPage } from '../shop/customer';
import { demoProductName, demoProducts } from '../shop/demoProducts';
import { formatPrice, ShopPage, type ShopLinks } from '../shop/shopLayout';
import type { CustomerShoppingCarts } from './currentCart/customerShoppingCarts';
import type { Carts } from './getCart/carts';
import type { ProductPriceCalculator } from './pricing/productPriceCalculator';
import { assertProductItem } from './productItems';
import type { ShoppingCartFacade } from './shoppingCartFacade';

const messages = {
  changed: 'Your cart has changed. Check it and try again.',
  prices: 'Some prices have changed. Check the new prices and check out again.',
} as const;

const isMessage = (value: string | undefined): value is keyof typeof messages =>
  value !== undefined && value in messages;

const cartPageOf = (customerId: string, query = '') =>
  `/shop/customers/${customerId}/cart${query}`;

const isConflict = (error: unknown) =>
  error instanceof ConcurrencyError || error instanceof IllegalStateError;

export const shoppingCartPages =
  ({
    shoppingCarts,
    customerShoppingCarts,
    carts,
    prices,
    links,
  }: {
    shoppingCarts: ShoppingCartFacade;
    customerShoppingCarts: CustomerShoppingCarts;
    carts: Carts;
    prices: ProductPriceCalculator;
    links: ShopLinks;
  }): WebApiSetup =>
  (router) => {
    const cartOf = async (customerId: string) => {
      const cartId = await customerShoppingCarts.currentOf(customerId);

      return cartId ? carts.get(cartId) : null;
    };

    router.get(
      '/shop/customers/:customerId/products',
      customerPage(async (context, customer) => {
        const cart = await cartOf(customer.id);

        return context.html(
          <ShopPage
            title="Products"
            links={links}
            customerId={customer.id}
            customerName={customer.name}
            current="products"
          >
            <main class="page">
              <div class="page-title">
                <h1>Products</h1>
                <a class="button" href={cartPageOf(customer.id)}>
                  Cart ({cart?.lines.length ?? 0})
                </a>
              </div>
              <div class="grid">
                {demoProducts.map((product) => (
                  <article class="card product">
                    <h2>{product.name}</h2>
                    <p class="muted">{product.description}</p>
                    <p class="price">
                      {formatPrice(
                        prices.calculate({
                          productId: product.id,
                          quantity: 1,
                        }).unitPrice,
                      )}
                    </p>
                    <form
                      method="post"
                      action={`/shop/customers/${customer.id}/cart/items`}
                    >
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="quantity" value="1" />
                      <button class="button primary" type="submit">
                        Add to cart
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            </main>
          </ShopPage>,
        );
      }),
    );

    router.post(
      '/shop/customers/:customerId/cart/items',
      customerPage(async (context, customer) => {
        const body = await context.req.parseBody();
        const version = await shoppingCarts.addProductItem(
          customer.id,
          assertProductItem({
            productId: body['productId'],
            quantity: Number(body['quantity']),
          }),
        );

        return context.redirect(
          cartPageOf(customer.id, `?written=${version}`),
          303,
        );
      }),
    );

    router.get(
      '/shop/customers/:customerId/cart',
      customerPage(async (context, customer) => {
        const written = Number(context.req.query('written') ?? -1);
        const found = await retryUntil(
          () => cartOf(customer.id),
          (cart) => cart.version >= written,
        );
        const cart = found && found.lines.length > 0 ? found : null;
        const message = context.req.query('message');

        return context.html(
          <ShopPage
            title="Cart"
            links={links}
            customerId={customer.id}
            customerName={customer.name}
            current="cart"
          >
            <main class="page narrow">
              <h1>Cart</h1>
              {isMessage(message) && <p class="notice">{messages[message]}</p>}
              {cart === null ? (
                <section class="card empty">
                  <p>Your cart is empty.</p>
                  <a
                    class="button primary"
                    href={`/shop/customers/${customer.id}/products`}
                  >
                    Browse products
                  </a>
                </section>
              ) : (
                <section class="card">
                  <table class="lines">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th class="number">Quantity</th>
                        <th class="number">Price</th>
                        <th class="number">Total</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.lines.map((line) => (
                        <tr>
                          <td>{demoProductName(line.productId)}</td>
                          <td class="number">{line.quantity}</td>
                          <td class="number">{formatPrice(line.unitPrice)}</td>
                          <td class="number">
                            {formatPrice(line.unitPrice * line.quantity)}
                          </td>
                          <td class="number">
                            <form
                              method="post"
                              action={`/shop/customers/${customer.id}/cart/items/${line.productId}/remove`}
                            >
                              <input
                                type="hidden"
                                name="quantity"
                                value={line.quantity}
                              />
                              <input
                                type="hidden"
                                name="version"
                                value={cart.version}
                              />
                              <button class="link" type="submit">
                                Remove
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div class="summary">
                    <span>Total</span>
                    <strong>{formatPrice(cart.totalPrice)}</strong>
                  </div>
                  <form
                    method="post"
                    action={`/shop/customers/${customer.id}/cart/checkout`}
                  >
                    <input type="hidden" name="version" value={cart.version} />
                    <button class="button primary wide" type="submit">
                      Check out
                    </button>
                  </form>
                </section>
              )}
            </main>
          </ShopPage>,
        );
      }),
    );

    router.post(
      '/shop/customers/:customerId/cart/items/:productId/remove',
      customerPage(async (context, customer) => {
        const body = await context.req.parseBody();
        const cartId = await customerShoppingCarts.currentOf(customer.id);

        if (!cartId) return context.redirect(cartPageOf(customer.id), 303);

        try {
          const version = await shoppingCarts.removeProductItem(
            cartId,
            assertProductItem({
              productId: context.req.param('productId'),
              quantity: Number(body['quantity']),
            }),
            BigInt(String(body['version'])),
          );

          return context.redirect(
            cartPageOf(customer.id, `?written=${version}`),
            303,
          );
        } catch (error) {
          if (!isConflict(error)) throw error;

          return context.redirect(
            cartPageOf(customer.id, '?message=changed'),
            303,
          );
        }
      }),
    );

    router.post(
      '/shop/customers/:customerId/cart/checkout',
      customerPage(async (context, customer) => {
        const body = await context.req.parseBody();
        const cartId = await customerShoppingCarts.currentOf(customer.id);

        if (!cartId) return context.redirect(cartPageOf(customer.id), 303);

        try {
          const { isCheckedOut, version } = await shoppingCarts.checkOut(
            cartId,
            BigInt(String(body['version'])),
          );

          return isCheckedOut
            ? context.redirect(
                `/shop/customers/${customer.id}/orders/${OrderId.numberOf(OrderId.derivedFrom(cartId))}`,
                303,
              )
            : context.redirect(
                cartPageOf(customer.id, `?written=${version}&message=prices`),
                303,
              );
        } catch (error) {
          if (!isConflict(error)) throw error;

          return context.redirect(
            cartPageOf(customer.id, '?message=changed'),
            303,
          );
        }
      }),
    );
  };
