import { getById } from '#core/mongo';
import { Collection, ObjectId } from 'mongodb';
import { ProductItem, ShoppingCart, ShoppingCartStatus } from '../shoppingCart';
import { ShoppingCartEvent } from '../shoppingCart';

export type ShoppingCartModel = {
  _id: ObjectId;
  customerId: string;
  status: string;
  productItems: ProductItem[];
  openedAt: Date;
  confirmedAt: Date | undefined;
  revision: number;
};

export const getShoppingCart = async (
  carts: Collection<ShoppingCartModel>,
  id: string,
): Promise<ShoppingCart> => {
  const model = await getById(carts, id);

  return {
    id: model._id.toHexString(),
    status: model.status,
    productItems: new Map(
      model.productItems.map((p) => [p.productId, p.quantity]),
    ),
    revision: model.revision,
  };
};

export const store = async (
  carts: Collection<ShoppingCartModel>,
  event: ShoppingCartEvent,
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
        { upsert: true },
      );
      return;
    }
    case 'product-item-added-to-shopping-cart': {
      await carts.updateOne(
        {
          _id: new ObjectId(event.data.shoppingCartId),
          'productItems.productId': { $ne: event.data.productItem.productId },
        },
        {
          $addToSet: {
            productItems: {
              productId: event.data.productItem.productId,
              quantity: 0,
            },
          },
        },
      );

      await carts.updateOne(
        {
          _id: new ObjectId(event.data.shoppingCartId),
        },
        {
          $inc: {
            'productItems.$[orderItem].quantity':
              event.data.productItem.quantity,
            revision: 1,
          },
        },
        {
          arrayFilters: [
            {
              'orderItem.productId': event.data.productItem.productId,
            },
          ],
          upsert: true,
        },
      );
      return;
    }
    case 'product-item-removed-from-shopping-cart': {
      await carts.updateOne(
        {
          _id: new ObjectId(event.data.shoppingCartId),
          'productItems.productId': event.data.productItem.productId,
        },
        {
          $inc: {
            'productItems.$.quantity': -event.data.productItem.quantity,
            revision: 1,
          },
        },
        { upsert: false },
      );
      return;
    }
    case 'shopping-cart-confirmed': {
      await carts.updateOne(
        { _id: new ObjectId(event.data.shoppingCartId) },
        {
          $set: {
            status: ShoppingCartStatus.Confirmed,
            confirmedAt: event.data.confirmedAt,
          },
          $inc: {
            revision: 1,
          },
        },
        { upsert: false },
      );
      return;
    }
  }
};
