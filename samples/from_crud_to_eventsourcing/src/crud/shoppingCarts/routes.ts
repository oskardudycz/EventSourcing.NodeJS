import { getPostgres } from '#core/postgres';
import {
  assertArray,
  assertNotEmptyString,
  assertPositiveNumber,
  assertStringOrUndefined,
} from '#core/validation';
import { NextFunction, Request, Response, Router } from 'express';
import { cartItems, carts } from '../db';

//////////////////////////////////////
/// Routes
//////////////////////////////////////

export const router = Router();

// Open Shopping cart
router.post(
  '/v1/shopping-carts/:sessionId',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const sessionId = assertNotEmptyString(request.params.sessionId);

      const shoppingCarts = carts(getPostgres());
      const shoppingCartItems = cartItems(getPostgres());

      const { items, ...cart } = getShoppingCartFromRequest(request);

      const resultCarts = await shoppingCarts.insertOrIgnore({
        ...cart,
        sessionId,
        createdAt: new Date(),
      });

      if (resultCarts.length === 0) {
        await shoppingCarts.update(
          { sessionId },
          {
            ...cart,
            updatedAt: new Date(),
          }
        );
      }

      const cartId = resultCarts[0].id;

      // delete and recreate all cart items
      shoppingCartItems.delete({ cartId: resultCarts[0].id });

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

      response.status(200);
    } catch (error) {
      next(error);
    }
  }
);

const getShoppingCartFromRequest = (request: Request) => {
  return {
    city: assertStringOrUndefined(request.body.city),
    country: assertStringOrUndefined(request.body.country) ?? null,
    content: assertStringOrUndefined(request.body.content) ?? null,
    email: assertStringOrUndefined(request.body.email) ?? null,
    firstName: assertStringOrUndefined(request.body.lastName) ?? null,
    lastName: assertStringOrUndefined(request.body.firstName) ?? null,
    middleName: assertStringOrUndefined(request.body.middleName) ?? null,
    line1: assertStringOrUndefined(request.body.line1) ?? null,
    line2: assertStringOrUndefined(request.body.line2) ?? null,
    mobile: assertStringOrUndefined(request.body.mobile) ?? null,
    province: assertStringOrUndefined(request.body.province) ?? null,
    status: assertPositiveNumber(request.body.status),
    userId: assertPositiveNumber(request.body.userId),
    items: assertArray(request.body.items).map(
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
  '/v1/shopping-carts/:shoppingCartId',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const shoppingCarts = carts(getPostgres());
      const shoppingCartItems = cartItems(getPostgres());

      const result = await shoppingCarts.findOne({
        sessionId: assertNotEmptyString(request.params.shoppingCartId),
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
