import { getInMemoryEventStore } from '@event-driven-io/emmett';
import {
  ApiSpecification,
  existingStream,
  expectError,
  expectNewEvents,
  expectResponse,
  getApplication,
} from '@event-driven-io/emmett-expressjs';
import { v4 as uuid } from 'uuid';
import { beforeEach, describe, it } from 'vitest';
import { shoppingCartApi } from './api';
import type { PricedProductItem, ProductItem } from './productItem';
import type {
  ProductItemAddedToShoppingCart,
  ShoppingCartConfirmed,
  ShoppingCartEvent,
  ShoppingCartOpened,
} from './shoppingCart';
import { toShoppingCartStreamName } from './shoppingCart';
import type { User } from './user';

describe('Shopping cart API', () => {
  it('opens shopping cart', () =>
    given()
      .when((request) => request.post(`/v2/shopping-carts/${shoppingCartId}`))
      .then([
        expectResponse(201, { headers: { etag: 'W/"1"' } }),
        expectNewEvents(streamName, [opened]),
      ]));

  it('adds priced product item to opened shopping cart', () =>
    given(existingStream(streamName, [opened]))
      .when((request) =>
        request
          .post(`/v2/shopping-carts/${shoppingCartId}/product-items`)
          .set('If-Match', 'W/"1"')
          .send({ productId: 123, quantity: 2 }),
      )
      .then([
        expectResponse(200, { headers: { etag: 'W/"2"' } }),
        expectNewEvents(streamName, [shoesAdded]),
      ]));

  it('rejects adding product item with stale ETag', () =>
    given(existingStream(streamName, [opened, shoesAdded]))
      .when((request) =>
        request
          .post(`/v2/shopping-carts/${shoppingCartId}/product-items`)
          .set('If-Match', 'W/"1"')
          .send({ productId: 123, quantity: 2 }),
      )
      .then(expectError(412)));

  it('rejects adding product item to confirmed shopping cart', () =>
    given(existingStream(streamName, [opened, shoesAdded, confirmed]))
      .when((request) =>
        request
          .post(`/v2/shopping-carts/${shoppingCartId}/product-items`)
          .set('If-Match', 'W/"3"')
          .send({ productId: 123, quantity: 2 }),
      )
      .then(expectError(403, { detail: 'CART_IS_NOT_OPENED' })));

  it('removes product item from opened shopping cart', () =>
    given(existingStream(streamName, [opened, shoesAdded]))
      .when((request) =>
        request
          .delete(
            `/v2/shopping-carts/${shoppingCartId}/product-items?productId=123&quantity=1`,
          )
          .set('If-Match', 'W/"2"'),
      )
      .then([
        expectResponse(200, { headers: { etag: 'W/"3"' } }),
        expectNewEvents(streamName, [
          {
            type: 'product-item-removed-from-shopping-cart',
            data: {
              shoppingCartId,
              productItem: { ...shoesAdded.data.productItem, quantity: 1 },
              removedAt: now.toJSON(),
            },
          },
        ]),
      ]));

  it('confirms shopping cart for existing user', () =>
    given(existingStream(streamName, [opened, shoesAdded]))
      .when((request) =>
        request
          .put(`/v2/users/${user.id}/shopping-carts/${shoppingCartId}`)
          .set('If-Match', 'W/"2"')
          .send({ content: 'Some content' }),
      )
      .then([
        expectResponse(200, { headers: { etag: 'W/"3"' } }),
        expectNewEvents(streamName, [confirmed]),
      ]));

  it('rejects confirming shopping cart for unknown user', () =>
    given(existingStream(streamName, [opened, shoesAdded]))
      .when((request) =>
        request
          .put(`/v2/users/1/shopping-carts/${shoppingCartId}`)
          .set('If-Match', 'W/"2"')
          .send({ content: 'Some content' }),
      )
      .then(expectError(404, { detail: 'USER_DOES_NOT_EXISTS' })));

  let shoppingCartId: string;
  let streamName: string;
  let opened: ShoppingCartOpened;
  let shoesAdded: ProductItemAddedToShoppingCart;
  let confirmed: ShoppingCartConfirmed;

  beforeEach(() => {
    shoppingCartId = uuid();
    streamName = toShoppingCartStreamName(shoppingCartId);

    opened = {
      type: 'shopping-cart-opened',
      data: { shoppingCartId, openedAt: now.toJSON() },
    };
    shoesAdded = {
      type: 'product-item-added-to-shopping-cart',
      data: {
        shoppingCartId,
        productItem: {
          productId: 123,
          quantity: 2,
          sku: 'SKU',
          price: 100,
          discount: 0,
        },
        addedAt: now.toJSON(),
      },
    };
    confirmed = {
      type: 'shopping-cart-confirmed',
      data: {
        shoppingCartId,
        user,
        additionalInfo: { content: 'Some content' },
        confirmedAt: now.toJSON(),
      },
    };
  });
});

const now = new Date();

const user: User = {
  id: 1694,
  firstName: 'Oskar',
  lastName: 'Grouch',
  email: 'oskar@someemail.pl',
  address: { city: 'Legnica', province: 'Sesame street', country: 'Poland' },
};

const getPricedProductItem = (
  productItem: ProductItem,
): Promise<PricedProductItem> =>
  Promise.resolve({ ...productItem, sku: 'SKU', price: 100, discount: 0 });

const getUserData = (userId: number) =>
  Promise.resolve(userId === user.id ? user : undefined);

const given = ApiSpecification.for<ShoppingCartEvent>(
  () => getInMemoryEventStore(),
  (eventStore) =>
    getApplication({
      apis: [
        shoppingCartApi(
          eventStore,
          getPricedProductItem,
          getUserData,
          () => now,
        ),
      ],
    }),
);
