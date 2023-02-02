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
import { PricedProductItem } from '../productItem';

describe('Client Shopping History', () => {
  let mongo: MongoClient;
  let given: Spec<ShoppingCartEvent, ClientShoppingHistory>;

  beforeAll(async () => {
    const mongoContainer = await new MongoDBContainer().start();
    console.log(mongoContainer.getConnectionString());
    mongo = mongoContainer.getClient();
    await mongo.connect();

    given = Spec.for(
      getClientShoppingHistoryCollection(mongo),
      projectToClientShoppingHistory(mongo)
    );
  });

  afterAll(async () => {
    if (mongo) await mongo.close();
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
          totalQuantity: 0,
          totalAmount: 0,
          pending: [
            {
              shoppingCartId,
              totalAmount: 0,
              totalQuantity: 0,
            },
          ],
          position: 0,
        });
    });

    it('should be idempotent if run twice', async () => {
      const shoppingCartId: string = mongoObjectId();
      const clientId = mongoObjectId();
      const openedAt = new Date().toISOString();

      const shoppingCartOpened: ShoppingCartEvent = {
        type: 'ShoppingCartOpened',
        data: {
          shoppingCartId,
          clientId,
          openedAt,
        },
      };

      await given(shoppingCartOpened)
        .when({ event: shoppingCartOpened, position: 0n })
        .thenNotUpdated();
    });
  });

  describe('On ProductItemAddedToShoppingCart event', () => {
    it('should add product item to items list', async () => {
      const shoppingCartId: string = mongoObjectId();
      const clientId = mongoObjectId();
      const openedAt = new Date().toISOString();

      const quantity = 2;
      const price = 123;

      const productItem: PricedProductItem = {
        productId: mongoObjectId(),
        quantity,
        price,
      };

      await given(opened({ shoppingCartId, clientId, openedAt }))
        .when({
          type: 'ProductItemAddedToShoppingCart',
          data: {
            shoppingCartId,
            productItem,
          },
        })
        .then(clientId, {
          totalQuantity: 0,
          totalAmount: 0,
          pending: [
            {
              shoppingCartId,
              totalAmount: quantity * price,
              totalQuantity: quantity,
            },
          ],
          position: 1,
        });
    });

    it.only('should be idempotent if run twice', async () => {
      const clientId: string = mongoObjectId();
      const shoppingCartId: string = mongoObjectId();

      const productItemAdded: ShoppingCartEvent = {
        type: 'ProductItemAddedToShoppingCart',
        data: {
          shoppingCartId: clientId,
          productItem: {
            productId: mongoObjectId(),
            quantity: 2,
            price: 123,
          },
        },
      };

      await given(opened({ shoppingCartId, clientId }), productItemAdded)
        .when({ event: productItemAdded, position: 1n })
        .thenNotUpdated();
    });
  });
});

const opened = ({
  shoppingCartId,
  clientId,
  openedAt,
}: {
  shoppingCartId?: string;
  clientId?: string;
  openedAt?: string;
}): ShoppingCartEvent => {
  return {
    type: 'ShoppingCartOpened',
    data: {
      shoppingCartId: shoppingCartId ?? mongoObjectId(),
      clientId: clientId ?? mongoObjectId(),
      openedAt: openedAt ?? new Date().toISOString(),
    },
  };
};

const productItemAdded = (
  shoppingCartId: string,
  productItem: PricedProductItem
): ShoppingCartEvent => {
  return {
    type: 'ProductItemAddedToShoppingCart',
    data: {
      shoppingCartId,
      productItem,
    },
  };
};
