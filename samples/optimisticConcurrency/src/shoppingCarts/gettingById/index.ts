export * from './queryHandler';
export * from './route';

export type ProductItem = Readonly<{
  productId: string;
  quantity: number;
}>;

export type CurrentShoppingCartDetails = Readonly<{
  shoppingCartId: string;
  clientId: string;
  status: string;
  productItems: ProductItem[];
  openedAt: Date;
  confirmedAt?: Date;
  revision: string;
}>;

export const CURRENT_SHOPPING_CART_DETAILS = 'currentShoppingCartDetails';
