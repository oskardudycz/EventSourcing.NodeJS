import { config } from '#config';
import { getApplication } from '#core/api';
import { disconnectFromPostgres, runPostgresMigrations } from '#core/postgres';
import type {
  E2EResponseAssert,
  TestRequest,
} from '@event-driven-io/emmett-expressjs';
import {
  ApiE2ESpecification,
  expectResponse,
} from '@event-driven-io/emmett-expressjs';
import { v4 as uuid } from 'uuid';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type { CartItemUpsert, CartUpsert } from '../shoppingCarts/routes';
import { shoppingCartsRouter } from '../shoppingCarts/routes';
import { ShoppingCartStatus } from '../shoppingCarts/shoppingCart';

describe('Shopping cart flow', () => {
  it('opens shopping cart', () =>
    given()
      .when(openShoppingCart)
      .then([expectResponse(200)]));

  it('shows opened shopping cart', () =>
    given(openShoppingCart)
      .when(getShoppingCartDetails)
      .then([
        expectShoppingCart({
          ...emptyCart,
          items: [],
          status: ShoppingCartStatus.Opened,
          createdAt: commandTime(0),
          updatedAt: null,
        }),
      ]));

  it('adds product item to opened shopping cart', () =>
    given(openShoppingCart, loadShoppingCart)
      .when(addTwoPairsOfShoes)
      .then([expectResponse(200)]));

  it('shows shopping cart with added product item', () =>
    given(openShoppingCart, loadShoppingCart, addTwoPairsOfShoes)
      .when(getShoppingCartDetails)
      .then([
        expectShoppingCart({
          ...emptyCart,
          items: [twoPairsOfShoes],
          status: ShoppingCartStatus.Opened,
          createdAt: commandTime(0),
          updatedAt: commandTime(1),
        }),
      ]));

  it('shows shopping cart with two different product items', () =>
    given(openShoppingCart, loadShoppingCart, addTwoPairsOfShoes, addTShirt)
      .when(getShoppingCartDetails)
      .then([
        expectShoppingCart({
          ...emptyCart,
          items: [twoPairsOfShoes, tShirt],
          status: ShoppingCartStatus.Opened,
          createdAt: commandTime(0),
          updatedAt: commandTime(2),
        }),
      ]));

  it('shows shopping cart after removing pair of shoes', () =>
    given(
      openShoppingCart,
      loadShoppingCart,
      addTwoPairsOfShoes,
      addTShirt,
      removePairOfShoes,
    )
      .when(getShoppingCartDetails)
      .then([
        expectShoppingCart({
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
      loadShoppingCart,
      addTwoPairsOfShoes,
      addTShirt,
      removePairOfShoes,
      confirmShoppingCart,
    )
      .when(getShoppingCartDetails)
      .then([
        expectShoppingCart({
          items: [pairOfShoes, tShirt],
          ...confirmedData,
          createdAt: commandTime(0),
          updatedAt: commandTime(4),
        }),
      ]));

  it('rejects changes to confirmed shopping cart', () =>
    given(
      openShoppingCart,
      loadShoppingCart,
      addTwoPairsOfShoes,
      confirmShoppingCart,
    )
      .when(tryToAddTShirt)
      .then([expectResponse(412)]));

  let given: ApiE2ESpecification;
  let sessionId: string;
  let shoppingCart: CartUpsert;

  beforeAll(async () => {
    config.postgres.connectionString = inject('postgreSQLConnectionString');
    config.postgres.schemaName = 'ecommerce';
    console.log(config.postgres.connectionString);

    await runPostgresMigrations();

    given = ApiE2ESpecification.for({
      getApplication: () => {
        let commandNumber = 0;

        return getApplication(
          shoppingCartsRouter(() => new Date(commandTime(commandNumber++))),
        );
      },
    });
  });

  afterAll(async () => {
    await disconnectFromPostgres();
  });

  const openShoppingCart: TestRequest = (request) => {
    sessionId = uuid();

    return request
      .post(`/shopping-carts/${sessionId}`)
      .send({ status: ShoppingCartStatus.Opened })
      .expect(200);
  };

  const loadShoppingCart: TestRequest = (request) =>
    request
      .get(`/shopping-carts/${sessionId}`)
      .expect(200)
      .expect((response) => {
        shoppingCart = response.body as CartUpsert;
      });

  const saveShoppingCart = (
    request: Parameters<TestRequest>[0],
    change: Partial<CartUpsert>,
  ) => {
    shoppingCart = { ...shoppingCart, ...change };

    return request.post(`/shopping-carts/${sessionId}`).send(shoppingCart);
  };

  const addTwoPairsOfShoes: TestRequest = (request) =>
    saveShoppingCart(request, {
      items: [...shoppingCart.items, twoPairsOfShoesItem],
    }).expect(200);

  const addTShirt: TestRequest = (request) =>
    tryToAddTShirt(request).expect(200);

  const tryToAddTShirt: TestRequest = (request) =>
    saveShoppingCart(request, {
      items: [...shoppingCart.items, tShirtItem],
    });

  const removePairOfShoes: TestRequest = (request) =>
    saveShoppingCart(request, {
      items: [pairOfShoesItem, tShirtItem],
    }).expect(200);

  const confirmShoppingCart: TestRequest = (request) =>
    saveShoppingCart(request, confirmedData).expect(200);

  const getShoppingCartDetails: TestRequest = (request) =>
    request.get(`/shopping-carts/${sessionId}`);

  const expectShoppingCart =
    (expected: Record<string, unknown>): E2EResponseAssert =>
    (response) => {
      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({ sessionId, ...expected });
      expect(typeof (response.body as { id: unknown }).id).toBe('number');
    };
});

const startedAt = Date.now();
const commandTime = (commandNumber: number) =>
  new Date(startedAt + commandNumber * 1000).toJSON();

const twoPairsOfShoes = { productId: 123, quantity: 2 };
const tShirt = { productId: 456, quantity: 1 };
const pairOfShoes = { productId: 123, quantity: 1 };

const twoPairsOfShoesItem: CartItemUpsert = {
  ...twoPairsOfShoes,
  content: 'shoes',
  discount: 10,
  price: 200,
  sku: 'shoes-123',
};
const tShirtItem: CartItemUpsert = {
  ...tShirt,
  content: 'tshirt',
  discount: 20,
  price: 100,
  sku: 'tshirt-123',
};
const pairOfShoesItem: CartItemUpsert = { ...twoPairsOfShoesItem, quantity: 1 };

const confirmedData = {
  city: 'Legnica',
  content: 'Some content',
  country: 'Poland',
  email: 'oskar@someemail.pl',
  firstName: 'Oskar',
  middleName: 'the',
  lastName: 'Grouch',
  line1: 'line 1',
  line2: 'line 2',
  mobile: '123456789',
  province: 'Sesame street',
  status: ShoppingCartStatus.Confirmed,
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
