import {
  DeciderSpecification,
  IllegalStateError,
} from '@event-driven-io/emmett';
import { describe, it } from 'vitest';
import { shoppingCartDecider } from './shoppingCartDecider';
import { ShoppingCartId, type ShoppingCartEvent } from './shoppingCart';

const customerId = 'c-1';
const shoppingCartId = ShoppingCartId.of(customerId, 1);
const now = '2026-01-01T10:00:00.000Z';
const given = DeciderSpecification.for(shoppingCartDecider);

const shoesAdded = (quantity: number, unitPrice = 50): ShoppingCartEvent => ({
  type: 'shopping_carts.ProductItemAddedToShoppingCart',
  data: {
    shoppingCartId,
    customerId,
    productItem: { productId: 'shoes', quantity, unitPrice },
    addedAt: now,
  },
});

const checkedOut: ShoppingCartEvent = {
  type: 'shopping_carts.ShoppingCartCheckedOut',
  data: { shoppingCartId, checkedOutAt: now },
};

describe('shopping cart decider', () => {
  it('addingTheFirstProductRecordsItAtTheCurrentPrice', () =>
    given([])
      .when({
        type: 'shopping_carts.AddProductItemToShoppingCart',
        data: {
          shoppingCartId,
          customerId,
          productItem: { productId: 'shoes', quantity: 2 },
          currentUnitPrice: 50,
          now,
        },
      })
      .then([shoesAdded(2)]));

  it('addingTheSameProductAgainKeepsTheFirstPrice', () =>
    given([shoesAdded(2, 50)])
      .when({
        type: 'shopping_carts.AddProductItemToShoppingCart',
        data: {
          shoppingCartId,
          customerId,
          productItem: { productId: 'shoes', quantity: 1 },
          currentUnitPrice: 80,
          now,
        },
      })
      .then([shoesAdded(1, 50)]));

  it('cartDeciderThrowsIllegalStateErrorOnARemovedProduct', () =>
    given([shoesAdded(2), checkedOut])
      .when({
        type: 'shopping_carts.RemoveProductItemFromShoppingCart',
        data: {
          shoppingCartId,
          productItem: { productId: 'shoes', quantity: 1 },
          now,
        },
      })
      .thenThrows((error) => error instanceof IllegalStateError));

  it('removingAProductThatIsNotInTheCartThrowsIllegalStateError', () =>
    given([shoesAdded(2)])
      .when({
        type: 'shopping_carts.RemoveProductItemFromShoppingCart',
        data: {
          shoppingCartId,
          productItem: { productId: 'hat', quantity: 1 },
          now,
        },
      })
      .thenThrows((error) => error instanceof IllegalStateError));

  it('checkingOutWithAChangedPriceRecordsThePriceChangeInsteadOfTheCheckout', () =>
    given([shoesAdded(2, 50)])
      .when({
        type: 'shopping_carts.CheckOutShoppingCart',
        data: { shoppingCartId, currentUnitPrices: { shoes: 60 }, now },
      })
      .then([
        {
          type: 'shopping_carts.ProductItemPriceChanged',
          data: {
            shoppingCartId,
            productId: 'shoes',
            oldUnitPrice: 50,
            newUnitPrice: 60,
            changedAt: now,
          },
        },
      ]));

  it('checkingOutWithCurrentPricesRecordsTheCheckout', () =>
    given([shoesAdded(2, 50)])
      .when({
        type: 'shopping_carts.CheckOutShoppingCart',
        data: { shoppingCartId, currentUnitPrices: { shoes: 50 }, now },
      })
      .then([checkedOut]));

  it('checkingOutACheckedOutCartRecordsNothing', () =>
    given([shoesAdded(2), checkedOut])
      .when({
        type: 'shopping_carts.CheckOutShoppingCart',
        data: { shoppingCartId, currentUnitPrices: { shoes: 50 }, now },
      })
      .then([]));

  it('checkingOutAnEmptyCartThrowsIllegalStateError', () =>
    given([])
      .when({
        type: 'shopping_carts.CheckOutShoppingCart',
        data: { shoppingCartId, currentUnitPrices: {}, now },
      })
      .thenThrows((error) => error instanceof IllegalStateError));
});
