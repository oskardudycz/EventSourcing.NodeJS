import { getEventStoreDBTestClient } from '#core/testing/eventStoreDB';
import { EventStoreDBClient } from '@eventstore/db-client';
import { Application } from 'express';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { getApplication } from '../../tools/api';
import { HeaderNames, toWeakETag } from '../../tools/etag';
import { getEventStore } from '../../tools/eventStore';
import {
  TestResponse,
  expectNextRevisionInResponseEtag,
  runTwice,
  statuses,
} from '../../tools/testing';
import { mapShoppingCartStreamId, shoppingCartApi } from './api';
import { ShoppingCartService } from './applicationService';
import { ShoppingCartErrors } from './businessLogic';
import { EventStoreRepository } from './core/repository';
import { ShoppingCart, ShoppingCartEvent } from './shoppingCart';

describe('Application logic with optimistic concurrency', () => {
  let app: Application;
  let eventStoreDB: EventStoreDBClient;

  beforeAll(async () => {
    eventStoreDB = await getEventStoreDBTestClient();
    const repository = new EventStoreRepository<
      ShoppingCart,
      ShoppingCartEvent
    >(
      getEventStore(eventStoreDB),
      ShoppingCart.default,
      ShoppingCart.evolve,
      mapShoppingCartStreamId,
    );
    const service = new ShoppingCartService(repository);
    app = getApplication(shoppingCartApi(service));
  });

  afterAll(() => eventStoreDB.dispose());

  it('Should handle requests correctly', async () => {
    const clientId = uuid();
    ///////////////////////////////////////////////////
    // 1. Open Shopping Cart
    ///////////////////////////////////////////////////
    const createResponse = (await runTwice(() =>
      request(app).post(`/clients/${clientId}/shopping-carts`).send(),
    ).expect(statuses(201, 412))) as TestResponse<{ id: string }>;

    let currentRevision = expectNextRevisionInResponseEtag(createResponse);
    const current = createResponse.body;

    if (!current.id) {
      expect(false).toBeTruthy();
      return;
    }
    expect(current.id).toBeDefined();

    const shoppingCartId = current.id;

    ///////////////////////////////////////////////////
    // 2. Add Two Pair of Shoes
    ///////////////////////////////////////////////////
    const twoPairsOfShoes = {
      quantity: 2,
      productId: '123',
    };
    let response = await runTwice(() =>
      request(app)
        .post(
          `/clients/${clientId}/shopping-carts/${shoppingCartId}/product-items`,
        )
        .set(HeaderNames.IF_MATCH, toWeakETag(currentRevision))
        .send(twoPairsOfShoes),
    ).expect(statuses(204, 412));

    currentRevision = expectNextRevisionInResponseEtag(response);

    ///////////////////////////////////////////////////
    // 3. Add T-Shirt
    ///////////////////////////////////////////////////
    const tShirt = {
      productId: '456',
      quantity: 1,
    };
    response = await runTwice(() =>
      request(app)
        .post(
          `/clients/${clientId}/shopping-carts/${shoppingCartId}/product-items`,
        )
        .set(HeaderNames.IF_MATCH, toWeakETag(currentRevision))
        .send(tShirt),
    ).expect(statuses(204, 412));

    currentRevision = expectNextRevisionInResponseEtag(response);

    ///////////////////////////////////////////////////
    // 4. Remove pair of shoes
    ///////////////////////////////////////////////////
    const pairOfShoes = {
      productId: '123',
      quantity: 1,
      unitPrice: 100,
    };
    response = await runTwice(() =>
      request(app)
        .delete(
          `/clients/${clientId}/shopping-carts/${shoppingCartId}/product-items?productId=${pairOfShoes.productId}&quantity=${pairOfShoes.quantity}&unitPrice=${pairOfShoes.unitPrice}`,
        )
        .set(HeaderNames.IF_MATCH, toWeakETag(currentRevision)),
    ).expect(statuses(204, 412));

    currentRevision = expectNextRevisionInResponseEtag(response);

    ///////////////////////////////////////////////////
    // 5. Confirm cart
    ///////////////////////////////////////////////////

    response = await runTwice(() =>
      request(app)
        .post(`/clients/${clientId}/shopping-carts/${shoppingCartId}/confirm`)
        .set(HeaderNames.IF_MATCH, toWeakETag(currentRevision)),
    ).expect(statuses(204, 412));

    currentRevision = expectNextRevisionInResponseEtag(response);

    ///////////////////////////////////////////////////
    // 6. Try Cancel Cart
    ///////////////////////////////////////////////////

    response = await request(app)
      .delete(`/clients/${clientId}/shopping-carts/${shoppingCartId}`)
      .set(HeaderNames.IF_MATCH, toWeakETag(currentRevision))
      .expect((response) => {
        expect(response.statusCode).toBe(500);
        expect(response.body).toMatchObject({
          detail: ShoppingCartErrors.CART_IS_ALREADY_CLOSED,
        });
      });

    const eventStore = getEventStore(eventStoreDB);
    const events = await eventStore.readStream<ShoppingCartEvent>(
      mapShoppingCartStreamId(shoppingCartId),
    );

    expect(events.length).toBe(Number(currentRevision) + 1);

    expect(events).toMatchObject([
      {
        type: 'ShoppingCartOpened',
        data: {
          shoppingCartId,
          clientId,
          //openedAt,
        },
      },
      {
        type: 'ProductItemAddedToShoppingCart',
        data: {
          shoppingCartId,
          productItem: twoPairsOfShoes,
        },
      },
      {
        type: 'ProductItemAddedToShoppingCart',
        data: {
          shoppingCartId,
          productItem: tShirt,
        },
      },
      {
        type: 'ProductItemRemovedFromShoppingCart',
        data: { shoppingCartId, productItem: pairOfShoes },
      },
      {
        type: 'ShoppingCartConfirmed',
        data: {
          shoppingCartId,
          //confirmedAt,
        },
      },
      // This should fail
      // {
      //   type: 'ShoppingCartCanceled',
      //   data: {
      //     shoppingCartId,
      //     canceledAt,
      //   },
      // },
    ]);
  });
});
