import {
  MongoDBContainer,
  StartedMongoDBContainer,
  given,
} from '#testing/mongoDB';
import { Collection, MongoClient } from 'mongodb';
import { mongoObjectId } from '#core/mongoDB';
import {
  getShoppingCartsCollection,
  projectToShoppingCartDetails,
  ShoppingCartDetails,
  ShoppingCartStatus,
} from './shoppingCartDetails';

describe('Shopping Cart details', () => {
  let mongoContainer: StartedMongoDBContainer;
  let mongo: MongoClient;
  let shoppingCarts: Collection<ShoppingCartDetails>;

  beforeAll(async () => {
    mongoContainer = await new MongoDBContainer().start();
    console.log(mongoContainer.getConnectionString());
    mongo = mongoContainer.getClient();
    await mongo.connect();
    shoppingCarts = getShoppingCartsCollection(mongo);
  });

  afterAll(async () => {
    await mongo.close();
    await mongoContainer.stop();
  });

  describe('On ShoppingCartOpened event', () => {
    it('should set up an empty shopping cart', async () => {
      const shoppingCartId: string = mongoObjectId();
      const clientId = mongoObjectId();
      const openedAt = new Date().toISOString();

      await given(shoppingCarts, {
        type: 'ShoppingCartOpened',
        data: {
          shoppingCartId,
          clientId,
          openedAt,
        },
      })
        .when(projectToShoppingCartDetails(mongo))
        .then(shoppingCartId, {
          clientId,
          revision: 0,
          openedAt,
          status: ShoppingCartStatus.Pending,
          productItems: [],
        });
    });

    it('should be idempotent if run twice', async () => {
      const shoppingCartId: string = mongoObjectId();
      const clientId = mongoObjectId();
      const openedAt = new Date().toISOString();

      const shoppingCartOpened = {
        type: 'ShoppingCartOpened',
        data: {
          shoppingCartId,
          clientId,
          openedAt,
        },
      };

      await given(shoppingCarts, shoppingCartOpened, shoppingCartOpened)
        .when(projectToShoppingCartDetails(mongo))
        .then(
          shoppingCartId,
          {
            clientId,
            revision: 0,
            openedAt,
            status: ShoppingCartStatus.Pending,
            productItems: [],
          },
          { changed: 1 }
        );
    });
  });
});
