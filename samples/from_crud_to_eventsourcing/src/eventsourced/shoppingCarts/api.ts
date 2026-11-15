import { getPostgres } from '#core/postgres';
import { assertStringOrUndefined } from '#core/validation';
import type { EventStore } from '@event-driven-io/emmett';
import {
  assertNotEmptyString,
  assertPositiveNumber,
  assertUnsignedBigInt,
  DeciderCommandHandler,
  NotFoundError,
  STREAM_DOES_NOT_EXIST,
} from '@event-driven-io/emmett';
import type { WebApiSetup } from '@event-driven-io/emmett-expressjs';
import {
  Created,
  getETagValueFromIfMatch,
  NotFound,
  OK,
  on,
  toWeakETag,
} from '@event-driven-io/emmett-expressjs';
import type { Request, Router } from 'express';
import { v4 as uuid } from 'uuid';
import { cartItemSchema, cartSchema } from '../../db';
import type { PricedProductItem, ProductItem } from './productItem';
import {
  decider,
  ShoppingCartErrors,
  toShoppingCartStreamName,
} from './shoppingCart';
import type { User } from './user';

const handle = DeciderCommandHandler({
  ...decider,
  mapToStreamId: toShoppingCartStreamName,
});

const getExpectedStreamVersion = (request: Request) =>
  assertUnsignedBigInt(getETagValueFromIfMatch(request));

export const shoppingCartApi =
  (
    eventStore: EventStore,
    getPricedProductItem: (
      productItem: ProductItem,
    ) => Promise<PricedProductItem>,
    getUserData: (userId: number) => Promise<User | undefined>,
    getCurrentTime: () => Date,
  ): WebApiSetup =>
  (router: Router) => {
    ///////////////////////////////
    // Open Shopping cart
    ///////////////////////////////
    router.post(
      '/v2/shopping-carts{/:shoppingCartId}',
      on(async (request: Request) => {
        const shoppingCartId =
          assertStringOrUndefined(request.params.shoppingCartId) ?? uuid();

        const result = await handle(
          eventStore,
          shoppingCartId,
          {
            type: 'OpenShoppingCart',
            data: { shoppingCartId },
            metadata: { now: getCurrentTime() },
          },
          { expectedStreamVersion: STREAM_DOES_NOT_EXIST },
        );

        return Created({
          createdId: shoppingCartId,
          eTag: toWeakETag(result.nextExpectedStreamVersion),
        });
      }),
    );

    ///////////////////////////////
    // Add Product Item
    ///////////////////////////////
    router.post(
      '/v2/shopping-carts/:shoppingCartId/product-items',
      on(async (request: AddProductItemRequest) => {
        const shoppingCartId = assertNotEmptyString(
          request.params.shoppingCartId,
        );

        const productItem = await getPricedProductItem({
          productId: assertPositiveNumber(request.body.productId),
          quantity: assertPositiveNumber(request.body.quantity),
        });

        const result = await handle(
          eventStore,
          shoppingCartId,
          {
            type: 'AddProductItemToShoppingCart',
            data: { shoppingCartId, productItem },
            metadata: { now: getCurrentTime() },
          },
          { expectedStreamVersion: getExpectedStreamVersion(request) },
        );

        return OK({ eTag: toWeakETag(result.nextExpectedStreamVersion) });
      }),
    );

    ///////////////////////////////
    // Remove Product Item
    ///////////////////////////////
    router.delete(
      '/v2/shopping-carts/:shoppingCartId/product-items',
      on(async (request: RemoveProductItemRequest) => {
        const shoppingCartId = assertNotEmptyString(
          request.params.shoppingCartId,
        );

        const result = await handle(
          eventStore,
          shoppingCartId,
          {
            type: 'RemoveProductItemFromShoppingCart',
            data: {
              shoppingCartId,
              productItem: {
                productId: assertPositiveNumber(
                  Number(request.query.productId),
                ),
                quantity: assertPositiveNumber(Number(request.query.quantity)),
              },
            },
            metadata: { now: getCurrentTime() },
          },
          { expectedStreamVersion: getExpectedStreamVersion(request) },
        );

        return OK({ eTag: toWeakETag(result.nextExpectedStreamVersion) });
      }),
    );

    ///////////////////////////////
    // Confirm Shopping Cart
    ///////////////////////////////
    router.put(
      '/v2/users/:userId/shopping-carts/:shoppingCartId',
      on(async (request: ConfirmShoppingCartRequest) => {
        const shoppingCartId = assertNotEmptyString(
          request.params.shoppingCartId,
        );

        const userId = assertPositiveNumber(Number(request.params.userId));
        const user = await getUserData(userId);

        if (!user)
          throw new NotFoundError({
            id: userId.toString(),
            type: 'User',
            message: ShoppingCartErrors.USER_DOES_NOT_EXISTS,
          });

        const result = await handle(
          eventStore,
          shoppingCartId,
          {
            type: 'ConfirmShoppingCart',
            data: {
              shoppingCartId,
              user,
              additionalInfo: {
                content: assertStringOrUndefined(request.body.content),
                line1: assertStringOrUndefined(request.body.line1),
                line2: assertStringOrUndefined(request.body.line2),
              },
            },
            metadata: { now: getCurrentTime() },
          },
          { expectedStreamVersion: getExpectedStreamVersion(request) },
        );

        return OK({ eTag: toWeakETag(result.nextExpectedStreamVersion) });
      }),
    );

    ///////////////////////////////
    // Get Shopping cart details
    ///////////////////////////////
    router.get(
      '/v2/shopping-carts/:shoppingCartId',
      on(async (request: Request) => {
        const shoppingCartId = assertNotEmptyString(
          request.params.shoppingCartId,
        );
        const postgres = await getPostgres();

        const result = await postgres
          .getRepository(cartSchema)
          .findOneBy({ sessionId: shoppingCartId });

        if (result === null) return NotFound();

        const items = await postgres
          .getRepository(cartItemSchema)
          .findBy({ cartId: result.id });

        const { currentStreamVersion } = await eventStore.readStream(
          toShoppingCartStreamName(shoppingCartId),
        );

        return OK({
          eTag: toWeakETag(currentStreamVersion),
          body: {
            ...result,
            items: items.sort(
              (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
            ),
          },
        });
      }),
    );
  };

type AddProductItemRequest = Request<
  Partial<{ shoppingCartId: string }>,
  unknown,
  Partial<{ productId: number; quantity: number }>
>;

type RemoveProductItemRequest = Request<
  Partial<{ shoppingCartId: string }>,
  unknown,
  unknown,
  Partial<{ productId: string; quantity: string }>
>;

type ConfirmShoppingCartRequest = Request<
  Partial<{ shoppingCartId: string; userId: string }>,
  unknown,
  Partial<{ content: string; line1: string; line2: string }>
>;
