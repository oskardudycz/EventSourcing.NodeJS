import app from '../app';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '../testing/eventStoreDB/eventStoreDBContainer';
import { setupCashRegister } from '../testing/builders/setupCashRegister';
import { config } from '#config';
import { Subscription } from '#core/eventStore/subscribing';
import { getSubscription } from '../getSubscription';

describe('Full flow', () => {
  let esdbContainer: StartedEventStoreDBContainer;
  let subscription: Subscription;

  beforeAll(async () => {
    esdbContainer = await new EventStoreDBContainer().startContainer();
    config.eventStoreDB.connectionString = esdbContainer.getConnectionString();
    console.log(config.eventStoreDB.connectionString);

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
  });

  describe('when cash register was placed at workstation', () => {
    let existingCashRegisterId: string;

    beforeEach(async () => {
      existingCashRegisterId = await setupCashRegister(app);
    });

    it('should start shift', () => {
      console.log('test');
    });
  });
});
