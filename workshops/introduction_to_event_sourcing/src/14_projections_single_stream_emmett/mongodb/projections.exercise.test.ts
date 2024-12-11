import {
  getMongoDBTestClient,
  releaseMongoDBContainer,
} from '#core/testing/mongoDB';
import { projections, type Event } from '@event-driven-io/emmett';
import {
  EventStream,
  MongoDBEventStore,
  MongoDBReadModel,
  getMongoDBEventStore,
  mongoDBInlineProjection,
  toStreamCollectionName,
  toStreamName,
} from '@event-driven-io/emmett-mongodb';
import { MongoClient } from 'mongodb';
import { v4 as uuid } from 'uuid';

export interface ProductItem {
  productId: string;
  quantity: number;
}

export type PricedProductItem = ProductItem & {
  unitPrice: number;
};

export type ShoppingCartOpened = Event<
  'ShoppingCartOpened',
  {
    shoppingCartId: string;
    clientId: string;
    openedAt: string;
  }
>;

export type ProductItemAddedToShoppingCart = Event<
  'ProductItemAddedToShoppingCart',
  {
    shoppingCartId: string;
    productItem: PricedProductItem;
  }
>;

export type ProductItemRemovedFromShoppingCart = Event<
  'ProductItemRemovedFromShoppingCart',
  {
    shoppingCartId: string;
    productItem: PricedProductItem;
  }
>;

export type ShoppingCartConfirmed = Event<
  'ShoppingCartConfirmed',
  {
    shoppingCartId: string;
    confirmedAt: string;
  }
>;

export type ShoppingCartCanceled = Event<
  'ShoppingCartCanceled',
  {
    shoppingCartId: string;
    canceledAt: string;
  }
>;

