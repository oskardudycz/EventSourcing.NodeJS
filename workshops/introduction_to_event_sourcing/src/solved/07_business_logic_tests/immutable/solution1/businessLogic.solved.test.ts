import { DeciderSpecification } from '@event-driven-io/emmett';
import { v4 as uuid } from 'uuid';
import {
  ShoppingCartCommand,
  ShoppingCartErrors,
  addProductItemToShoppingCart,
  cancelShoppingCart,
  confirmShoppingCart,
  openShoppingCart,
  removeProductItemFromShoppingCart,
} from './businessLogic';
import {
  PricedProductItem,
  ShoppingCart,
  ShoppingCartEvent,
  evolve,
} from './shoppingCart';

export const decide = (
  command: ShoppingCartCommand,
  state: ShoppingCart,
): ShoppingCartEvent => {
  switch (command.type) {
    case 'OpenShoppingCart':
      return openShoppingCart(command);
    case 'AddProductItemToShoppingCart':
      return addProductItemToShoppingCart(command, state);
    case 'RemoveProductItemFromShoppingCart':
      return removeProductItemFromShoppingCart(command, state);
    case 'ConfirmShoppingCart':
      return confirmShoppingCart(command, state);
    case 'CancelShoppingCart':
      return cancelShoppingCart(command, state);
  }
};

const given = DeciderSpecification.for({
  decide,
  evolve,
  initialState: () => ({}) as ShoppingCart,
});

describe('Business logic', () => {
  const shoppingCartId = uuid();

  const clientId = uuid();
  const openedAt = new Date();
  const canceledAt = new Date();

  const shoesId = uuid();
  const pairOfShoes: PricedProductItem = {
    productId: shoesId,
    quantity: 1,
    unitPrice: 100,
  };

  it('GIVEN not existing shopping cart WHEN opening THEN succeeds', () => {
    given([])
      .when({
        type: 'OpenShoppingCart',
        data: { shoppingCartId, clientId, now: openedAt },
      })
      .then({
        type: 'ShoppingCartOpened',
        data: { clientId, openedAt, shoppingCartId },
      });
  });

  it('GIVEN canceled shopping cart WHEN adding product item THEN fails', () => {
    given([
      {
        type: 'ShoppingCartOpened',
        data: { clientId, openedAt, shoppingCartId },
      },
      {
        type: 'ShoppingCartCanceled',
        data: { canceledAt, shoppingCartId },
      },
    ])
      .when({
        type: 'AddProductItemToShoppingCart',
        data: { shoppingCartId, productItem: pairOfShoes },
      })
      .thenThrows(
        (error) =>
          error.message ===
          ShoppingCartErrors.CART_IS_ALREADY_CLOSED.toString(),
      );
  });
});
