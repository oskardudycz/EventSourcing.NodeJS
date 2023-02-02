import {
  MongoDBContainer,
  Spec,
  StartedMongoDBContainer,
} from '#testing/mongoDB';
import { mongoObjectId } from '#core/mongoDB';
import {
  ClientShoppingHistory,
  getClientShoppingHistoryCollection,
  projectToClientShoppingHistory,
} from './clientShoppingHistory';
import { MongoClient } from 'mongodb';
import { ShoppingCartEvent } from '../shoppingCart';

describe('Client Shopping History', () => {
  let mongoContainer: StartedMongoDBContainer;
  let mongo: MongoClient;
  let given: Spec<ShoppingCartEvent, ClientShoppingHistory>;

  beforeAll(async () => {
    mongoContainer = await new MongoDBContainer().start();
    console.log(mongoContainer.getConnectionString());
    mongo = mongoContainer.getClient();
    await mongo.connect();

    given = Spec.for(
      getClientShoppingHistoryCollection(mongo),
      projectToClientShoppingHistory(mongo)
    );
  });

  afterAll(async () => {
    await mongo.close();
    await mongoContainer.stop();
  });

  describe('On ShoppingCartOpened event', () => {
    it('should add new pending shopping cart to pending', async () => {
      const shoppingCartId: string = mongoObjectId();
      const clientId = mongoObjectId();

      await given()
        .when({
          type: 'ShoppingCartOpened',
          data: {
            shoppingCartId,
            clientId,
            openedAt: new Date().toISOString(),
          },
        })
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
