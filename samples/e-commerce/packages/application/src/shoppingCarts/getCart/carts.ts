import type { ReadEvent } from '@event-driven-io/emmett';
import { singleStreamReadModel } from '../../readModelProjection';
import type { PongoClient } from '@event-driven-io/pongo';
import { ProductItems, type PricedProductItem } from '../productItems';
import type { ShoppingCartEvent } from '../shoppingCart';

export const cartsCollection = 'carts';

export type Cart = {
  shoppingCartId: string;
  customerId: string;
  lines: PricedProductItem[];
  totalPrice: number;
  checkedOut: boolean;
  version: number;
};

type CartDocument = Omit<Cart, 'shoppingCartId'>;

export const cartsReadModel = singleStreamReadModel<
  CartDocument,
  ShoppingCartEvent
>({
  collectionName: cartsCollection,
  canHandle: [
    'shopping_carts.ProductItemAddedToShoppingCart',
    'shopping_carts.ProductItemRemovedFromShoppingCart',
    'shopping_carts.ProductItemPriceChanged',
    'shopping_carts.ShoppingCartCheckedOut',
  ],
  getDocumentId: (event) => event.data.shoppingCartId,
  evolve: (
    current: CartDocument | null,
    event: ReadEvent<ShoppingCartEvent>,
  ): CartDocument => {
    const version = Number(event.metadata.streamPosition);
    const withLines = (
      lines: PricedProductItem[],
      rest: Partial<CartDocument> = {},
    ) => ({
      customerId: current?.customerId ?? '',
      checkedOut: current?.checkedOut ?? false,
      ...rest,
      lines,
      totalPrice: ProductItems.totalPrice(lines),
      version,
    });

    switch (event.type) {
      case 'shopping_carts.ProductItemAddedToShoppingCart':
        return withLines(
          ProductItems.add(current?.lines ?? [], event.data.productItem),
          { customerId: event.data.customerId },
        );
      case 'shopping_carts.ProductItemRemovedFromShoppingCart':
        return withLines(
          ProductItems.remove(current?.lines ?? [], event.data.productItem),
        );
      case 'shopping_carts.ProductItemPriceChanged':
        return withLines(
          ProductItems.changeUnitPrice(
            current?.lines ?? [],
            event.data.productId,
            event.data.newUnitPrice,
          ),
        );
      case 'shopping_carts.ShoppingCartCheckedOut':
        return withLines(current?.lines ?? [], { checkedOut: true });
    }
  },
});

export const carts = (pongo: PongoClient) => {
  const collection = pongo.db().collection<CartDocument>(cartsCollection);

  return {
    get: async (shoppingCartId: string): Promise<Cart | null> => {
      const found = await collection.findOne({ _id: shoppingCartId });

      if (!found) return null;

      const { _id, _version: _ignored, ...cart } = found;
      return { shoppingCartId: _id, ...cart };
    },
  };
};

export type Carts = ReturnType<typeof carts>;
