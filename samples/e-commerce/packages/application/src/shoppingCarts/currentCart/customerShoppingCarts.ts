import type { ReadEvent } from '@event-driven-io/emmett';
import {
  pongoSingleStreamProjection,
  type SQLiteProjectionWithSchema,
} from '@event-driven-io/emmett-sqlite';
import type { PongoClient } from '@event-driven-io/pongo';
import type { ShoppingCartEvent, ShoppingCartStatus } from '../shoppingCart';

export const customerShoppingCartsCollection = 'customer_shopping_carts';

type CustomerShoppingCart = {
  customerId: string;
  status: ShoppingCartStatus;
};

export const customerShoppingCartsProjection: SQLiteProjectionWithSchema<ShoppingCartEvent> =
  pongoSingleStreamProjection<CustomerShoppingCart, ShoppingCartEvent>({
    collectionName: customerShoppingCartsCollection,
    canHandle: [
      'shopping_carts.ProductItemAddedToShoppingCart',
      'shopping_carts.ShoppingCartCheckedOut',
    ],
    getDocumentId: (event) => event.data.shoppingCartId,
    evolve: (
      current: CustomerShoppingCart | null,
      event: ReadEvent<ShoppingCartEvent>,
    ): CustomerShoppingCart | null => {
      switch (event.type) {
        case 'shopping_carts.ProductItemAddedToShoppingCart':
          return (
            current ?? { customerId: event.data.customerId, status: 'Pending' }
          );
        case 'shopping_carts.ShoppingCartCheckedOut':
          return current ? { ...current, status: 'CheckedOut' } : null;
        default:
          return current;
      }
    },
  });

export const customerShoppingCarts = (pongo: PongoClient) => {
  const collection = pongo
    .db()
    .collection<CustomerShoppingCart>(customerShoppingCartsCollection);

  return {
    currentOf: async (customerId: string): Promise<string | null> => {
      const found = await collection.findOne({ customerId, status: 'Pending' });
      return found?._id ?? null;
    },
    countOf: (customerId: string): Promise<number> =>
      collection.countDocuments({ customerId }),
  };
};

export type CustomerShoppingCarts = ReturnType<typeof customerShoppingCarts>;
