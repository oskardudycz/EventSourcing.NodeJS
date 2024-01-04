import { MongoDBContainer } from '@testcontainers/mongodb';
import { MongoClient } from 'mongodb';
import { mongoObjectId } from '#core/mongoDB';
import {
  getShoppingCartsCollection,
  projectToShoppingCartDetails,
  ShoppingCartDetails,
  ShoppingCartStatus,
} from './shoppingCartDetails';
import { ShoppingCartEvent } from '../shoppingCart';
import { PricedProductItem } from 'src/gist';
import { Spec } from '#testing/mongoDB/mongoDbProjectionTests';

describe('Shopping Cart details', () => {
  let mongo: MongoClient;
  let given: Spec<ShoppingCartEvent, ShoppingCartDetails>;

  beforeAll(async () => {
    const mongoContainer = await new MongoDBContainer('mongo:6.0.12').start();
    console.log(mongoContainer.getConnectionString());
    mongo = new MongoClient(mongoContainer.getConnectionString(), {
      directConnection: true,
    });
    await mongo.connect();

    given = Spec.for(
      getShoppingCartsCollection(mongo),
      projectToShoppingCartDetails(mongo),
    );
  });

  afterAll(async () => {
    if (mongo) await mongo.close();
  });

  describe('On ShoppingCartOpened event', () => {
    it('should set up an empty shopping cart', async () => {
      const shoppingCartId: string = mongoObjectId();
      const clientId = mongoObjectId();
      const openedAt = new Date().toISOString();

      await given()
        .when({
          type: 'ShoppingCartOpened',
          data: {
            shoppingCartId,
            clientId,
            openedAt,
          },
        })
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

      const shoppingCartOpened: ShoppingCartEvent = {
        type: 'ShoppingCartOpened',
        data: {
          shoppingCartId,
          clientId,
          openedAt,
        },
      };

      await given(shoppingCartOpened)
        .when({ event: shoppingCartOpened, revision: 0n })
        .thenNotUpdated();
    });
  });

  describe('On ProductItemAddedToShoppingCart event', () => {
    it('should add product item to items list', async () => {
      const shoppingCartId: string = mongoObjectId();
      const clientId = mongoObjectId();
      const openedAt = new Date().toISOString();

      const productItem: PricedProductItem = {
        productId: mongoObjectId(),
        quantity: 2,
        price: 123,
      };

      await given(opened({ shoppingCartId, clientId, openedAt }))
        .when({
          type: 'ProductItemAddedToShoppingCart',
          data: {
            shoppingCartId,
            productItem,
          },
        })
        .then(shoppingCartId, {
          clientId,
          revision: 1,
          openedAt,
          status: ShoppingCartStatus.Pending,
          productItems: [productItem],
        });
    });

    it('should be idempotent if run twice', async () => {
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

      await given(opened({ shoppingCartId }), productItemAdded)
        .when({ event: productItemAdded, revision: 1n })
        .thenNotUpdated();
    });
  });

  describe('On ProductItemRemovedFromShoppingCart event', () => {
    it('should decrease existing product item quantity', async () => {
      const shoppingCartId: string = mongoObjectId();
      const clientId = mongoObjectId();
      const openedAt = new Date().toISOString();

      const productId = mongoObjectId();
      const price = 123;
      const initialQuantity = 20;
      const removedQuantity = 9;

      await given(
        opened({ shoppingCartId, clientId, openedAt }),
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
        .then(shoppingCartId, {
          clientId,
          revision: 2,
          openedAt,
          status: ShoppingCartStatus.Pending,
          productItems: [
            {
              productId,
              quantity: initialQuantity - removedQuantity,
              price,
            },
          ],
        });
    });

    it('should be idempotent if run twice', async () => {
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
        opened({ shoppingCartId }),
        productItemAdded(shoppingCartId, {
          productId,
          quantity: initialQuantity,
          price,
        }),
        productItemRemoved,
      )
        .when({ event: productItemRemoved, revision: 2n })
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
  productItem: PricedProductItem,
): ShoppingCartEvent => {
  return {
    type: 'ProductItemAddedToShoppingCart',
    data: {
      shoppingCartId,
      productItem,
    },
  };
};
