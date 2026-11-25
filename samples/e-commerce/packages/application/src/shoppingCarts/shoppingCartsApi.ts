import { newerThan } from '@e-commerce/core';
import {
  Accepted,
  Conflict,
  OK,
  toWeakETag,
  getETagFromIfMatch,
  getWeakETagValue,
  isWeakETag,
} from '@event-driven-io/emmett-honojs';
import { createRoute } from '@hono/zod-openapi';
import {
  ConcurrencyError,
  NotFoundError,
  ValidationError,
  assertNotEmptyString,
} from '@event-driven-io/emmett';
import type { Context } from 'hono';
import {
  eventCatalogMessageType,
  openApiRouter,
  problem,
  z,
} from '../documentation/openApi';
import type { CustomerShoppingCarts } from './currentCart/customerShoppingCarts';
import type { Carts } from './getCart/carts';
import { assertProductItem } from './productItems';
import type { ShoppingCartFacade } from './shoppingCartFacade';
import { OrderId } from '../orders/order';
import { cartSchema, productItemSchema } from './shoppingCartContracts';

export const shoppingCartsTag = 'Shopping carts';

const basePath = '/customers/{customerId}/shopping-carts/current';

const parameters = z.object({
  customerId: z.uuid().describe('Id of the customer'),
});
const ifNoneMatch = z.object({
  'If-None-Match': z
    .string()
    .optional()
    .describe('Weak ETag of the version already seen, such as W/"3"'),
});
const ifMatch = z.object({
  'If-Match': z
    .string()
    .describe('Weak ETag with the cart version, such as W/"3"'),
});

const getCurrentCartRoute = createRoute({
  method: 'get',
  path: basePath,
  operationId: 'Cart',
  summary: 'Get the current shopping cart',
  tags: [shoppingCartsTag],
  ...eventCatalogMessageType('query'),
  request: { params: parameters, headers: ifNoneMatch },
  responses: {
    200: {
      description: 'The cart. The ETag header holds its version.',
      content: { 'application/json': { schema: cartSchema } },
    },
    304: {
      description: 'The cart did not change since the ETag in If-None-Match',
    },
    404: problem('The customer has no open cart'),
  },
});

const addProductItemRoute = createRoute({
  method: 'post',
  path: `${basePath}/product-items`,
  operationId: 'AddProductItemToShoppingCart',
  summary: 'Add a product to the current shopping cart',
  tags: [shoppingCartsTag],
  ...eventCatalogMessageType('command'),
  request: {
    params: parameters,
    body: {
      content: { 'application/json': { schema: productItemSchema } },
      required: true,
    },
  },
  responses: {
    200: { description: 'Added. The ETag header holds the new version.' },
    400: problem('The body is not a product item'),
  },
});

const removeProductItemRoute = createRoute({
  method: 'delete',
  path: `${basePath}/product-items`,
  operationId: 'RemoveProductItemFromShoppingCart',
  summary: 'Remove a product from the current shopping cart',
  tags: [shoppingCartsTag],
  ...eventCatalogMessageType('command'),
  request: {
    params: parameters,
    query: z.object({
      productId: z.string(),
      quantity: z.coerce.number().positive(),
    }),
    headers: ifMatch,
  },
  responses: {
    200: { description: 'Removed. The ETag header holds the new version.' },
    400: problem('The product or the If-Match header is not valid'),
    404: problem('The customer has no open cart'),
    409: problem('The cart does not have this product item'),
    412: problem('The cart version changed'),
  },
});

const checkOutRoute = createRoute({
  method: 'post',
  path: `${basePath}/checkout`,
  operationId: 'CheckOutShoppingCart',
  summary: 'Check out the current shopping cart',
  tags: [shoppingCartsTag],
  ...eventCatalogMessageType('command'),
  request: { params: parameters, headers: ifMatch },
  responses: {
    202: {
      description:
        'Accepted. The Location header points to the order that follows.',
    },
    409: problem('Prices changed. Read the cart and check out again.'),
    412: problem('The cart version changed'),
  },
});

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

export const shoppingCartsApi = (dependencies: {
  shoppingCarts: ShoppingCartFacade;
  customerShoppingCarts: CustomerShoppingCarts;
  carts: Carts;
}) => {
  const { shoppingCarts, customerShoppingCarts, carts } = dependencies;
  const api = openApiRouter();

  const currentCartOf = async (customerId: string) => {
    const cartId = await customerShoppingCarts.currentOf(customerId);

    if (!cartId) throw noOpenCart(customerId);

    return cartId;
  };

  api.openapi(getCurrentCartRoute, (context) => {
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

  api.openapi(addProductItemRoute, async (context) => {
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

  api.openapi(removeProductItemRoute, async (context) => {
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

  api.openapi(checkOutRoute, async (context) => {
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
      location: `/customers/${customerId}/orders/${OrderId.numberOf(OrderId.derivedFrom(cartId))}`,
    });
  });

  return api;
};
