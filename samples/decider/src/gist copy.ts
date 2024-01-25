export interface ProductItem {
  productId: string;
  quantity: number;
}

export type PricedProductItem = ProductItem & {
  price: number;
};

export type ShoppingCartEvent =
  | {
      type: 'ShoppingCartOpened';
      data: {
        shoppingCartId: string;
        clientId: string;
        openedAt: string;
      };
    }
  | {
      type: 'ProductItemAddedToShoppingCart';
      data: {
        shoppingCartId: string;
        productItem: PricedProductItem;
      };
    }
  | {
      type: 'ProductItemRemovedFromShoppingCart';
      data: {
        shoppingCartId: string;
        productItem: PricedProductItem;
      };
    }
  | {
      type: 'ShoppingCartConfirmed';
      data: {
        shoppingCartId: string;
        confirmedAt: string;
      };
    }
  | {
      type: 'ShoppingCartCanceled';
      data: {
        shoppingCartId: string;
        canceledAt: string;
      };
    };

export type Event =
  | {
      type: 'Opened';
      data: {
        clientId: string;
      };
    }
  | {
      type: 'ProductItemAdded';
      data: {
        productItem: PricedProductItem;
      };
    }
  | {
      type: 'ProductItemRemoved';
      data: {
        productItem: PricedProductItem;
      };
    }
  | {
      type: 'Confirmed';
      data: never;
    }
  | {
      type: 'Cancelled';
      data: never;
    };
