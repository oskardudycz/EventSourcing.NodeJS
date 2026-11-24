import type { ReadEvent } from '@event-driven-io/emmett';
import { singleStreamReadModel } from '../../readModelProjection';
import type { PongoClient } from '@event-driven-io/pongo';
import { ProductItems, type PricedProductItem } from '../productItems';
import type { ShoppingCartEvent } from '../shoppingCart';

export const shoppingCartSummariesCollection = 'shopping_cart_summaries';

export type ShoppingCartSummary = {
  customerId: string;
  productItems: PricedProductItem[];
  totalPrice: number;
};

const summaryOf = (
  current: ShoppingCartSummary | null,
  productItems: PricedProductItem[],
  customerId = current?.customerId ?? '',
): ShoppingCartSummary => ({
  customerId,
  productItems,
  totalPrice: ProductItems.totalPrice(productItems),
});

export const evolveSummary = (
  current: ShoppingCartSummary | null,
  event: ReadEvent<ShoppingCartEvent>,
): ShoppingCartSummary | null => {
  const items = current?.productItems ?? [];

  switch (event.type) {
    case 'shopping_carts.ProductItemAddedToShoppingCart':
      return summaryOf(
        current,
        ProductItems.add(items, event.data.productItem),
        event.data.customerId,
      );
    case 'shopping_carts.ProductItemRemovedFromShoppingCart':
      return summaryOf(
        current,
        ProductItems.remove(items, event.data.productItem),
      );
    case 'shopping_carts.ProductItemPriceChanged':
      return summaryOf(
        current,
        ProductItems.changeUnitPrice(
          items,
          event.data.productId,
          event.data.newUnitPrice,
        ),
      );
    case 'shopping_carts.ShoppingCartCheckedOut':
      return current;
  }
};

export const shoppingCartSummariesReadModel = singleStreamReadModel<
  ShoppingCartSummary,
  ShoppingCartEvent
>({
  collectionName: shoppingCartSummariesCollection,
  canHandle: [
    'shopping_carts.ProductItemAddedToShoppingCart',
    'shopping_carts.ProductItemRemovedFromShoppingCart',
    'shopping_carts.ProductItemPriceChanged',
  ],
  getDocumentId: (event) => event.data.shoppingCartId,
  evolve: evolveSummary,
});

export const shoppingCartSummaries = (pongo: PongoClient) => {
  const collection = pongo
    .db()
    .collection<ShoppingCartSummary>(shoppingCartSummariesCollection);

  return {
    get: (shoppingCartId: string) =>
      collection.findOne({ _id: shoppingCartId }),
  };
};

export type ShoppingCartSummaries = ReturnType<typeof shoppingCartSummaries>;
