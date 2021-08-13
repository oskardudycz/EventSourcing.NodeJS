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
} from '#testing/mongoDB/mongoDBContainer';
import { retry } from '#testing/retries';
import app from '../app';
import { getSubscription } from '../getSubscription';

describe('Full flow', () => {
  let esdbContainer: StartedEventStoreDBContainer;
  let mongodbContainer: StartedMongoDBContainer;
  let subscription: Subscription;

  beforeAll(async () => {
    esdbContainer = await new EventStoreDBContainer().startContainer();
    config.eventStoreDB.connectionString = esdbContainer.getConnectionString();

    mongodbContainer = await new MongoDBContainer().startContainer();
    config.mongoDB.connectionString = esdbContainer.getConnectionString();
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
          .expect(200)
      );

      await retry(() =>
        request(app)
          .get(`/cash-registers/${existingCashRegisterId}/shifts/current/`)
          .expect(200)
      );
    });

    it('should not allow to close not started shift', async () => {
      await retry(() =>
        request(app)
          .delete(`/cash-registers/${existingCashRegisterId}/shifts/current/`)
          .send({ cashierId: uuid(), float: 0 })
          .expect(200)
      );
    });
  });
});
