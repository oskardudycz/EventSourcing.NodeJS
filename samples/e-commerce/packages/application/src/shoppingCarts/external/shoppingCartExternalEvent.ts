import type { Event } from '@event-driven-io/emmett';
import type { PricedProductItem } from '../productItems';

export type ShoppingCartCheckedOutExternal = Event<
  'shopping_carts.external.ShoppingCartCheckedOut',
  {
    cartId: string;
    customerId: string;
    productItems: PricedProductItem[];
    totalPrice: number;
    checkedOutAt: string;
  }
>;

export const shoppingCartExternalEventTypes = [
  'shopping_carts.external.ShoppingCartCheckedOut',
] as const;
