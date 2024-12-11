import { DeciderSpecification } from '@event-driven-io/emmett';
import { v4 as uuid } from 'uuid';
import { ShoppingCartCommand, ShoppingCartErrors } from './businessLogic';
import {
  PricedProductItem,
  ShoppingCart,
  ShoppingCartEvent,
} from './shoppingCart';

const decide = (
  { type, data }: ShoppingCartCommand,
  state: ShoppingCart,
): ShoppingCartEvent[] => {
  switch (type) {
    case 'OpenShoppingCart':
      return ShoppingCart.open(
        data.shoppingCartId,
        data.clientId,
        data.now,
      ).dequeueUncommitedEvents();
    case 'AddProductItemToShoppingCart':
      state.addProductItem(data.productItem);
      break;
    case 'RemoveProductItemFromShoppingCart':
      state.removeProductItem(data.productItem);
      break;
    case 'ConfirmShoppingCart':
      state.confirm(data.now);
      break;
    case 'CancelShoppingCart':
      state.cancel(data.now);
      break;
  }
  return state.dequeueUncommitedEvents();
};

const given = DeciderSpecification.for({
  decide,
  evolve: (state, event) => {
    state.evolve(event);
    return state;
  },
  initialState: ShoppingCart.default,
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