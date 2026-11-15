import { getPostgres } from '#core/postgres';
import {
  assertArrayOrUndefined,
  assertDateOrUndefined,
  assertNotEmptyString,
  assertPositiveNumber,
  assertPositiveNumberOrUndefined,
  assertStringOrUndefined,
} from '#core/validation';
import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import type { Cart } from '../../db';
import { cartItemSchema, cartSchema } from '../../db';
import type { CartDetails } from './shoppingCart';
import { ShoppingCartStatus } from './shoppingCart';

//////////////////////////////////////
/// Routes
//////////////////////////////////////

export const shoppingCartsRouter = (getCurrentTime: () => Date): Router => {
  const router = Router();

  ///////////////////////////////
  // Open or update Shopping cart
  ///////////////////////////////
  router.post(
    '/shopping-carts/:sessionId',
    async (
      request: CartUpsertRequest,
      response: Response,
      next: NextFunction,
    ) => {
      try {
        const now = getCurrentTime();
        const { items, id, sessionId, ...cart } = getShoppingCartFromRequest(
          request,
          now,
        );

        const wasStored = await (
          await getPostgres()
        ).transaction(async (entityManager) => {
          const shoppingCarts = entityManager.getRepository(cartSchema);
          const shoppingCartItems = entityManager.getRepository(cartItemSchema);

          const existing = await shoppingCarts.findOneBy({ sessionId });

          if (
            existing !== null &&
            (existing.status & ShoppingCartStatus.Closed) !== 0
          )
            return false;

          const stored = await shoppingCarts.save(
            existing === null
              ? { ...cart, sessionId, createdAt: now }
              : { ...existing, ...cart, updatedAt: now },
          );

          const cartId = id ?? stored.id;

          // delete and recreate all cart items
          await shoppingCartItems.delete({ cartId });

          if (items.length > 0)
            await shoppingCartItems.insert(
              items.map((item) => {
                return {
                  ...item,
                  cartId,
                  createdAt: now,
                  updatedAt: now,
                };
              }),
            );

          return true;
        });

        if (!wasStored) {
          response.sendStatus(412);
          return;
        }

        response.sendStatus(200);
      } catch (error) {
        next(error);
      }
    },
  );

  ///////////////////////////////
  // Get Shopping cart details
  ///////////////////////////////
  router.get(
    '/shopping-carts/:sessionId',
    async (
      request: Request,
      response: Response<CartDetails>,
      next: NextFunction,
    ) => {
      try {
        const postgres = await getPostgres();

        const result = await postgres.getRepository(cartSchema).findOneBy({
          sessionId: assertNotEmptyString(request.params.sessionId),
        });

        if (result === null) {
          response.sendStatus(404);
          return;
        }

        const items = await postgres.getRepository(cartItemSchema).findBy({
          cartId: result.id,
        });

        response.send({
          ...result,
          items,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
};

export type CartItemUpsert = {
  content: string | null;
  discount: number;
  productId: number;
  price: number;
  quantity: number;
  sku: string;
};

export type CartUpsert = Omit<Cart, 'id' | 'updatedAt'> & {
  id?: number;
  items: CartItemUpsert[];
};

export type CartUpsertRequest = Request<
  Partial<{ sessionId: string }>,
  null,
  Partial<CartUpsert>
>;

const getShoppingCartFromRequest = (
  request: CartUpsertRequest,
  now: Date,
): CartUpsert => {
  const id =
    'id' in request.body
      ? (assertPositiveNumberOrUndefined(request.body.id) ?? {})
      : {};

  return {
    ...id,
    sessionId: assertNotEmptyString(request.params.sessionId),
    city: assertStringOrUndefined(request.body.city) ?? null,
    country: assertStringOrUndefined(request.body.country) ?? null,
    content: assertStringOrUndefined(request.body.content) ?? null,
    email: assertStringOrUndefined(request.body.email) ?? null,
    firstName: assertStringOrUndefined(request.body.firstName) ?? null,
    lastName: assertStringOrUndefined(request.body.lastName) ?? null,
    middleName: assertStringOrUndefined(request.body.middleName) ?? null,
    line1: assertStringOrUndefined(request.body.line1) ?? null,
    line2: assertStringOrUndefined(request.body.line2) ?? null,
    mobile: assertStringOrUndefined(request.body.mobile) ?? null,
    province: assertStringOrUndefined(request.body.province) ?? null,
    status: assertPositiveNumber(request.body.status),
    userId: assertPositiveNumberOrUndefined(request.body.userId) ?? null,
    items: (assertArrayOrUndefined(request.body.items) ?? []).map(
      (item: {
        content: unknown;
        discount: unknown;
        productId: unknown;
        price: unknown;
        quantity: unknown;
        sku: unknown;
      }) => {
        return {
          content: assertStringOrUndefined(item.content) ?? null,
          discount: assertPositiveNumber(item.discount),
          productId: assertPositiveNumber(item.productId),
          price: assertPositiveNumber(item.price),
          quantity: assertPositiveNumber(item.quantity),
          sku: assertNotEmptyString(item.sku),
        };
      },
    ),
    createdAt: assertDateOrUndefined(request.body.createdAt) ?? now,
  };
};