export type ShoppingCartEvent =
  | ShoppingCartOpened
  | ProductItemAddedToShoppingCart
  | ProductItemRemovedFromShoppingCart
  | ShoppingCartConfirmed
  | ShoppingCartCanceled;

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
  let eventStore: MongoDBEventStore;
  let mongo: MongoClient;

  beforeAll(async () => {
    mongo = await getMongoDBTestClient();

    eventStore = getMongoDBEventStore({
      client: mongo,
      projections: projections.inline([detailsProjection, shortInfoProjection]),
    });
  });

  afterAll(async () => {
    await eventStore.close();
    await releaseMongoDBContainer();
  });

  it('Should return the state from the sequence of events', async () => {
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

    const streamType = 'shopping_cart';

    const shoppingCartId = toStreamName(streamType, uuid());
    const cancelledShoppingCartId = toStreamName(streamType, uuid());
    const otherClientShoppingCartId = toStreamName(streamType, uuid());
    const otherConfirmedShoppingCartId = toStreamName(streamType, uuid());
    const otherPendingShoppingCartId = toStreamName(streamType, uuid());

    const clientId = uuid();
    const otherClientId = uuid();

    const database = mongo.db();

    const shoppingCartStreams = database.collection<
      EventStream<ShoppingCartEvent>
    >(toStreamCollectionName(streamType));

    // TODO:
    // 1. Register here your event handlers using `eventStore.subscribe`.
    // 2. Store results in database.

    // first confirmed
    await eventStore.appendToStream<ShoppingCartEvent>(shoppingCartId, [
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
    ]);

    // cancelled
    await eventStore.appendToStream<ShoppingCartEvent>(
      cancelledShoppingCartId,
      [
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
      ],
    );

    // confirmed but other client
    await eventStore.appendToStream<ShoppingCartEvent>(
      otherClientShoppingCartId,
      [
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
      ],
    );

    // second confirmed
    await eventStore.appendToStream<ShoppingCartEvent>(
      otherConfirmedShoppingCartId,
      [
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
      ],
    );

    // first pending
    await eventStore.appendToStream<ShoppingCartEvent>(
      otherPendingShoppingCartId,
      [
        {
          type: 'ShoppingCartOpened',
          data: {
            shoppingCartId: otherPendingShoppingCartId,
            clientId,
            openedAt,
          },
        },
      ],
    );

    // first confirmed
    let shoppingCartStream = await shoppingCartStreams.findOne({
      streamName: shoppingCartId,
    });

    expect(shoppingCartStream).not.toBeNull();

    let shoppingCart = shoppingCartStream!.projections[
      'details'
    ] as MongoDBReadModel<ShoppingCartDetails>;

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
      _metadata: {
        name: 'details',
        schemaVersion: 1,
        streamPosition: 5,
      },
    });

    let shoppingCartShortInfo = shoppingCartStream!.projections[
      'short_info'
    ] as MongoDBReadModel<ShoppingCartDetails>;
    expect(shoppingCartShortInfo).toBeNull();

    // cancelled
    shoppingCartStream = await shoppingCartStreams.findOne({
      streamName: cancelledShoppingCartId,
    });

    shoppingCart = shoppingCartStream!.projections[
      'details'
    ] as MongoDBReadModel<ShoppingCartDetails>;

    expect(shoppingCart).toEqual({
      id: cancelledShoppingCartId,
      clientId,
      status: ShoppingCartStatus.Canceled,
      productItems: [dress],
      openedAt,
      canceledAt,
      totalAmount: dress.unitPrice * dress.quantity,
      totalItemsCount: dress.quantity,
      _metadata: {
        name: 'details',
        schemaVersion: 1,
        streamPosition: 3,
      },
    });

    shoppingCartShortInfo = shoppingCartStream!.projections[
      'short_info'
    ] as MongoDBReadModel<ShoppingCartDetails>;
    expect(shoppingCartShortInfo).toBeNull();

    // confirmed but other client
    shoppingCartStream = await shoppingCartStreams.findOne({
      streamName: otherClientShoppingCartId,
    });

    shoppingCart = shoppingCartStream!.projections[
      'details'
    ] as MongoDBReadModel<ShoppingCartDetails>;

    expect(shoppingCart).toEqual({
      id: otherClientShoppingCartId,
      clientId: otherClientId,
      status: ShoppingCartStatus.Confirmed,
      productItems: [dress],
      openedAt,
      confirmedAt,
      totalAmount: dress.unitPrice * dress.quantity,
      totalItemsCount: dress.quantity,
      _metadata: {
        name: 'details',
        schemaVersion: 1,
        streamPosition: 3,
      },
    });

    shoppingCartShortInfo = shoppingCartStream!.projections[
      'short_info'
    ] as MongoDBReadModel<ShoppingCartDetails>;
    expect(shoppingCartShortInfo).toBeNull();

    // second confirmed
    shoppingCartStream = await shoppingCartStreams.findOne({
      streamName: otherConfirmedShoppingCartId,
    });

    shoppingCart = shoppingCartStream!.projections[
      'details'
    ] as MongoDBReadModel<ShoppingCartDetails>;

    expect(shoppingCart).toEqual({
      id: otherConfirmedShoppingCartId,
      clientId,
      status: ShoppingCartStatus.Confirmed,
      productItems: [trousers],
      openedAt,
      confirmedAt,
      totalAmount: trousers.unitPrice * trousers.quantity,
      totalItemsCount: trousers.quantity,
      _metadata: {
        name: 'details',
        schemaVersion: 1,
        streamPosition: 3,
      },
    });

    shoppingCartShortInfo = shoppingCartStream!.projections[
      'short_info'
    ] as MongoDBReadModel<ShoppingCartDetails>;
    expect(shoppingCartShortInfo).toBeNull();

    // first pending
    shoppingCartStream = await shoppingCartStreams.findOne({
      streamName: otherPendingShoppingCartId,
    });

    shoppingCart = shoppingCartStream!.projections[
      'details'
    ] as MongoDBReadModel<ShoppingCartDetails>;
    expect(shoppingCart).toEqual({
      id: otherPendingShoppingCartId,
      clientId,
      status: ShoppingCartStatus.Pending,
      productItems: [],
      openedAt,
      totalAmount: 0,
      totalItemsCount: 0,
      _metadata: {
        name: 'details',
        schemaVersion: 1,
        streamPosition: 1,
      },
    });

    shoppingCartShortInfo = shoppingCartStream!.projections[
      'short_info'
    ] as MongoDBReadModel<ShoppingCartDetails>;

    expect(shoppingCartShortInfo).toStrictEqual({
      id: otherPendingShoppingCartId,
      clientId,
      totalAmount: 0,
      totalItemsCount: 0,
      _metadata: {
        name: 'short_info',
        schemaVersion: 1,
        streamPosition: 1,
      },
    });
  });
});

const detailsProjection = mongoDBInlineProjection({
  canHandle: [
    'ShoppingCartOpened',
    'ProductItemAddedToShoppingCart',
    'ProductItemRemovedFromShoppingCart',
    'ShoppingCartConfirmed',
    'ShoppingCartCanceled',
  ],
  evolve: (
    _document: ShoppingCartDetails | null,
    _event: ShoppingCartEvent,
  ): ShoppingCartDetails => {
    throw new Error('Not implemented!');
  },
});

const shortInfoProjection = mongoDBInlineProjection({
  name: 'short_info',
  canHandle: [
    'ShoppingCartOpened',
    'ProductItemAddedToShoppingCart',
    'ProductItemRemovedFromShoppingCart',
    'ShoppingCartConfirmed',
    'ShoppingCartCanceled',
  ],
  initialState: () => ({}) as ShoppingCartShortInfo,
  evolve: (
    _document: ShoppingCartShortInfo,
    _event: ShoppingCartEvent,
  ): ShoppingCartShortInfo | null => {
    throw new Error('Not implemented!');
  },
});
