import { Cart, CartItem } from '../db/__generated__';

export type CartDetails = Cart & {
  items: CartItem[];
};

export const enum ShoppingCartStatus {
  Opened = 1,
  Confirmed = 2,
  Cancelled = 4,
  Closed = Confirmed | Cancelled,
}
