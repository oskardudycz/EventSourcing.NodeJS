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
    it('should go through whole flow successfuly', async () => {
      // 1. Open Shopping Cart
      await request(app)
        .post(`/shopping-carts/${sessionId}`)
        .send({
          status: ShoppingCartStatus.Opened,
        })
        .expect(200);

      let response = await request(app)
        .get(`/shopping-carts/${sessionId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        sessionId,
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
        content: 'shoes',
        discount: 10,
        productId: 123,
        price: 200,
        quantity: 2,
        sku: 'shoes-123',
      };
      await request(app)
        .post(`/shopping-carts/${sessionId}`)
        .send({
          ...current,
          items: [twoPairsOfShoes],
        })
        .expect(200);

      response = await request(app)
        .get(`/shopping-carts/${sessionId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: current.id,
        createdAt: current.createdAt,
        sessionId,
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
        content: 'tshirt',
        discount: 20,
        productId: 456,
        price: 100,
        quantity: 1,
        sku: 'tshirt-123',
      };
      await request(app)
        .post(`/shopping-carts/${sessionId}`)
        .send({
          ...current,
          items: [...current.items, tShirt],
        })
        .expect(200);

      response = await request(app)
        .get(`/shopping-carts/${sessionId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: current.id,
        createdAt: current.createdAt,
        sessionId,
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
        content: 'shoes',
        discount: 10,
        productId: 123,
        price: 200,
        quantity: 2,
        sku: 'shoes-123',
      };
      await request(app)
        .post(`/shopping-carts/${sessionId}`)
        .send({
          ...current,
          items: [pairOfShoes, tShirt],
        })
        .expect(200);

      response = await request(app)
        .get(`/shopping-carts/${sessionId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: current.id,
        createdAt: current.createdAt,
        sessionId,
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

      // 3. Confirm cart
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
      await request(app)
        .post(`/shopping-carts/${sessionId}`)
        .send({
          ...current,
          ...confirmedData,
        })
        .expect(200);

      response = await request(app)
        .get(`/shopping-carts/${sessionId}`)
        .expect(200);

      const { updatedAt, ...currentWithoutUpdatedAt } = current;

      expect(response.body).toMatchObject({
        ...currentWithoutUpdatedAt,
        ...confirmedData,
        items: [pairOfShoes, tShirt],
      });
      expect(response.body.updatedAt > updatedAt).toBeTruthy();

      current = response.body;

      // 4. Try to add product item
      // It should fail, as cart is already confirmed
      await request(app)
        .post(`/shopping-carts/${sessionId}`)
        .send({
          ...current,
          items: [twoPairsOfShoes, tShirt],
        })
        .expect(412);

      response = await request(app)
        .get(`/shopping-carts/${sessionId}`)
        .expect(200);

      expect(response.body).toMatchObject(current);
    });
  });
});
