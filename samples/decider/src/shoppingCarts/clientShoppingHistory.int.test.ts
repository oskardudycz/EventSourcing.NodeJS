import { config } from '#config';
import {
  MongoDBContainer,
  StartedMongoDBContainer,
} from '#testing/mongoDB/mongoDBContainer';
import { Event } from '#core/decider';
import {
  disconnectFromMongoDB,
  mongoObjectId,
  retryIfNotFound,
} from '#core/mongoDB';
import { SubscriptionResolvedEvent } from '#core/subscriptions';
import { AllStreamRecordedEvent } from '@eventstore/db-client';
import {
  ClientShoppingHistory,
  getClientShoppingHistoryCollection,
  projectToClientShoppingHistory,
} from './clientShoppingHistory';
import { Collection, Document, Filter, MongoClient, ObjectId } from 'mongodb';
import { getShoppingCartsCollection } from './shoppingCartDetails';

describe('Client Shopping History', () => {
  let mongoContainer: StartedMongoDBContainer;
  let mongo: MongoClient;
  let shoppingHistory: Collection<ClientShoppingHistory>;

  beforeAll(async () => {
    mongoContainer = await new MongoDBContainer().start();
    console.log(mongoContainer.getConnectionString());
    mongo = mongoContainer.getClient();
    await mongo.connect();
    shoppingHistory = getClientShoppingHistoryCollection(mongo);
  });

  afterAll(async () => {
    await disconnectFromMongoDB();
    await mongoContainer.stop();
  });

  describe('On ShoppingCartOpened event', () => {
    it('should add new pending shopping cart to pending', async () => {
      const shoppingCartId: string = mongoObjectId();
      const clientId = mongoObjectId();

      await given(shoppingHistory, {
        type: 'ShoppingCartOpened',
        data: {
          shoppingCartId,
          clientId,
          openedAt: new Date().toISOString(),
        },
      })
        .when(projectToClientShoppingHistory(mongo))
        .then(clientId, {
          totalProductsCount: 0,
          totalAmount: 0,
          pending: [
            {
              isDeleted: false,
              shoppingCartId,
              totalAmount: 0,
              totalProductsCount: 0,
            },
          ],
          position: 0,
        });
    });
  });
});

const given = <Doc extends Document, E extends Event>(
  collection: Collection<Doc>,
  ...events: Event[] | { event: E; position: bigint }[]
) => {
  return {
    when: (project: (event: SubscriptionResolvedEvent) => Promise<void>) => {
      return {
        then: async (id: string, expected: Doc) => {
          let position = 0n;

          for (const event of events) {
            const projectedEvent =
              'position' in event
                ? toSubscriptionEvent(event.event, event.position)
                : toSubscriptionEvent(event, position);

            await project(projectedEvent);
            position++;
          }

          await assertUpdated(collection, id, expected);
        },
      };
    },
  };
};

const assertUpdated = async <Doc extends Document>(
  collection: Collection<Doc>,
  id: string,
  expected: Doc
) => {
  const objectId = new ObjectId(id);

  // Yes, MongoDB typings are far from perfect...
  const filterById = {
    _id: new ObjectId(objectId),
  } as unknown as Filter<Doc>;

  const item = await retryIfNotFound(
    async () => await collection.findOne(filterById)
  );

  expect(item).toStrictEqual({ ...expected, _id: objectId });
};

const toSubscriptionEvent = <E extends Event>(
  event: E,
  position: bigint
): SubscriptionResolvedEvent => {
  return {
    subscriptionId: mongoObjectId(),
    event: {
      ...event,
      position: { commit: position, prepare: position },
    } as unknown as AllStreamRecordedEvent,
  };
};
