import { newerThan } from '@e-commerce/core';
import {
  Accepted,
  Conflict,
  OK,
  toWeakETag,
  getETagFromIfMatch,
  getWeakETagValue,
  isWeakETag,
  type WebApiSetup,
} from '@event-driven-io/emmett-honojs';
import {
  ConcurrencyError,
  NotFoundError,
  ValidationError,
  assertNotEmptyString,
} from '@event-driven-io/emmett';
import type { Context } from 'hono';
import type { CustomerShoppingCarts } from './currentCart/customerShoppingCarts';
import type { Carts } from './getCart/carts';
import { assertProductItem } from './productItems';
import type { ShoppingCartFacade } from './shoppingCartFacade';
import { ShoppingCartId } from './shoppingCart';

const basePath = '/customers/:customerId/shopping-carts/current';

const notAVersion = () =>
  new ValidationError('If-Match has to be a weak ETag with the cart version');

const expectedVersionOf = (context: Context): bigint => {
  if (context.req.header('if-match') === undefined) throw notAVersion();

  const ifMatch = getETagFromIfMatch(context);

  if (!isWeakETag(ifMatch)) throw notAVersion();

  const value = getWeakETagValue(ifMatch);

  if (!/^-?\d+$/.test(value)) throw notAVersion();

  const version = BigInt(value);

  if (version < 0n) throw new ConcurrencyError(undefined, version.toString());

  return version;
};

const noOpenCart = (customerId: string) =>
  new NotFoundError({ type: 'ShoppingCart', id: customerId });

export const shoppingCartsApi =
  (dependencies: {
    shoppingCarts: ShoppingCartFacade;
    customerShoppingCarts: CustomerShoppingCarts;
    carts: Carts;
  }): WebApiSetup =>
  (router) => {
    const { shoppingCarts, customerShoppingCarts, carts } = dependencies;

    const currentCartOf = async (customerId: string) => {
      const cartId = await customerShoppingCarts.currentOf(customerId);

      if (!cartId) throw noOpenCart(customerId);

      return cartId;
    };

    router.get(basePath, (context) => {
      const customerId = assertNotEmptyString(context.req.param('customerId'));

      return newerThan(
        context,
        async () => {
          const cartId = await customerShoppingCarts.currentOf(customerId);
          return cartId ? carts.get(cartId) : null;
        },
        { whenMissing: () => noOpenCart(customerId) },
      );
    });

    router.post(`${basePath}/product-items`, async (context) => {
      const customerId = assertNotEmptyString(context.req.param('customerId'));
      const body: unknown = await context.req.json().catch(() => {
        throw new ValidationError('Body has to be a JSON object');
      });

      const version = await shoppingCarts.addProductItem(
        customerId,
        assertProductItem(body),
      );

      return OK({ context, eTag: toWeakETag(version) });
    });

    router.delete(`${basePath}/product-items`, async (context) => {
      const customerId = assertNotEmptyString(context.req.param('customerId'));
      const { productId, quantity } = context.req.query();
      const productItem = assertProductItem({
        productId,
        quantity: quantity === undefined ? undefined : Number(quantity),
      });
      const expectedVersion = expectedVersionOf(context);

      const version = await shoppingCarts.removeProductItem(
        await currentCartOf(customerId),
        productItem,
        expectedVersion,
      );

      return OK({ context, eTag: toWeakETag(version) });
    });

    router.post(`${basePath}/checkout`, async (context) => {
      const customerId = assertNotEmptyString(context.req.param('customerId'));
      const expectedVersion = expectedVersionOf(context);
      const cartId = await currentCartOf(customerId);

      const { version, isCheckedOut } = await shoppingCarts.checkOut(
        cartId,
        expectedVersion,
      );

      if (!isCheckedOut)
        return Conflict({
          context,
          eTag: toWeakETag(version),
          problemDetails: 'Prices changed. Read the cart and check out again.',
        });

      return Accepted({
        context,
        location: `/customers/${customerId}/orders/${ShoppingCartId.tailOf(cartId)}`,
      });
    });
  };
