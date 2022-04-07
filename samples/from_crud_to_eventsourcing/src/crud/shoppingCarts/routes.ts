import { getPostgres } from '#core/postgres';
import {
  assertArrayOrUndefined,
  assertNotEmptyString,
  assertPositiveNumber,
  assertPositiveNumberOrUndefined,
  assertStringOrUndefined,
} from '#core/validation';
import { anyOf, not } from '@databases/pg-typed';
import { NextFunction, Request, Response, Router } from 'express';
import { cartItems, carts } from '../db';
import { ShoppingCartStatus } from './shoppingCart';

//////////////////////////////////////
/// Routes
//////////////////////////////////////

export const router = Router();

// Open Shopping cart
router.post(
  '/shopping-carts/:sessionId',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const sessionId = assertNotEmptyString(request.params.sessionId);

      const { items, id, ...cart } = getShoppingCartFromRequest(request);

      const shoppingCarts = carts(getPostgres());
      const shoppingCartItems = cartItems(getPostgres());

      let resultCarts = await shoppingCarts.insertOrIgnore({
        ...cart,
        sessionId,
        createdAt: new Date(),
      });

      if (resultCarts.length === 0) {
        resultCarts = await shoppingCarts.update(
          {
            sessionId,
            status: not(
              anyOf([
                ShoppingCartStatus.Confirmed,
                ShoppingCartStatus.Cancelled,
              ])
            ),
          },
          {
            ...cart,
            updatedAt: new Date(),
          }
        );
      }

      if (resultCarts.length === 0) {
        response.sendStatus(412);
        return;
      }

      const cartId = id ?? resultCarts[0].id;

      // delete and recreate all cart items
      shoppingCartItems.delete({ cartId });

      await shoppingCartItems.bulkInsert({
        columnsToInsert: [
          'cartId',
          'content',
          'createdAt',
          'discount',
          'price',
          'productId',
          'quantity',
          'sku',
          'updatedAt',
        ],
        records: items.map((item) => {
          return {
            ...item,
            cartId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }),
      });

      response.sendStatus(200);
    } catch (error) {
      next(error);
    }
  }
);

const getShoppingCartFromRequest = (request: Request) => {
  return {
    id: assertPositiveNumberOrUndefined(request.body.id),
    city: assertStringOrUndefined(request.body.city),
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
    userId: assertPositiveNumberOrUndefined(request.body.userId),
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
      }
    ),
  };
};

router.get(
  '/shopping-carts/:sessionId',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const shoppingCarts = carts(getPostgres());
      const shoppingCartItems = cartItems(getPostgres());

      const result = await shoppingCarts.findOne({
        sessionId: assertNotEmptyString(request.params.sessionId),
      });

      if (result === null) {
        response.sendStatus(404);
        return;
      }

      const items = await shoppingCartItems
        .find({
          cartId: result.id,
        })
        .all();

      response.send({
        ...result,
        items,
      });
    } catch (error) {
      next(error);
    }
  }
);
