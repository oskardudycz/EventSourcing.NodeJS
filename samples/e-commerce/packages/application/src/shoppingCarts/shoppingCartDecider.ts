import { IllegalStateError, type Decider } from '@event-driven-io/emmett';
import { ProductItems } from './productItems';
import {
  evolve,
  initialShoppingCart,
  isCheckedOut,
  isClosed,
  type AddProductItemToShoppingCart,
  type CheckOutShoppingCart,
  type RemoveProductItemFromShoppingCart,
  type ShoppingCart,
  type ShoppingCartCommand,
  type ShoppingCartEvent,
} from './shoppingCart';

export const addProductItem = (
  command: AddProductItemToShoppingCart,
  state: ShoppingCart,
): ShoppingCartEvent[] => {
  if (state.status !== undefined && isClosed(state))
    throw new IllegalStateError(
      `Adding product item for cart in '${state.status}' status is not allowed.`,
    );

  const { productItem, shoppingCartId, customerId, currentUnitPrice, now } =
    command.data;
  const unitPrice =
    ProductItems.find(state.productItems, productItem.productId)?.unitPrice ??
    currentUnitPrice;

  return [
    {
      type: 'shopping_carts.ProductItemAddedToShoppingCart',
      data: {
        shoppingCartId,
        customerId,
        productItem: { ...productItem, unitPrice },
        addedAt: now,
      },
    },
  ];
};

export const removeProductItem = (
  command: RemoveProductItemFromShoppingCart,
  state: ShoppingCart,
): ShoppingCartEvent[] => {
  if (isClosed(state))
    throw new IllegalStateError(
      `Removing product item for cart in '${state.status}' status is not allowed.`,
    );

  const { productItem, now } = command.data;
  const current = ProductItems.find(state.productItems, productItem.productId);

  if (!current) throw new IllegalStateError("Product item wasn't found");

  const priced = { ...productItem, unitPrice: current.unitPrice };
  ProductItems.assertThatCanRemove(state.productItems, priced);

  return [
    {
      type: 'shopping_carts.ProductItemRemovedFromShoppingCart',
      data: {
        shoppingCartId: command.data.shoppingCartId,
        productItem: priced,
        removedAt: now,
      },
    },
  ];
};

export const checkOut = (
  command: CheckOutShoppingCart,
  state: ShoppingCart,
): ShoppingCartEvent[] => {
  if (isCheckedOut(state)) return [];

  if (isClosed(state))
    throw new IllegalStateError(
      `Checking out cart in '${state.status}' status is not allowed.`,
    );

  if (state.productItems.length === 0)
    throw new IllegalStateError('Checking out an empty cart is not allowed.');

  const { currentUnitPrices, now } = command.data;
  const priceChanges = state.productItems.flatMap(
    (item): ShoppingCartEvent[] => {
      const newUnitPrice = currentUnitPrices[item.productId];

      if (newUnitPrice === undefined || newUnitPrice === item.unitPrice)
        return [];

      return [
        {
          type: 'shopping_carts.ProductItemPriceChanged',
          data: {
            shoppingCartId: command.data.shoppingCartId,
            productId: item.productId,
            oldUnitPrice: item.unitPrice,
            newUnitPrice,
            changedAt: now,
          },
        },
      ];
    },
  );

  if (priceChanges.length > 0) return priceChanges;

  return [
    {
      type: 'shopping_carts.ShoppingCartCheckedOut',
      data: { shoppingCartId: command.data.shoppingCartId, checkedOutAt: now },
    },
  ];
};

export const decide = (
  command: ShoppingCartCommand,
  state: ShoppingCart,
): ShoppingCartEvent[] => {
  switch (command.type) {
    case 'shopping_carts.AddProductItemToShoppingCart':
      return addProductItem(command, state);
    case 'shopping_carts.RemoveProductItemFromShoppingCart':
      return removeProductItem(command, state);
    case 'shopping_carts.CheckOutShoppingCart':
      return checkOut(command, state);
  }
};

export const shoppingCartDecider: Decider<
  ShoppingCart,
  ShoppingCartCommand,
  ShoppingCartEvent
> = { decide, evolve, initialState: initialShoppingCart };
