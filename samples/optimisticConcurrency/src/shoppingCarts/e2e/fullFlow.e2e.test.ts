import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { config } from '#config';
import { Subscription } from '#core/eventStore/subscribing';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '#testing/eventStoreDB/eventStoreDBContainer';
import {
  MongoDBContainer,
  StartedMongoDBContainer,
} from '#testing/mongoDB/mongoDBContainer';
import { retryTest } from '#testing/retries';
import app from '../../app';
import { getSubscription } from '../../getSubscription';
import { disconnectFromMongoDB } from '#core/mongoDB';

describe('Full flow', () => {
  let esdbContainer: StartedEventStoreDBContainer;
  let mongodbContainer: StartedMongoDBContainer;
  let subscription: Subscription;
  const clientId = uuid();

  beforeAll(async () => {
    esdbContainer = await new EventStoreDBContainer().startContainer();
    config.eventStoreDB.connectionString = esdbContainer.getConnectionString();

    mongodbContainer = await new MongoDBContainer().startContainer();
    config.mongoDB.connectionString = mongodbContainer.getConnectionString();
    console.log(config.mongoDB.connectionString);

    const subscriptionResult = getSubscription();

    if (subscriptionResult.isError) {
      console.error(subscriptionResult.error);
      return;
    }

    subscription = subscriptionResult.value;
    subscription.subscribe();
  });

  afterAll(async () => {
    try {
      await subscription.unsubscribe();
    } catch (err) {
      console.warn(`Failed to unsubscribe: ${err}`);
    }
    await disconnectFromMongoDB();
    await esdbContainer.stop();
    await mongodbContainer.stop();
  });

  describe('Shopping Cart', () => {
    let shoppingCartId: string;
    let currentRevision: string;
    let firstProductId: string = uuid();

    it("should open when it wasn't open yet", async () => {
      await request(app)
        .post(`/clients/${clientId}/shopping-carts`)
        .expect(201)
        .expect('Content-Type', /json/)
        .then(async (response) => {
          expect(response.body).toHaveProperty('id');
          expect(response.headers['etag']).toBeDefined();
          expect(response.headers['etag']).toMatch(/W\/"\d+.*"/);

          expect(response.headers['location']).toBeDefined();
          expect(response.headers['location']).toBe(
            `/clients/${clientId}/shopping-carts/${response.body.id}`
          );

          currentRevision = response.headers['etag'];
          shoppingCartId = response.body.id;
        });

      await request(app)
        .post(
          `/clients/${clientId}/shopping-carts/${shoppingCartId}/product-items`
        )
        .set('If-Match', currentRevision)
        .send({ productId: firstProductId, quantity: 10 })
        .expect(200)
        .expect('Content-Type', /plain/)
        .then(async (response) => {
          expect(response.headers['etag']).toBeDefined();
          expect(response.headers['etag']).toMatch(/W\/"\d+.*"/);

          currentRevision = response.headers['etag'];
        });

      await request(app)
        .delete(
          `/clients/${clientId}/shopping-carts/${shoppingCartId}/product-items`
        )
        .set('If-Match', currentRevision)
        .send({ productId: firstProductId, quantity: 5 })
        .expect(200)
        .expect('Content-Type', /plain/)
        .then(async (response) => {
          expect(response.headers['etag']).toBeDefined();
          expect(response.headers['etag']).toMatch(/W\/"\d+.*"/);

          currentRevision = response.headers['etag'];
        });

      await retryTest(() =>
        request(app)
          .get(`/clients/${clientId}/shopping-carts/${shoppingCartId}`)
          .expect(200)
          .expect('Content-Type', /json/)
      );
    });
  });
});
