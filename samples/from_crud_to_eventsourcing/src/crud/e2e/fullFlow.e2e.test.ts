import { config } from '#config';
import { getApplication } from '#core/api';
import { disconnectFromPostgres, runPostgresMigration } from '#core/postgres';
import { Application } from 'express';
import request from 'supertest';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from 'testcontainers';
import { v4 as uuid } from 'uuid';
import { router } from '../shoppingCarts/routes';
import { ShoppingCartStatus } from '../shoppingCarts/shoppingCart';

describe('Full flow', () => {
  // let esdbContainer: StartedEventStoreDBContainer;
  let postgresContainer: StartedPostgreSqlContainer;
  const sessionId = uuid();
  let app: Application;

  beforeAll(async () => {
    app = getApplication(router);

    // esdbContainer = await new EventStoreDBContainer().start();
    // config.eventStoreDB.connectionString = esdbContainer.getConnectionString();

    postgresContainer = await new PostgreSqlContainer().start();
    config.postgres.connectionString = `postgres://${postgresContainer.getUsername()}:${postgresContainer.getPassword()}@localhost:${postgresContainer.getPort()}/${postgresContainer.getDatabase()}`;
    config.postgres.schemaName = 'ecommerce';
    console.log(config.postgres.connectionString);

    runPostgresMigration({
      connectionString: config.postgres.connectionString,
      migrationsPath: './src/crud/migrations/',
    });
  });

  afterAll(async () => {
    await disconnectFromPostgres();
    await postgresContainer.stop();
  });

  describe('Shopping Cart', () => {
    // let shoppingCartId: string;
    // let currentRevision: string;
    // const firstProductId: string = uuid();

    it('should go through whole flow successfuly', async () => {
      await request(app)
        .post(`/shopping-carts/${sessionId}`)
        .send({
          status: ShoppingCartStatus.Opened,
        })
        .expect(200);
      // .then(async (_response) => {
      //   // expect(response.body).toHaveProperty('id');
      //   // expect(response.headers['etag']).toBeDefined();
      //   // expect(response.headers['etag']).toMatch(/W\/"\d+.*"/);
      //   // expect(response.headers['location']).toBeDefined();
      //   // expect(response.headers['location']).toBe(
      //   //   `/clients/${sessionId}/shopping-carts/${response.body.id}`
      //   // );
      //   // currentRevision = response.headers['etag'];
      //   // shoppingCartId = response.body.id;
      // });

      // await request(app)
      //   .get(`/clients/${sessionId}/shopping-carts/${shoppingCartId}`)
      //   .expect(200)
      //   .expect('Content-Type', /json/);

      // await request(app)
      //   .post(
      //     `/clients/${sessionId}/shopping-carts/${shoppingCartId}/product-items`
      //   )
      //   .set('If-Match', currentRevision)
      //   .send({ productId: firstProductId, quantity: 10 })
      //   .expect(200)
      //   .expect('Content-Type', /plain/)
      //   .then(async (response) => {
      //     expect(response.headers['etag']).toBeDefined();
      //     expect(response.headers['etag']).toMatch(/W\/"\d+.*"/);

      //     currentRevision = response.headers['etag'];
      //   });

      // await request(app)
      //   .delete(
      //     `/clients/${sessionId}/shopping-carts/${shoppingCartId}/product-items`
      //   )
      //   .set('If-Match', currentRevision)
      //   .send({ productId: firstProductId, quantity: 5 })
      //   .expect(200)
      //   .expect('Content-Type', /plain/)
      //   .then(async (response) => {
      //     expect(response.headers['etag']).toBeDefined();
      //     expect(response.headers['etag']).toMatch(/W\/"\d+.*"/);

      //     currentRevision = response.headers['etag'];
      //   });

      // await request(app)
      //   .get(`/clients/${sessionId}/shopping-carts/${shoppingCartId}`)
      //   .expect(200)
      //   .expect('Content-Type', /json/);
    });
  });
});
