import { getById } from '#core/repositories';
import { Collection, ObjectId } from 'mongodb';
import { ShoppingCartModel } from 'src/unpeeled/ecommerce/shoppingCarts/models/shoppingCart';
import { ShoppingCart, ShoppingCartStatus } from '..';
import { CustomerShoppingHistoryItem } from '../application/queries/customerShoppingHistoryItem';
import { ShoppingCartEvent } from '../events';

export const getShoppingCart = async (
  carts: Collection<ShoppingCartModel>,
  id: string
): Promise<ShoppingCart> => {
  const model = await getById(carts, id);

  return new ShoppingCart(
    model._id.toHexString(),
    model.status,
    new Map(model.productItems.map((p) => [p.productId, p.quantity])),
    model.revision
  );
};

export const findAllByCustomerId = async (
  carts: Collection<ShoppingCartModel>,
  customerId: string
): Promise<CustomerShoppingHistoryItem[]> => {
  const result = await carts.find({ customerId }).toArray();

  return result.map(
    (cart) =>
      new CustomerShoppingHistoryItem(
        cart.customerId,
        cart._id.toHexString(),
        cart.status,
        cart.productItems.length
      )
  );
};

export const store = async (
  carts: Collection<ShoppingCartModel>,
  event: ShoppingCartEvent
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
        }
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
        }
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
        { upsert: false }
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
        { upsert: false }
      );
      return;
    }
  }
};
