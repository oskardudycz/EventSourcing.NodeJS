import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { config } from '#config';
import type { Subscription } from '#core/eventStore/subscribing';
import { setupCashRegister } from '#testing/builders/setupCashRegister';
import type { StartedKurrentDBContainer } from '#testing/kurrentDB/kurrentDBContainer';
import { KurrentDBContainer } from '#testing/kurrentDB/kurrentDBContainer';
import type { StartedMongoDBContainer } from '@testcontainers/mongodb';
import { MongoDBContainer } from '@testcontainers/mongodb';
import { retry } from '#testing/retries';
import app from '../app';
import { getSubscription } from '../getSubscription';
import { toWeakETag } from '#core/http/requests';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

describe('Full flow', () => {
  let kurrentDBContainer: StartedKurrentDBContainer;
  let mongodbContainer: StartedMongoDBContainer;
  let subscription: Subscription;

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
    subscription.subscribe().catch(console.error);
  });

  afterAll(async () => {
    await subscription.unsubscribe();
    await kurrentDBContainer.stop();
    await mongodbContainer.stop();
  });

  describe('when cash register was placed at workstation', () => {
    let existingCashRegisterId: string;

    beforeEach(async () => {
      existingCashRegisterId = await setupCashRegister(app);
    });

    it('should start shift for the first time', async () => {
      await retry(() =>
        request(app)
          .post(`/cash-registers/${existingCashRegisterId}/shifts/current/`)
          .send({ cashierId: uuid(), float: 0 })
          .set('If-Match', toWeakETag(0))
          .expect(200)
          .expect('Content-Type', /plain/),
      );

      await retry(() =>
        request(app)
          .get(`/cash-registers/${existingCashRegisterId}/shifts/current/`)
          .expect(200)
          .expect('Content-Type', /json/),
      );
    });
  });
});
