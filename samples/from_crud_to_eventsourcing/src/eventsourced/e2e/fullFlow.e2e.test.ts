import { config } from '#config';
import { disconnectFromPostgres, runPostgresMigrations } from '#core/postgres';
import type {
  E2EResponseAssert,
  TestRequest,
} from '@event-driven-io/emmett-expressjs';
import {
  ApiE2ESpecification,
  expectResponse,
  getApplication,
} from '@event-driven-io/emmett-expressjs';
import type { Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { disconnectFromEventStore, getEventStore } from '../core/eventStore';
import { shoppingCartApi } from '../shoppingCarts/api';
import { getPricedProductItem } from '../shoppingCarts/productItem';
import { ShoppingCartStatus } from '../shoppingCarts/shoppingCart';
import { getUserData } from '../shoppingCarts/user';

describe('Shopping cart flow', () => {
  it('opens shopping cart', () =>
    given()
      .when(openShoppingCart)
      .then([
        (response) => {
          expect(response.headers['etag']).toBe('W/"1"');
          expect(response.headers['location']).toBe(
            `/v2/shopping-carts/${shoppingCartId}`,
          );
        },
      ]));

  it('shows opened shopping cart', () =>
    given(openShoppingCart)
      .when(getShoppingCartDetails)
      .then([
        expectShoppingCart('W/"1"', {
          ...emptyCart,
          items: [],
          status: ShoppingCartStatus.Opened,
          createdAt: commandTime(0),
          updatedAt: null,
        }),
      ]));

  it('adds product item to opened shopping cart', () =>
    given(openShoppingCart)
      .when(addTwoPairsOfShoes)
      .then([expectResponse(200, { headers: { etag: 'W/"2"' } })]));

  it('shows shopping cart with added product item', () =>
    given(openShoppingCart, addTwoPairsOfShoes)
      .when(getShoppingCartDetails)
      .then([
        expectShoppingCart('W/"2"', {
          ...emptyCart,
          items: [twoPairsOfShoes],
          status: ShoppingCartStatus.Opened,
          createdAt: commandTime(0),
          updatedAt: commandTime(1),
        }),
      ]));

  it('shows shopping cart with two different product items', () =>
    given(openShoppingCart, addTwoPairsOfShoes, addTShirt)
      .when(getShoppingCartDetails)
      .then([
        expectShoppingCart('W/"3"', {
          ...emptyCart,
          items: [twoPairsOfShoes, tShirt],
          status: ShoppingCartStatus.Opened,
          createdAt: commandTime(0),
          updatedAt: commandTime(2),
        }),
      ]));

  it('shows shopping cart after removing pair of shoes', () =>
    given(openShoppingCart, addTwoPairsOfShoes, addTShirt, removePairOfShoes)
      .when(getShoppingCartDetails)
      .then([
        expectShoppingCart('W/"4"', {
          ...emptyCart,
          items: [pairOfShoes, tShirt],
          status: ShoppingCartStatus.Opened,
          createdAt: commandTime(0),
          updatedAt: commandTime(3),
        }),
      ]));

  it('shows confirmed shopping cart', () =>
    given(
      openShoppingCart,
      addTwoPairsOfShoes,
      addTShirt,
      removePairOfShoes,
      confirmShoppingCart,
    )
      .when(getShoppingCartDetails)
      .then([
        expectShoppingCart('W/"5"', {
          items: [pairOfShoes, tShirt],
          status: ShoppingCartStatus.Confirmed,
          userId,
          ...confirmedData,
          createdAt: commandTime(0),
          updatedAt: commandTime(4),
        }),
      ]));

  let given: ApiE2ESpecification;
  let shoppingCartId: string;
  let eTag: string;

  beforeAll(async () => {
    config.postgres.connectionString = inject('postgreSQLConnectionString');
    config.postgres.schemaName = 'ecommerce';
    console.log(config.postgres.connectionString);

    await runPostgresMigrations();

    given = ApiE2ESpecification.for(getEventStore, (eventStore) => {
      let commandNumber = 0;

      return getApplication({
        apis: [
          shoppingCartApi(
            eventStore,
            getPricedProductItem,
            getUserData,
            () => new Date(commandTime(commandNumber++)),
          ),
        ],
      });
    });
  });

  afterAll(async () => {
    await disconnectFromEventStore();
    await disconnectFromPostgres();
  });

  const rememberETag = (response: Response) => {
    eTag = response.headers['etag'];
  };

  const openShoppingCart: TestRequest = (request) =>
    request
      .post('/v2/shopping-carts')
      .expect(201)
      .expect((response) => {
        shoppingCartId = (response.body as { id: string }).id;
        rememberETag(response);
      });

  const addTwoPairsOfShoes: TestRequest = (request) =>
    request
      .post(`/v2/shopping-carts/${shoppingCartId}/product-items`)
      .set('If-Match', eTag)
      .send(twoPairsOfShoes)
      .expect(200)
      .expect(rememberETag);

  const addTShirt: TestRequest = (request) =>
    request
      .post(`/v2/shopping-carts/${shoppingCartId}/product-items`)
      .set('If-Match', eTag)
      .send(tShirt)
      .expect(200)
      .expect(rememberETag);

  const removePairOfShoes: TestRequest = (request) =>
    request
      .delete(
        `/v2/shopping-carts/${shoppingCartId}/product-items?productId=${pairOfShoes.productId}&quantity=${pairOfShoes.quantity}`,
      )
      .set('If-Match', eTag)
      .expect(200)
      .expect(rememberETag);

  const confirmShoppingCart: TestRequest = (request) =>
    request
      .put(`/v2/users/${userId}/shopping-carts/${shoppingCartId}`)
      .set('If-Match', eTag)
      .send(confirmedData)
      .expect(200)
      .expect(rememberETag);

  const getShoppingCartDetails: TestRequest = (request) =>
    request.get(`/v2/shopping-carts/${shoppingCartId}`);

  const expectShoppingCart =
    (
      expectedETag: string,
      expected: Record<string, unknown>,
    ): E2EResponseAssert =>
    (response) => {
      expect(response.statusCode).toBe(200);
      expect(response.headers['etag']).toBe(expectedETag);
      expect(response.body).toMatchObject({
        sessionId: shoppingCartId,
        ...expected,
      });
      expect(typeof (response.body as { id: unknown }).id).toBe('number');
    };
});

const startedAt = Date.now();
const commandTime = (commandNumber: number) =>
  new Date(startedAt + commandNumber * 1000).toJSON();

const twoPairsOfShoes = { productId: 123, quantity: 2 };
const tShirt = { productId: 456, quantity: 1 };
const pairOfShoes = { productId: 123, quantity: 1 };
const userId = 1694;
const confirmedData = {
  content: 'Some content',
  line1: 'line 1',
  line2: 'line 2',
};

const emptyCart = {
  city: null,
  content: null,
  country: null,
  email: null,
  firstName: null,
  lastName: null,
  line1: null,
  line2: null,
  middleName: null,
  mobile: null,
  province: null,
  userId: null,
};
