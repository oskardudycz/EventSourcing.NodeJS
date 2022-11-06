import { MongoDbRepository } from '#core/repositories';
import { MongoClient, ObjectId } from 'mongodb';
import { ProductItem } from 'src/onion/ecommerce/common/shoppingCarts/productItem';
import { ShoppingCartModel } from 'src/unpeeled/ecommerce/shoppingCarts/models/shoppingCart';
import { ShoppingCartStatus } from '..';
import { ShoppingCartEvent } from '../events';

export class ShoppingCartRepository extends MongoDbRepository<ShoppingCartModel> {
  constructor(mongo: MongoClient) {
    super(mongo, 'shoppingCarts');
  }

  async findAllByCustomerId(customerId: string): Promise<ShoppingCartModel[]> {
    return this.collection.find({ customerId }).toArray();
  }

  public async store(entity: ShoppingCartModel, event: ShoppingCartEvent) {
    return await this.upsert(apply(entity, event));
  }
}

const apply = (cart: ShoppingCartModel, event: ShoppingCartEvent) => {
  switch (event.type) {
    case 'shopping-cart-opened':
      return new ShoppingCartModel(
        new ObjectId(event.data.shoppingCartId),
        event.data.customerId,
        ShoppingCartStatus.Opened,
        [],
        event.data.openedAt,
        undefined,
        1
      );
    case 'product-item-added-to-shopping-cart':
      return {
        ...cart,
        productItems: addProductItem(cart.productItems, event.data.productItem),
        revision: cart.revision + 1,
      };
    case 'product-item-removed-from-shopping-cart':
      return {
        ...cart,
        productItems: removeProductItem(
          cart.productItems,
          event.data.productItem
        ),
        revision: cart.revision + 1,
      };
    case 'shopping-cart-confirmed':
      return {
        ...cart,
        status: ShoppingCartStatus.Confirmed,
        confirmedAt: event.data.confirmedAt,
        revision: cart.revision + 1,
      };
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
