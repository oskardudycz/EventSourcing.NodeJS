import { CommandHandler, type EventStore } from '@event-driven-io/emmett';
import type { CustomerShoppingCarts } from './currentCart/customerShoppingCarts';
import type { ProductPriceCalculator } from './pricing/productPriceCalculator';
import type { ProductItem } from './productItems';
import {
  evolve,
  initialShoppingCart,
  isCheckedOut,
  ShoppingCartId,
  type ShoppingCart,
  type ShoppingCartEvent,
} from './shoppingCart';
import {
  addProductItem,
  checkOut,
  removeProductItem,
} from './shoppingCartDecider';

const handlerOptions = {
  evolve,
  initialState: initialShoppingCart,
  mapToStreamId: ShoppingCartId.streamNameOf,
};

const handleRetryingConflicts = CommandHandler<ShoppingCart, ShoppingCartEvent>(
  {
    ...handlerOptions,
    retry: { onVersionConflict: 2 },
  },
);

const handleAtVersion = CommandHandler<ShoppingCart, ShoppingCartEvent>(
  handlerOptions,
);

export const shoppingCartFacade = ({
  eventStore,
  customerShoppingCarts,
  prices,
  now,
}: {
  eventStore: EventStore;
  customerShoppingCarts: CustomerShoppingCarts;
  prices: ProductPriceCalculator;
  now: () => Date;
}) => ({
  addProductItem: async (customerId: string, productItem: ProductItem) => {
    const shoppingCartId =
      (await customerShoppingCarts.currentOf(customerId)) ??
      ShoppingCartId.of(
        customerId,
        (await customerShoppingCarts.countOf(customerId)) + 1,
      );

    const result = await handleRetryingConflicts(
      eventStore,
      shoppingCartId,
      (state) =>
        addProductItem(
          {
            type: 'shopping_carts.AddProductItemToShoppingCart',
            data: {
              shoppingCartId,
              customerId,
              productItem,
              currentUnitPrice: prices.calculate(productItem).unitPrice,
              now: now().toISOString(),
            },
          },
          state,
        ),
    );

    return result.nextExpectedStreamVersion;
  },

  removeProductItem: async (
    shoppingCartId: string,
    productItem: ProductItem,
    expectedVersion: bigint,
  ) => {
    const result = await handleAtVersion(
      eventStore,
      shoppingCartId,
      (state) =>
        removeProductItem(
          {
            type: 'shopping_carts.RemoveProductItemFromShoppingCart',
            data: { shoppingCartId, productItem, now: now().toISOString() },
          },
          state,
        ),
      { expectedStreamVersion: expectedVersion },
    );

    return result.nextExpectedStreamVersion;
  },

  checkOut: async (shoppingCartId: string, expectedVersion: bigint) => {
    const checkedOutAt = now().toISOString();

    const result = await handleAtVersion(
      eventStore,
      shoppingCartId,
      (state) =>
        checkOut(
          {
            type: 'shopping_carts.CheckOutShoppingCart',
            data: {
              shoppingCartId,
              currentUnitPrices: Object.fromEntries(
                state.productItems.map((item) => [
                  item.productId,
                  prices.calculate(item).unitPrice,
                ]),
              ),
              now: checkedOutAt,
            },
          },
          state,
        ),
      { expectedStreamVersion: expectedVersion },
    );

    return {
      version: result.nextExpectedStreamVersion,
      isCheckedOut: isCheckedOut(result.newState),
    };
  },
});

export type ShoppingCartFacade = ReturnType<typeof shoppingCartFacade>;
