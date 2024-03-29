import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { config } from '#config';
import { Subscription } from '#core/eventStore/subscribing';
import { setupCashRegister } from '#testing/builders/setupCashRegister';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '#testing/eventStoreDB/eventStoreDBContainer';
import {
  MongoDBContainer,
  StartedMongoDBContainer,
} from '@testcontainers/mongodb';
import { retry } from '#testing/retries';
import app from '../app';
import { getSubscription } from '../getSubscription';
import { toWeakETag } from '#core/http/requests';

describe('Full flow', () => {
  let esdbContainer: StartedEventStoreDBContainer;
  let mongodbContainer: StartedMongoDBContainer;
  let subscription: Subscription;

  beforeAll(async () => {
    esdbContainer = await new EventStoreDBContainer().start();
    config.eventStoreDB.connectionString = esdbContainer.getConnectionString();

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
    await esdbContainer.stop();
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
