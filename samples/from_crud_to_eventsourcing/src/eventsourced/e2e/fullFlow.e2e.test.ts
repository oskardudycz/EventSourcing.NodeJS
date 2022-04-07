import { config } from '#config';
import { getApplication } from '#core/api';
import { disconnectFromPostgres, runPostgresMigration } from '#core/postgres';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '#testing/eventStoreDB/eventStoreDBContainer';
import { AllStreamSubscription } from '@eventstore/db-client';
import { Application } from 'express';
import request from 'supertest';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from 'testcontainers';
import { disconnectFromEventStore } from '../core/streams';
import { router } from '../shoppingCarts/routes';
import { ShoppingCartStatus } from '../shoppingCarts/shoppingCart';
import { runSubscription } from '../subscriptions';

describe('Full flow', () => {
  let esdbContainer: StartedEventStoreDBContainer;
  let postgresContainer: StartedPostgreSqlContainer;
  let app: Application;
  let subscription: AllStreamSubscription;

  beforeAll(async () => {
    app = getApplication(router);

    esdbContainer = await new EventStoreDBContainer().start();
    config.eventStoreDB.connectionString = esdbContainer.getConnectionString();
    console.log(config.eventStoreDB.connectionString);

    postgresContainer = await new PostgreSqlContainer().start();
    config.postgres.connectionString = `postgres://${postgresContainer.getUsername()}:${postgresContainer.getPassword()}@localhost:${postgresContainer.getPort()}/${postgresContainer.getDatabase()}`;
    config.postgres.schemaName = 'ecommerce';
    console.log(config.postgres.connectionString);

    runPostgresMigration({
      connectionString: config.postgres.connectionString,
      migrationsPath: './src/crud/migrations/',
    });
    runPostgresMigration({
      connectionString: config.postgres.connectionString,
      migrationsPath: './src/eventsourced/migrations/',
    });

    subscription = await runSubscription();
  });

  afterAll(async () => {
    await subscription.unsubscribe();
    await disconnectFromEventStore();
    await esdbContainer.stop();

    await disconnectFromPostgres();
    await postgresContainer.stop();
  });

  describe('Shopping Cart', () => {
    let shoppingCartId: string;
    let currentRevision: string;
    let lastRevision: string;
    // const firstProductId: string = uuid();

    it('should go through whole flow successfuly', async () => {
      // 1. Open Shopping Cart
      let response = await request(app)
        .post(`/v2/shopping-carts`)
        .send({
          status: ShoppingCartStatus.Opened,
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.headers['etag']).toBeDefined();
      expect(response.headers['etag']).toMatch(/W\/"\d+.*"/);

      expect(response.headers['location']).toBeDefined();
      expect(response.headers['location']).toBe(
        `/v2/shopping-carts/${response.body.id}`
      );

      currentRevision = response.headers['etag'];
      shoppingCartId = response.body.id;

      response = await request(app)
        .get(`/v2/shopping-carts/${shoppingCartId}`)
        //.set('If-Not-Match', lastRevision)
        .expect(200);

      expect(response.headers['etag']).toBe(currentRevision);
      lastRevision = response.headers['etag'];

      expect(response.body).toMatchObject({
        sessionId: shoppingCartId,
        city: null,
        content: null,
        country: null,
        email: null,
        firstName: null,
        items: [],
        lastName: null,
        line1: null,
        line2: null,
        middleName: null,
        mobile: null,
        province: null,
        updatedAt: null,
        userId: null,
        status: ShoppingCartStatus.Opened,
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('createdAt');
      let current = response.body;

      // 2. Add product item
      const twoPairsOfShoes = {
        quantity: 2,
        productId: 123,
      };
      response = await request(app)
        .post(`/v2/shopping-carts/${shoppingCartId}/product-items`)
        .set('If-Match', currentRevision)
        .send(twoPairsOfShoes)
        .expect(200);

      expect(response.headers['etag']).toBeDefined();
      expect(response.headers['etag']).toMatch(/W\/"\d+.*"/);
      currentRevision = response.headers['etag'];

      response = await request(app)
        .get(`/v2/shopping-carts/${shoppingCartId}`)
        .set('If-Not-Match', lastRevision)
        .expect(200);

      expect(response.headers['etag']).toBe(currentRevision);
      lastRevision = response.headers['etag'];

      expect(response.body).toMatchObject({
        id: current.id,
        createdAt: current.createdAt,
        sessionId: shoppingCartId,
        city: null,
        content: null,
        country: null,
        email: null,
        firstName: null,
        items: [twoPairsOfShoes],
        lastName: null,
        line1: null,
        line2: null,
        middleName: null,
        mobile: null,
        province: null,
        userId: null,
        status: ShoppingCartStatus.Opened,
      });
      expect(response.body.updatedAt).not.toBeNull();
      current = response.body;

      // 3. Add another item
      const tShirt = {
        productId: 456,
        quantity: 1,
      };
      response = await request(app)
        .post(`/v2/shopping-carts/${shoppingCartId}/product-items`)
        .set('If-Match', currentRevision)
        .send(tShirt)
        .expect(200);

      expect(response.headers['etag']).toBeDefined();
      expect(response.headers['etag']).toMatch(/W\/"\d+.*"/);
      currentRevision = response.headers['etag'];

      response = await request(app)
        .get(`/v2/shopping-carts/${shoppingCartId}`)
        .set('If-Not-Match', lastRevision)
        .expect(200);

      expect(response.headers['etag']).toBe(currentRevision);
      lastRevision = response.headers['etag'];

      expect(response.body).toMatchObject({
        id: current.id,
        createdAt: current.createdAt,
        sessionId: shoppingCartId,
        city: null,
        content: null,
        country: null,
        email: null,
        firstName: null,
        items: [twoPairsOfShoes, tShirt],
        lastName: null,
        line1: null,
        line2: null,
        middleName: null,
        mobile: null,
        province: null,
        userId: null,
        status: ShoppingCartStatus.Opened,
      });
      expect(response.body.updatedAt > current.updatedAt).toBeTruthy();
      current = response.body;

      // 3. Remove one item
      const pairOfShoes = {
        productId: 123,
        quantity: 1,
      };
      response = await request(app)
        .delete(
          `/v2/shopping-carts/${shoppingCartId}/product-items?productId=${pairOfShoes.productId}&quantity=${pairOfShoes.quantity}`
        )
        .set('If-Match', currentRevision)
        .expect(200);

      expect(response.headers['etag']).toBeDefined();
      expect(response.headers['etag']).toMatch(/W\/"\d+.*"/);
      currentRevision = response.headers['etag'];

      response = await request(app)
        .get(`/v2/shopping-carts/${shoppingCartId}`)
        .set('If-Not-Match', lastRevision)
        .expect(200);

      expect(response.headers['etag']).toBe(currentRevision);
      lastRevision = response.headers['etag'];

      expect(response.body).toMatchObject({
        id: current.id,
        createdAt: current.createdAt,
        sessionId: shoppingCartId,
        city: null,
        content: null,
        country: null,
        email: null,
        firstName: null,
        items: [pairOfShoes, tShirt],
        lastName: null,
        line1: null,
        line2: null,
        middleName: null,
        mobile: null,
        province: null,
        userId: null,
        status: ShoppingCartStatus.Opened,
      });
      expect(response.body.updatedAt > current.updatedAt).toBeTruthy();
      current = response.body;

      // 3. Confirm cart
      const userId = 1694;
      const confirmedData = {
        content: 'Some content',
        line1: 'line 1',
        line2: 'line 2',
      };

      response = await request(app)
        .put(`/v2/users/${userId}/shopping-carts/${shoppingCartId}`)
        .set('If-Match', currentRevision)
        .send(confirmedData)
        .expect(200);

      expect(response.headers['etag']).toBeDefined();
      expect(response.headers['etag']).toMatch(/W\/"\d+.*"/);
      currentRevision = response.headers['etag'];

      response = await request(app)
        .get(`/v2/shopping-carts/${shoppingCartId}`)
        .set('If-Not-Match', lastRevision)
        .expect(200);

      expect(response.headers['etag']).toBe(currentRevision);
      lastRevision = response.headers['etag'];

      expect(response.body).toMatchObject({
        id: current.id,
        createdAt: current.createdAt,
        sessionId: shoppingCartId,
        items: [pairOfShoes, tShirt],
        status: ShoppingCartStatus.Confirmed,
        ...confirmedData,
      });
      expect(response.body.updatedAt > current.updatedAt).toBeTruthy();
      current = response.body;

      // response = await request(app)
      //   .get(`/shopping-carts/${shoppingCartId}`)
      //   .expect(200);

      // const { updatedAt, ...currentWithoutUpdatedAt } = current;

      // expect(response.body).toMatchObject({
      //   ...currentWithoutUpdatedAt,
      //   ...confirmedData,
      //   items: [pairOfShoes, tShirt],
      // });
      // expect(response.body.updatedAt > updatedAt).toBeTruthy();

      // current = response.body;

      // // 4. Try to add product item
      // // It should fail, as cart is already confirmed
      // await request(app)
      //   .post(`/shopping-carts/${shoppingCartId}`)
      //   .send({
      //     ...current,
      //     items: [twoPairsOfShoes, tShirt],
      //   })
      //   .expect(412);

      // response = await request(app)
      //   .get(`/shopping-carts/${shoppingCartId}`)
      //   .expect(200);

      // expect(response.body).toMatchObject(current);
    });
  });
});
