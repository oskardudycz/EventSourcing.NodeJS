import { getById, MongoDbRepository } from '#core/repositories';
import { Collection, MongoClient, ObjectId } from 'mongodb';
import { ProductItem } from 'src/onion/ecommerce/common/shoppingCarts/productItem';
import { ShoppingCartModel } from 'src/unpeeled/ecommerce/shoppingCarts/models/shoppingCart';
import { ShoppingCart, ShoppingCartStatus } from '..';
import { ShoppingCartEvent } from '../events';

export class ShoppingCartRepository extends MongoDbRepository<ShoppingCartModel> {
  constructor(mongo: MongoClient) {
    super(mongo, 'shoppingCarts');
  }

  async findAllByCustomerId(customerId: string): Promise<ShoppingCartModel[]> {
    return this.collection.find({ customerId }).toArray();
  }
}

export const getShoppingCart = async (
  carts: Collection<ShoppingCartModel>,
  id: string
): Promise<ShoppingCart> => {
  const model = await getById(carts, id);

  return new ShoppingCart(
    model._id.toHexString(),
    model.customerId,
    model.status,
    model.productItems,
    model.openedAt,
    model.confirmedAt,
    model.revision
  );
};

export const store = async (
  carts: Collection<ShoppingCartModel>,
  event: ShoppingCartEvent,
  cart?: ShoppingCart
): Promise<void> => {
  switch (event.type) {
    case 'shopping-cart-opened': {
      await carts.updateOne(
        { _id: new ObjectId(event.data.shoppingCartId) },
        {
          $set: {
            customerId: event.data.customerId,
            status: ShoppingCartStatus.Opened,
            productItems: [],
            openedAt: event.data.openedAt,
            confirmedAt: undefined,
            revision: 1,
          },
        },
        { upsert: true }
      );
      return;
    }
    case 'product-item-added-to-shopping-cart': {
      if (cart === undefined) {
        throw Error('Cannot update not existing cart!');
      }

      await carts.updateOne(
        { _id: new ObjectId(cart.id) },
        {
          $set: {
            productItems: addProductItem(
              cart.productItems,
              event.data.productItem
            ),
          },
          $inc: {
            revision: 1,
          },
        },
        { upsert: false }
      );
      return;
    }
    case 'product-item-removed-from-shopping-cart': {
      if (cart === undefined) {
        throw Error('Cannot update not existing cart!');
      }

      await carts.updateOne(
        { _id: new ObjectId(cart.id) },
        {
          $set: {
            productItems: removeProductItem(
              cart.productItems,
              event.data.productItem
            ),
          },
          $inc: {
            revision: 1,
          },
        },
        { upsert: false }
      );
      return;
    }
    case 'shopping-cart-confirmed': {
      if (cart === undefined) {
        throw Error('Cannot update not existing cart!');
      }

      await carts.updateOne(
        { _id: new ObjectId(cart.id) },
        {
          $set: {
            status: ShoppingCartStatus.Confirmed,
            confirmedAt: event.data.confirmedAt,
          },
          $inc: {
            revision: 1,
          },
        },
        { upsert: false }
      );
      return;
    }
  }
};

const addProductItem = (
  productItems: ProductItem[],
  newProductItem: ProductItem
): ProductItem[] => {
  const { productId, quantity } = newProductItem;

  const currentProductItem = findProductItem(productItems, productId);

  if (!currentProductItem) return [...productItems, newProductItem];

  const newQuantity = currentProductItem.quantity + quantity;
  const mergedProductItem = { ...currentProductItem, quantity: newQuantity };

  return productItems.map((pi) =>
    pi.productId === productId ? mergedProductItem : pi
  );
};

const removeProductItem = (
  productItems: ProductItem[],
  newProductItem: ProductItem
): ProductItem[] => {
  const { productId, quantity } = newProductItem;

  const currentProductItem = assertProductItemExists(
    productItems,
    newProductItem
  );

  const newQuantity = currentProductItem.quantity - quantity;

  if (newQuantity === 0)
    return productItems.filter((pi) => pi.productId !== productId);

  const mergedProductItem = { ...currentProductItem, quantity: newQuantity };

  return productItems.map((pi) =>
    pi.productId === productId ? mergedProductItem : pi
  );
};

const findProductItem = (
  productItems: ProductItem[],
  productId: string
): ProductItem | undefined => {
  return productItems.find((pi) => pi.productId === productId);
};

export const assertProductItemExists = (
  productItems: ProductItem[],
  { productId, quantity }: ProductItem
): ProductItem => {
  const current = findProductItem(productItems, productId);

  if (current === undefined || current.quantity < quantity) {
    throw new Error('Product Item not found');
  }

  return current;
};
