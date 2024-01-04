import { MongoDBContainer } from '@testcontainers/mongodb';
import { mongoObjectId } from '#core/mongoDB';
import {
  ClientShoppingHistory,
  getClientShoppingHistoryCollection,
  projectToClientShoppingHistory,
} from './clientShoppingHistory';
import { MongoClient } from 'mongodb';
import { ShoppingCartEvent } from '../shoppingCart';
import { PricedProductItem } from '../productItem';
import { Spec } from '#testing/mongoDB/mongoDbProjectionTests';

describe('Client Shopping History', () => {
  let mongo: MongoClient;
  let given: Spec<ShoppingCartEvent, ClientShoppingHistory>;

  beforeAll(async () => {
    const mongoContainer = await new MongoDBContainer('mongo:6.0.12').start();
    console.log(mongoContainer.getConnectionString());
    mongo = new MongoClient(mongoContainer.getConnectionString(), {
      directConnection: true,
    });
    await mongo.connect();

    given = Spec.for(
      getClientShoppingHistoryCollection(mongo),
      projectToClientShoppingHistory(mongo),
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

      const shoppingCartOpened: ShoppingCartEvent = {
        type: 'ShoppingCartOpened',
        data: {
          shoppingCartId,
          clientId,
          openedAt: new Date().toISOString(),
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

      const quantity = 2;
      const price = 123;

      const productItem: PricedProductItem = {
        productId: mongoObjectId(),
        quantity,
        price,
      };

      await given(opened({ shoppingCartId, clientId }))
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

    it('should be idempotent if run twice for the same event', async () => {
      const clientId: string = mongoObjectId();
      const shoppingCartId: string = mongoObjectId();

      const productItemAdded: ShoppingCartEvent = {
        type: 'ProductItemAddedToShoppingCart',
        data: {
          shoppingCartId,
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

    it('should add product items to items list for multiple events', async () => {
      const shoppingCartId: string = mongoObjectId();
      const clientId = mongoObjectId();

      const productId = mongoObjectId();
      const initialQuantity = 2;
      const price = 123;

      const additionalQuantity = 2;

      const productItem: PricedProductItem = {
        productId: mongoObjectId(),
        quantity: additionalQuantity,
        price,
      };

      const totalQuantity = initialQuantity + additionalQuantity;

      await given(
        opened({ shoppingCartId, clientId }),
        productItemAdded(shoppingCartId, {
          productId,
          quantity: initialQuantity,
          price,
        }),
      )
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
              totalAmount: totalQuantity * price,
              totalQuantity,
            },
          ],
          position: 2,
        });
    });
  });

  describe('On ProductItemRemovedFromShoppingCart event', () => {
    it('should decrease existing product item quantity', async () => {
      const shoppingCartId: string = mongoObjectId();
      const clientId = mongoObjectId();

      const productId = mongoObjectId();
      const price = 123;
      const initialQuantity = 20;
      const removedQuantity = 9;

      const totalQuantity = initialQuantity - removedQuantity;

      await given(
        opened({ shoppingCartId, clientId }),
        productItemAdded(shoppingCartId, {
          productId,
          quantity: initialQuantity,
          price,
        }),
      )
        .when({
          type: 'ProductItemRemovedFromShoppingCart',
          data: {
            shoppingCartId,
            productItem: {
              productId,
              quantity: removedQuantity,
              price,
            },
          },
        })
        .then(clientId, {
          totalQuantity: 0,
          totalAmount: 0,
          pending: [
            {
              shoppingCartId,
              totalAmount: totalQuantity * price,
              totalQuantity,
            },
          ],
          position: 2,
        });
    });

    it('should be idempotent if run twice', async () => {
      const clientId: string = mongoObjectId();
      const shoppingCartId: string = mongoObjectId();

      const productId = mongoObjectId();
      const price = 123;
      const initialQuantity = 20;
      const removedQuantity = 9;

      const productItemRemoved: ShoppingCartEvent = {
        type: 'ProductItemRemovedFromShoppingCart',
        data: {
          shoppingCartId,
          productItem: {
            productId,
            quantity: removedQuantity,
            price,
          },
        },
      };

      await given(
        opened({ shoppingCartId, clientId }),
        productItemAdded(shoppingCartId, {
          productId,
          quantity: initialQuantity,
          price,
        }),
        productItemRemoved,
      )
        .when({ event: productItemRemoved, position: 2n })
        .thenNotUpdated();
    });
  });

  describe('On ShoppingCartConfirmed event', () => {
    it('should increase totals and remove shopping cart from pending', async () => {
      const shoppingCartId: string = mongoObjectId();
      const clientId = mongoObjectId();

      const productId = mongoObjectId();
      const price = 123;
      const quantity = 20;

      await given(
        opened({ shoppingCartId, clientId }),
        productItemAdded(shoppingCartId, {
          productId,
          quantity,
          price,
        }),
      )
        .when({
          type: 'ShoppingCartConfirmed',
          data: {
            shoppingCartId,
            confirmedAt: new Date().toISOString(),
          },
        })
        .then(clientId, {
          totalQuantity: quantity,
          totalAmount: quantity * price,
          pending: [],
          position: 2,
        });
    });

    it('should be idempotent if run twice', async () => {
      const clientId: string = mongoObjectId();
      const shoppingCartId: string = mongoObjectId();

      const shoppingCartConfirmed: ShoppingCartEvent = {
        type: 'ShoppingCartConfirmed',
        data: {
          shoppingCartId,
          confirmedAt: new Date().toISOString(),
        },
      };

      await given(
        opened({ shoppingCartId, clientId }),
        productItemAdded(shoppingCartId),
        shoppingCartConfirmed,
      )
        .when({ event: shoppingCartConfirmed, position: 2n })
        .thenNotUpdated();
    });
  });

  describe('On ShoppingCartCanceled event', () => {
    it('should remove shopping cart from pending', async () => {
      const shoppingCartId: string = mongoObjectId();
      const clientId = mongoObjectId();

      const productId = mongoObjectId();
      const price = 123;
      const quantity = 20;

      await given(
        opened({ shoppingCartId, clientId }),
        productItemAdded(shoppingCartId, {
          productId,
          quantity,
          price,
        }),
      )
        .when({
          type: 'ShoppingCartCanceled',
          data: {
            shoppingCartId,
            canceledAt: new Date().toISOString(),
          },
        })
        .then(clientId, {
          totalQuantity: 0,
          totalAmount: 0,
          pending: [],
          position: 2,
        });
    });

    it('should be idempotent if run twice', async () => {
      const clientId: string = mongoObjectId();
      const shoppingCartId: string = mongoObjectId();

      const shoppingCartCanceled: ShoppingCartEvent = {
        type: 'ShoppingCartCanceled',
        data: {
          shoppingCartId,
          canceledAt: new Date().toISOString(),
        },
      };

      await given(
        opened({ shoppingCartId, clientId }),
        productItemAdded(shoppingCartId),
        shoppingCartCanceled,
      )
        .when({ event: shoppingCartCanceled, position: 2n })
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
  productItem?: PricedProductItem,
): ShoppingCartEvent => {
  return {
    type: 'ProductItemAddedToShoppingCart',
    data: {
      shoppingCartId,
      productItem: productItem ?? {
        productId: mongoObjectId(),
        quantity: 20,
        price: 123,
      },
    },
  };
};
