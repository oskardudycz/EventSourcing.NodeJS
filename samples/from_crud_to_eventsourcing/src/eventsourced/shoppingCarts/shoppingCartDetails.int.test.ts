import { config } from '#config';
import { disconnectFromPostgres, runPostgresMigrations } from '#core/postgres';
import { SQL } from '@event-driven-io/dumbo';
import {
  eventInStream,
  eventsInStream,
  expectSQL,
  PostgreSQLProjectionSpec,
} from '@event-driven-io/emmett-postgresql';
import { v4 as uuid } from 'uuid';
import { afterAll, beforeAll, beforeEach, describe, inject, it } from 'vitest';
import type {
  ProductItemAddedToShoppingCart,
  ShoppingCartEvent,
  ShoppingCartOpened,
} from './shoppingCart';
import { ShoppingCartStatus, toShoppingCartStreamName } from './shoppingCart';
import { shoppingCartDetailsProjection } from './shoppingCartDetails';

describe('Shopping cart details projection', () => {
  it('stores opened shopping cart in the cart table', () =>
    given([])
      .when([eventInStream(streamName, opened)])
      .then(
        expectSQL
          .query(
            SQL`SELECT "sessionId", "status", "userId" FROM "ecommerce"."cart" WHERE "sessionId" = ${shoppingCartId}`,
          )
          .resultRows.toBeTheSame([
            {
              sessionId: shoppingCartId,
              status: ShoppingCartStatus.Opened,
              userId: null,
            },
          ]),
      ));

  it('sums quantity when the same product is added twice', () =>
    given(eventsInStream(streamName, [opened, shoesAdded]))
      .when([eventInStream(streamName, shoesAdded)])
      .then(
        expectSQL
          .query(cartItems())
          .resultRows.toBeTheSame([
            { productId: 123, quantity: 4, sku: 'shoes-123' },
          ]),
      ));

  it('removes cart item when its whole quantity is removed', () =>
    given(eventsInStream(streamName, [opened, shoesAdded]))
      .when([
        eventInStream(streamName, {
          type: 'product-item-removed-from-shopping-cart',
          data: {
            shoppingCartId,
            productItem: shoesAdded.data.productItem,
            removedAt: now,
          },
        }),
      ])
      .then(expectSQL.query(cartItems()).resultRows.toBeTheSame([])));

  it('stores user data of confirmed shopping cart', () =>
    given(eventsInStream(streamName, [opened, shoesAdded]))
      .when([
        eventInStream(streamName, {
          type: 'shopping-cart-confirmed',
          data: {
            shoppingCartId,
            user: {
              id: 1694,
              firstName: 'Oskar',
              lastName: 'Grouch',
              email: 'oskar@someemail.pl',
              address: {
                city: 'Legnica',
                province: 'Sesame street',
                country: 'Poland',
              },
            },
            additionalInfo: { line1: 'line 1' },
            confirmedAt: now,
          },
        }),
      ])
      .then(
        expectSQL
          .query(
            SQL`SELECT "status", "firstName", "city", "line1", "line2" FROM "ecommerce"."cart" WHERE "sessionId" = ${shoppingCartId}`,
          )
          .resultRows.toBeTheSame([
            {
              status: ShoppingCartStatus.Confirmed,
              firstName: 'Oskar',
              city: 'Legnica',
              line1: 'line 1',
              line2: null,
            },
          ]),
      ));

  let given: PostgreSQLProjectionSpec<ShoppingCartEvent>;
  let shoppingCartId: string;
  let streamName: string;
  let opened: ShoppingCartOpened;
  let shoesAdded: ProductItemAddedToShoppingCart;
  const now = new Date().toJSON();

  beforeAll(async () => {
    config.postgres.connectionString = inject('postgreSQLConnectionString');
    await runPostgresMigrations();

    given = PostgreSQLProjectionSpec.for({
      projection: shoppingCartDetailsProjection,
      connectionString: config.postgres.connectionString,
    });
  });

  afterAll(async () => {
    await disconnectFromPostgres();
  });

  beforeEach(() => {
    shoppingCartId = uuid();
    streamName = toShoppingCartStreamName(shoppingCartId);
    opened = {
      type: 'shopping-cart-opened',
      data: { shoppingCartId, openedAt: now },
    };
    shoesAdded = {
      type: 'product-item-added-to-shopping-cart',
      data: {
        shoppingCartId,
        productItem: {
          productId: 123,
          quantity: 2,
          sku: 'shoes-123',
          price: 200,
          discount: 10,
        },
        addedAt: now,
      },
    };
  });

  const cartItems = () =>
    SQL`
      SELECT ci."productId"::int AS "productId", ci."quantity", ci."sku"
      FROM "ecommerce"."cart_item" ci
      JOIN "ecommerce"."cart" c ON c."id" = ci."cartId"
      WHERE c."sessionId" = ${shoppingCartId}
      ORDER BY ci."productId"`;
});
