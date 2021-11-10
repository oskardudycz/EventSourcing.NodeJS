export * from './queryHandler';
export * from './route';

export type ProductItem = Readonly<{
  productId: string;
  quantity: number;
}>;

export type ShoppingCartDetails = Readonly<{
  shoppingCartId: string;
  clientId: string;
  status: string;
  productItems: ProductItem[];
  openedAt: Date;
  confirmedAt?: Date;
  revision: number;
}>;

export const SHOPPING_CART_DETAILS = 'shoppingCartDetails';
