import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { config } from '#config';
import type { Subscription } from '#core/eventStore/subscribing';
import type { StartedKurrentDBContainer } from '#testing/kurrentDB/kurrentDBContainer';
import { KurrentDBContainer } from '#testing/kurrentDB/kurrentDBContainer';
import type { StartedMongoDBContainer } from '@testcontainers/mongodb';
import { MongoDBContainer } from '@testcontainers/mongodb';
import app from '../../app';
import { getSubscription } from '../../getSubscription';
import { disconnectFromMongoDB } from '#core/mongoDB';
import type { TestResponse } from '#testing/api/testResponse';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Full flow', () => {
  let kurrentDBContainer: StartedKurrentDBContainer;
  let mongodbContainer: StartedMongoDBContainer;
  let subscription: Subscription;
  const clientId = uuid();

  beforeAll(async () => {
    kurrentDBContainer = await new KurrentDBContainer().start();
    config.kurrentDB.connectionString =
      kurrentDBContainer.getConnectionString();

    mongodbContainer = await new MongoDBContainer('mongo:6.0.12').start();
    config.mongoDB.connectionString = mongodbContainer.getConnectionString();
    console.log(config.mongoDB.connectionString);

    const subscriptionResult = getSubscription();

    if (subscriptionResult.isError) {
      console.error(subscriptionResult.error);
      return;
    }

    subscription = subscriptionResult.value;
    void subscription.subscribe();
  });

  afterAll(async () => {
    try {
      await subscription.unsubscribe();
    } catch (err) {
      console.warn(err);
    }
    await disconnectFromMongoDB();
    await mongodbContainer.stop();
    await kurrentDBContainer.stop();
  });

  describe('Shopping Cart', () => {
    let shoppingCartId: string;
    let currentRevision: string;
    const firstProductId: string = uuid();

    it("should open when it wasn't open yet", async () => {
      let response = (await request(app)
        .post(`/clients/${clientId}/shopping-carts`)
        .expect(201)
        .expect('Content-Type', /json/)) as TestResponse<{ id: string }>;

      if (!response.body.id) {
        expect(false).toBeTruthy();
        return;
      }

      expect(response.headers['etag']).toBeDefined();
      expect(response.headers['etag']).toMatch(/W\/"\d+.*"/);

      expect(response.headers['location']).toBeDefined();
      expect(response.headers['location']).toBe(
        `/clients/${clientId}/shopping-carts/${response.body.id}`,
      );

      currentRevision = response.headers['etag'];
      shoppingCartId = response.body.id;

      await request(app)
        .get(`/clients/${clientId}/shopping-carts/${shoppingCartId}`)
        .expect(200)
        .expect('Content-Type', /json/);

      response = await request(app)
        .post(
          `/clients/${clientId}/shopping-carts/${shoppingCartId}/product-items`,
        )
        .set('If-Match', currentRevision)
        .send({ productId: firstProductId, quantity: 10 })
        .expect(200)
        .expect('Content-Type', /plain/);

      expect(response.headers['etag']).toBeDefined();
      expect(response.headers['etag']).toMatch(/W\/"\d+.*"/);

      currentRevision = response.headers['etag'];

      response = await request(app)
        .delete(
          `/clients/${clientId}/shopping-carts/${shoppingCartId}/product-items?productId=${firstProductId}&quantity=${5}`,
        )
        .set('If-Match', currentRevision)
        .send()
        .expect(200)
        .expect('Content-Type', /plain/);

      expect(response.headers['etag']).toBeDefined();
      expect(response.headers['etag']).toMatch(/W\/"\d+.*"/);

      currentRevision = response.headers['etag'];

      await request(app)
        .get(`/clients/${clientId}/shopping-carts/${shoppingCartId}`)
        .expect(200)
        .expect('Content-Type', /json/);
    });
  });
});
