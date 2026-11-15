import {
  DeciderSpecification,
  IllegalStateError,
} from '@event-driven-io/emmett';
import { v4 as uuid } from 'uuid';
import { describe, it } from 'vitest';
import type { PricedProductItem } from './productItem';
import type {
  ShoppingCartConfirmed,
  ShoppingCartOpened,
  ProductItemAddedToShoppingCart,
} from './shoppingCart';
import { decider, ShoppingCartErrors } from './shoppingCart';
import type { User } from './user';

describe('Shopping cart', () => {
  it('opens shopping cart', () =>
    given([])
      .when({ type: 'OpenShoppingCart', data: { shoppingCartId }, metadata })
      .then([opened]));

  it('adds product item to opened shopping cart', () =>
    given([opened])
      .when({
        type: 'AddProductItemToShoppingCart',
        data: { shoppingCartId, productItem: shoes },
        metadata,
      })
      .then([shoesAdded]));

  it('does not add product item to confirmed shopping cart', () =>
    given([opened, shoesAdded, confirmed])
      .when({
        type: 'AddProductItemToShoppingCart',
        data: { shoppingCartId, productItem: shoes },
        metadata,
      })
      .thenThrows(
        IllegalStateError,
        withMessage(ShoppingCartErrors.CART_IS_NOT_OPENED),
      ));

  it('removes part of added product item', () =>
    given([opened, shoesAdded])
      .when({
        type: 'RemoveProductItemFromShoppingCart',
        data: { shoppingCartId, productItem: { productId: 123, quantity: 1 } },
        metadata,
      })
      .then([
        {
          type: 'product-item-removed-from-shopping-cart',
          data: {
            shoppingCartId,
            productItem: { ...shoes, quantity: 1 },
            removedAt: now.toJSON(),
          },
        },
      ]));

  it('does not remove more than was added', () =>
    given([opened, shoesAdded])
      .when({
        type: 'RemoveProductItemFromShoppingCart',
        data: { shoppingCartId, productItem: { productId: 123, quantity: 3 } },
        metadata,
      })
      .thenThrows(
        IllegalStateError,
        withMessage(ShoppingCartErrors.PRODUCT_ITEM_NOT_FOUND),
      ));

  it('confirms shopping cart with product items', () =>
    given([opened, shoesAdded])
      .when({
        type: 'ConfirmShoppingCart',
        data: { shoppingCartId, user, additionalInfo: {} },
        metadata,
      })
      .then([confirmed]));

  it('does not confirm empty shopping cart', () =>
    given([opened])
      .when({
        type: 'ConfirmShoppingCart',
        data: { shoppingCartId, user, additionalInfo: {} },
        metadata,
      })
      .thenThrows(
        IllegalStateError,
        withMessage(ShoppingCartErrors.NO_PRODUCTS_ITEMS),
      ));

  const shoppingCartId = uuid();
  const now = new Date();
  const metadata = { now };

  const shoes: PricedProductItem = {
    productId: 123,
    quantity: 2,
    sku: 'SKU',
    price: 100,
    discount: 0,
  };

  const user: User = {
    id: 1694,
    firstName: 'Oskar',
    lastName: 'Grouch',
    email: 'oskar@someemail.pl',
    address: { city: 'Legnica', province: 'Sesame street', country: 'Poland' },
  };

  const opened: ShoppingCartOpened = {
    type: 'shopping-cart-opened',
    data: { shoppingCartId, openedAt: now.toJSON() },
  };

  const shoesAdded: ProductItemAddedToShoppingCart = {
    type: 'product-item-added-to-shopping-cart',
    data: { shoppingCartId, productItem: shoes, addedAt: now.toJSON() },
  };

  const confirmed: ShoppingCartConfirmed = {
    type: 'shopping-cart-confirmed',
    data: {
      shoppingCartId,
      user,
      additionalInfo: {},
      confirmedAt: now.toJSON(),
    },
  };
});

const given = DeciderSpecification.for(decider);

const withMessage = (expected: string) => (error: Error) =>
  error.message === expected;
