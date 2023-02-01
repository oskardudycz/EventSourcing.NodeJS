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
import { ShoppingCartEvent } from './shoppingCart';
import { PricedProductItem, ProductItem } from 'src/gist';

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

      const shoppingCartOpened: ShoppingCartEvent = {
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

      await given<ShoppingCartEvent, ShoppingCartDetails>(
        shoppingCarts,
        opened({ shoppingCartId, clientId, openedAt }),
        {
          type: 'ProductItemAddedToShoppingCart',
          data: {
            shoppingCartId,
            productItem,
          },
        }
      )
        .when(projectToShoppingCartDetails(mongo))
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
      const clientId = mongoObjectId();
      const openedAt = new Date().toISOString();

      const productItem: PricedProductItem = {
        productId: mongoObjectId(),
        quantity: 2,
        price: 123,
      };

      const productItemAdded: ShoppingCartEvent = {
        type: 'ProductItemAddedToShoppingCart',
        data: {
          shoppingCartId,
          productItem,
        },
      };

      await given<ShoppingCartEvent, ShoppingCartDetails>(
        shoppingCarts,
        { event: opened({ shoppingCartId, clientId, openedAt }), revision: 0n },
        { event: productItemAdded, revision: 1n },
        { event: productItemAdded, revision: 1n }
      )
        .when(projectToShoppingCartDetails(mongo))
        .then(
          shoppingCartId,
          {
            clientId,
            revision: 1,
            openedAt,
            status: ShoppingCartStatus.Pending,
            productItems: [productItem],
          },
          { changed: 2 }
        );
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

      await given<ShoppingCartEvent, ShoppingCartDetails>(
        shoppingCarts,
        ...openedWithProductItem(
          { shoppingCartId, clientId, openedAt },
          {
            productId,
            quantity: initialQuantity,
            price,
          }
        ),
        {
          type: 'ProductItemRemovedFromShoppingCart',
          data: {
            shoppingCartId,
            productItem: {
              productId,
              quantity: removedQuantity,
              price,
            },
          },
        }
      )
        .when(projectToShoppingCartDetails(mongo))
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
      const clientId = mongoObjectId();
      const openedAt = new Date().toISOString();

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

      await given<ShoppingCartEvent, ShoppingCartDetails>(
        shoppingCarts,
        ...openedWithProductItem(
          { shoppingCartId, clientId, openedAt },
          {
            productId,
            quantity: initialQuantity,
            price,
          }
        ),
        { event: productItemRemoved, revision: 2n },
        { event: productItemRemoved, revision: 2n }
      )
        .when(projectToShoppingCartDetails(mongo))
        .then(
          shoppingCartId,
          {
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
          },
          { changed: 3 }
        );
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

const openedWithProductItem = (
  {
    shoppingCartId,
    clientId,
    openedAt,
  }: {
    shoppingCartId: string;
    clientId?: string;
    openedAt?: string;
    productItem?: PricedProductItem;
  },
  productItem: PricedProductItem
): ShoppingCartEvent[] => {
  return [
    opened({
      shoppingCartId,
      clientId,
      openedAt,
    }),
    {
      type: 'ProductItemAddedToShoppingCart',
      data: {
        shoppingCartId,
        productItem,
      },
    },
  ];
};
