import { v4 as uuid } from 'uuid';
import {
  ShoppingCartDetailsProjection,
  ShoppingCartShortInfoProjection,
} from './projections';
import { getDatabase } from './tools/database';
import { getEventStore } from './tools/eventStore';

export interface ProductItem {
  productId: string;
  quantity: number;
}

export type PricedProductItem = ProductItem & {
  unitPrice: number;
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

export enum ShoppingCartStatus {
  Pending = 'Pending',
  Confirmed = 'Confirmed',
  Canceled = 'Canceled',
}

export type ShoppingCartDetails = {
  id: string;
  clientId: string;
  status: ShoppingCartStatus;
  productItems: PricedProductItem[];
  openedAt: string;
  confirmedAt?: string;
  canceledAt?: string;
  totalAmount: number;
  totalItemsCount: number;
};

export type ShoppingCartShortInfo = {
  id: string;
  clientId: string;
  totalAmount: number;
  totalItemsCount: number;
};

describe('Getting state from events', () => {
  it('Should return the state from the sequence of events', () => {
    const openedAt = new Date().toISOString();
    const confirmedAt = new Date().toISOString();
    const canceledAt = new Date().toISOString();

    const shoesId = uuid();

    const twoPairsOfShoes: PricedProductItem = {
      productId: shoesId,
      quantity: 2,
      unitPrice: 200,
    };
    const pairOfShoes: PricedProductItem = {
      productId: shoesId,
      quantity: 1,
      unitPrice: 200,
    };

    const tShirtId = uuid();
    const tShirt: PricedProductItem = {
      productId: tShirtId,
      quantity: 1,
      unitPrice: 50,
    };

    const dressId = uuid();
    const dress: PricedProductItem = {
      productId: dressId,
      quantity: 3,
      unitPrice: 150,
    };

    const trousersId = uuid();
    const trousers: PricedProductItem = {
      productId: trousersId,
      quantity: 1,
      unitPrice: 300,
    };

    const shoppingCartId = uuid();
    const cancelledShoppingCartId = uuid();
    const otherClientShoppingCartId = uuid();
    const otherConfirmedShoppingCartId = uuid();
    const otherPendingShoppingCartId = uuid();

    const clientId = uuid();
    const otherClientId = uuid();

    const eventStore = getEventStore();
    const database = getDatabase();

    const shoppingCarts =
      database.collection<ShoppingCartDetails>('shoppingCarts');
    const shoppingCartInfos =
      database.collection<ShoppingCartShortInfo>('shoppingCartInfos');

    const shoppingCartDetailsProjection =
      ShoppingCartDetailsProjection(shoppingCarts);

    eventStore.subscribe(shoppingCartDetailsProjection);

    const shoppingCartShortInfoProjection =
      ShoppingCartShortInfoProjection(shoppingCartInfos);

    eventStore.subscribe(shoppingCartShortInfoProjection);

    // first confirmed
    eventStore.appendToStream<ShoppingCartEvent>(
      shoppingCartId,
      {
        type: 'ShoppingCartOpened',
        data: {
          shoppingCartId,
          clientId,
          openedAt,
        },
      },
      {
        type: 'ProductItemAddedToShoppingCart',
        data: {
          shoppingCartId,
          productItem: twoPairsOfShoes,
        },
      },
      {
        type: 'ProductItemAddedToShoppingCart',
        data: {
          shoppingCartId,
          productItem: tShirt,
        },
      },
      {
        type: 'ProductItemRemovedFromShoppingCart',
        data: {
          shoppingCartId,
          productItem: pairOfShoes,
        },
      },
      {
        type: 'ShoppingCartConfirmed',
        data: {
          shoppingCartId,
          confirmedAt,
        },
      },
    );

    // cancelled
    eventStore.appendToStream<ShoppingCartEvent>(
      cancelledShoppingCartId,
      {
        type: 'ShoppingCartOpened',
        data: {
          shoppingCartId: cancelledShoppingCartId,
          clientId,
          openedAt,
        },
      },
      {
        type: 'ProductItemAddedToShoppingCart',
        data: {
          shoppingCartId: cancelledShoppingCartId,
          productItem: dress,
        },
      },
      {
        type: 'ShoppingCartCanceled',
        data: {
          shoppingCartId: cancelledShoppingCartId,
          canceledAt,
        },
      },
    );

    // confirmed but other client
    eventStore.appendToStream<ShoppingCartEvent>(
      otherClientShoppingCartId,
      {
        type: 'ShoppingCartOpened',
        data: {
          shoppingCartId: otherClientShoppingCartId,
          clientId: otherClientId,
          openedAt,
        },
      },
      {
        type: 'ProductItemAddedToShoppingCart',
        data: {
          shoppingCartId: otherClientShoppingCartId,
          productItem: dress,
        },
      },
      {
        type: 'ShoppingCartConfirmed',
        data: {
          shoppingCartId: otherClientShoppingCartId,
          confirmedAt,
        },
      },
    );

    // second confirmed
    eventStore.appendToStream<ShoppingCartEvent>(
      otherConfirmedShoppingCartId,
      {
        type: 'ShoppingCartOpened',
        data: {
          shoppingCartId: otherConfirmedShoppingCartId,
          clientId,
          openedAt,
        },
      },
      {
        type: 'ProductItemAddedToShoppingCart',
        data: {
          shoppingCartId: otherConfirmedShoppingCartId,
          productItem: trousers,
        },
      },
      {
        type: 'ShoppingCartConfirmed',
        data: {
          shoppingCartId: otherConfirmedShoppingCartId,
          confirmedAt,
        },
      },
    );

    // first pending
    eventStore.appendToStream<ShoppingCartEvent>(otherPendingShoppingCartId, {
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId: otherPendingShoppingCartId,
        clientId,
        openedAt,
      },
    });

    // first confirmed
    let shoppingCart = shoppingCarts.get(shoppingCartId);
    expect(shoppingCart).toEqual({
      id: shoppingCartId,
      clientId,
      status: ShoppingCartStatus.Confirmed,
      productItems: [pairOfShoes, tShirt],
      openedAt,
      confirmedAt,
      totalAmount:
        pairOfShoes.unitPrice * pairOfShoes.quantity +
        tShirt.unitPrice * tShirt.quantity,
      totalItemsCount: pairOfShoes.quantity + tShirt.quantity,
    });

    let shoppingCartShortInfo = shoppingCartInfos.get(shoppingCartId);
    expect(shoppingCartShortInfo).toBeNull();

    // cancelled
    shoppingCart = shoppingCarts.get(cancelledShoppingCartId);
    expect(shoppingCart).toEqual({
      id: cancelledShoppingCartId,
      clientId,
      status: ShoppingCartStatus.Canceled,
      productItems: [dress],
      openedAt,
      canceledAt,
      totalAmount: dress.unitPrice * dress.quantity,
      totalItemsCount: dress.quantity,
    });

    shoppingCartShortInfo = shoppingCartInfos.get(cancelledShoppingCartId);
    expect(shoppingCartShortInfo).toBeNull();

    // confirmed but other client
    shoppingCart = shoppingCarts.get(otherClientShoppingCartId);
    expect(shoppingCart).toEqual({
      id: otherClientShoppingCartId,
      clientId: otherClientId,
      status: ShoppingCartStatus.Confirmed,
      productItems: [dress],
      openedAt,
      confirmedAt,
      totalAmount: dress.unitPrice * dress.quantity,
      totalItemsCount: dress.quantity,
    });

    shoppingCartShortInfo = shoppingCartInfos.get(otherClientShoppingCartId);
    expect(shoppingCartShortInfo).toBeNull();

    // second confirmed
    shoppingCart = shoppingCarts.get(otherConfirmedShoppingCartId);
    expect(shoppingCart).toEqual({
      id: otherConfirmedShoppingCartId,
      clientId,
      status: ShoppingCartStatus.Confirmed,
      productItems: [trousers],
      openedAt,
      confirmedAt,
      totalAmount: trousers.unitPrice * trousers.quantity,
      totalItemsCount: trousers.quantity,
    });

    shoppingCartShortInfo = shoppingCartInfos.get(otherConfirmedShoppingCartId);
    expect(shoppingCartShortInfo).toBeNull();

    // first pending
    shoppingCart = shoppingCarts.get(otherPendingShoppingCartId);
    expect(shoppingCart).toEqual({
      id: otherPendingShoppingCartId,
      clientId,
      status: ShoppingCartStatus.Pending,
      productItems: [],
      openedAt,
      totalAmount: 0,
      totalItemsCount: 0,
    });

    shoppingCartShortInfo = shoppingCartInfos.get(otherPendingShoppingCartId);
    expect(shoppingCartShortInfo).toStrictEqual({
      id: otherPendingShoppingCartId,
      clientId,
      totalAmount: 0,
      totalItemsCount: 0,
    });
  });
});
