import express, {
  Application,
  Router,
  NextFunction,
  Request,
  Response,
} from 'express';
import http from 'http';
import {
  AllStreamResolvedEvent,
  EventStoreDBClient,
  excludeSystemEvents,
  jsonEvent,
  NO_STREAM,
  START,
  StreamNotFoundError,
  WrongExpectedVersionError,
} from '@eventstore/db-client';
import { Map } from 'immutable';
import { finished, Readable } from 'stream';
import {
  DEFAULT_RETRY_OPTIONS,
  RetryOptions,
  retryPromise,
} from '#core/retries';
import {
  MongoClient,
  Collection,
  Long,
  ObjectId,
  UpdateResult,
  Document,
} from 'mongodb';

//////////////////////////////////////
/// Events
//////////////////////////////////////

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

//////////////////////////////////////
/// Commands
//////////////////////////////////////

export type ShoppingCartCommand =
  | {
      type: 'OpenShoppingCart';
      data: {
        shoppingCartId: string;
        clientId: string;
      };
    }
  | {
      type: 'AddProductItemToShoppingCart';
      data: {
        shoppingCartId: string;
        productItem: PricedProductItem;
      };
    }
  | {
      type: 'RemoveProductItemFromShoppingCart';
      data: {
        shoppingCartId: string;
        productItem: PricedProductItem;
      };
    }
  | {
      type: 'ConfirmShoppingCart';
      data: {
        shoppingCartId: string;
      };
    }
  | {
      type: 'CancelShoppingCart';
      data: {
        shoppingCartId: string;
      };
    };

//////////////////////////////////////
/// ProductItems
//////////////////////////////////////

export interface ProductItem {
  productId: string;
  quantity: number;
}

export type PricedProductItem = ProductItem & {
  price: number;
};

//////////////////////////////////////
/// Entity/State
//////////////////////////////////////

export type ShoppingCart =
  | {
      status: 'Empty';
    }
  | {
      status: 'Pending';
      productItems: ProductItems;
    }
  | {
      status: 'Closed';
    };

export type ProductItems = Map<string, Map<number, number>>;

export const addProductItem = (
  productItems: ProductItems,
  { productId, quantity, price }: PricedProductItem,
): ProductItems => {
  return productItems.update(productId, (productWithPrice) =>
    (productWithPrice ?? Map<number, number>()).update(
      price,
      (currentQuantity) => (currentQuantity ?? 0) + quantity,
    ),
  );
};

export const removeProductItem = (
  productItems: ProductItems,
  { productId, quantity, price }: PricedProductItem,
): ProductItems => {
  return productItems.update(productId, (productWithPrice) =>
    (productWithPrice ?? Map<number, number>()).update(
      price,
      (currentQuantity) => {
        if (!currentQuantity || currentQuantity < quantity) {
          throw ShoppingCartErrors.PRODUCT_ITEM_NOT_FOUND;
        }
        return currentQuantity - quantity;
      },
    ),
  );
};

//////////////////////////////////////
/// Getting the state from events
//////////////////////////////////////

export const evolve = (
  cart: ShoppingCart,
  { type, data: event }: ShoppingCartEvent,
): ShoppingCart => {
  switch (type) {
    case 'ShoppingCartOpened':
      if (cart.status != 'Empty') return cart;

      return {
        productItems: Map<string, Map<number, number>>(),
        status: 'Pending',
      };
    case 'ProductItemAddedToShoppingCart':
      if (cart.status != 'Pending') return cart;

      return {
        ...cart,
        productItems: addProductItem(cart.productItems, event.productItem),
      };
    case 'ProductItemRemovedFromShoppingCart':
      if (cart.status != 'Pending') return cart;

      return {
        ...cart,
        productItems: removeProductItem(cart.productItems, event.productItem),
      };
    case 'ShoppingCartConfirmed':
      if (cart.status != 'Pending') return cart;

      return {
        status: 'Closed',
      };
    case 'ShoppingCartCanceled':
      if (cart.status != 'Pending') return cart;

      return {
        status: 'Closed',
      };
    default: {
      const _: never = type;
      return cart;
    }
  }
};

//////////////////////////////////////
/// Decide
//////////////////////////////////////

const decide = (
  { type, data: command }: ShoppingCartCommand,
  shoppingCart: ShoppingCart,
): ShoppingCartEvent | ShoppingCartEvent[] => {
  switch (type) {
    case 'OpenShoppingCart': {
      if (shoppingCart.status != 'Empty') {
        throw ShoppingCartErrors.CART_ALREADY_EXISTS;
      }
      return {
        type: 'ShoppingCartOpened',
        data: {
          shoppingCartId: command.shoppingCartId,
          clientId: command.clientId,
          openedAt: new Date().toJSON(),
        },
      };
    }

    case 'AddProductItemToShoppingCart': {
      if (shoppingCart.status !== 'Pending') {
        throw ShoppingCartErrors.CART_IS_ALREADY_CLOSED;
      }
      return {
        type: 'ProductItemAddedToShoppingCart',
        data: {
          shoppingCartId: command.shoppingCartId,
          productItem: command.productItem,
        },
      };
    }

    case 'RemoveProductItemFromShoppingCart': {
      if (shoppingCart.status !== 'Pending') {
        throw ShoppingCartErrors.CART_IS_ALREADY_CLOSED;
      }

      assertProductItemExists(shoppingCart.productItems, command.productItem);

      return {
        type: 'ProductItemRemovedFromShoppingCart',
        data: {
          shoppingCartId: command.shoppingCartId,
          productItem: command.productItem,
        },
      };
    }

    case 'ConfirmShoppingCart': {
      if (shoppingCart.status !== 'Pending') {
        throw ShoppingCartErrors.CART_IS_ALREADY_CLOSED;
      }

      return {
        type: 'ShoppingCartConfirmed',
        data: {
          shoppingCartId: command.shoppingCartId,
          confirmedAt: new Date().toJSON(),
        },
      };
    }

    case 'CancelShoppingCart': {
      if (shoppingCart.status !== 'Pending') {
        throw ShoppingCartErrors.CART_IS_ALREADY_CLOSED;
      }

      return {
        type: 'ShoppingCartCanceled',
        data: {
          shoppingCartId: command.shoppingCartId,
          canceledAt: new Date().toJSON(),
        },
      };
    }
    default: {
      const _: never = command;
      throw ShoppingCartErrors.UNKNOWN_COMMAND_TYPE;
    }
  }
};

export const assertProductItemExists = (
  productItems: ProductItems,
  { productId, quantity, price }: PricedProductItem,
): void => {
  const currentQuantity = productItems.get(productId)?.get(price) ?? 0;

  if (currentQuantity < quantity) {
    throw ShoppingCartErrors.PRODUCT_ITEM_NOT_FOUND;
  }
};

export const decider: Decider<
  ShoppingCart,
  ShoppingCartCommand,
  ShoppingCartEvent
> = {
  decide,
  evolve,
  getInitialState: () => {
    return {
      status: 'Empty',
    };
  },
};

//////////////////////////////////////
/// Helpers
//////////////////////////////////////

export const isCashierShoppingCartEvent = (
  event: null | { type: string },
): event is ShoppingCartEvent => {
  return (
    event != null &&
    (event.type === 'ShoppingCartOpened' ||
      event.type === 'ProductItemAddedToShoppingCart' ||
      event.type === 'ProductItemRemovedFromShoppingCart' ||
      event.type === 'ShoppingCartConfirmed' ||
      event.type === 'ShoppingCartCanceled')
  );
};

export const enum ShoppingCartErrors {
  CART_ALREADY_EXISTS = 'CART_ALREADY_EXISTS',
  CART_IS_ALREADY_CLOSED = 'CART_IS_ALREADY_CLOSED',
  PRODUCT_ITEM_NOT_FOUND = 'PRODUCT_ITEM_NOT_FOUND',
  UNKNOWN_EVENT_TYPE = 'UNKNOWN_EVENT_TYPE',
  UNKNOWN_COMMAND_TYPE = 'UNKNOWN_COMMAND_TYPE',
}

export const toShoppingCartStreamId = (shoppingCartId: string) =>
  `shopping_cart-${shoppingCartId}`;

//////////////////////////////////////
/// Decider
//////////////////////////////////////

export type Event<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>,
> = Readonly<{
  type: Readonly<EventType>;
  data: Readonly<EventData>;
}>;

export type Command<
  CommandType extends string = string,
  CommandData extends Record<string, unknown> = Record<string, unknown>,
> = Readonly<{
  type: Readonly<CommandType>;
  data: Readonly<CommandData>;
}>;

export type Decider<
  State,
  CommandType extends Command,
  EventType extends Event,
> = {
  decide: (command: CommandType, state: State) => EventType | EventType[];
  evolve: (currentState: State, event: EventType) => State;
  getInitialState: () => State;
};

//////////////////////////////////////
/// ESDB
//////////////////////////////////////

let eventStore: EventStoreDBClient;

export const getEventStore = (connectionString?: string) => {
  if (!eventStore) {
    eventStore = EventStoreDBClient.connectionString(
      connectionString ?? 'esdb://localhost:2113?tls=false',
    );
  }

  return eventStore;
};

export const readStream = async <EventType extends Event>(
  eventStore: EventStoreDBClient,
  streamId: string,
): Promise<EventType[]> => {
  const events = [];
  try {
    for await (const { event } of eventStore.readStream<EventType>(streamId)) {
      if (!event) continue;

      events.push(<EventType>{
        type: event.type,
        data: event.data,
      });
    }
    return events;
  } catch (error) {
    if (error instanceof StreamNotFoundError) {
      return [];
    }

    throw error;
  }
};

export type AppendResult =
  | {
      nextExpectedRevision: ETag;
      successful: true;
    }
  | { expected: ETag; actual: ETag; successful: false };

export const appendToStream = async (
  eventStore: EventStoreDBClient,
  streamId: string,
  eTag: ETag | undefined,
  ...events: Event[]
): Promise<AppendResult> => {
  try {
    const result = await eventStore.appendToStream(
      streamId,
      events.map(jsonEvent),
      {
        expectedRevision: eTag ? getExpectedRevisionFromETag(eTag) : NO_STREAM,
      },
    );

    return {
      successful: true,
      nextExpectedRevision: toWeakETag(result.nextExpectedRevision),
    };
  } catch (error) {
    if (error instanceof WrongExpectedVersionError) {
      return {
        successful: false,
        expected: toWeakETag(error.expectedVersion),
        actual: toWeakETag(error.actualVersion),
      };
    }
    throw error;
  }
};

//////////////////////////////////////
/// ETAG
//////////////////////////////////////

export type WeakETag = `W/${string}`;
export type ETag = string;

export const WeakETagRegex = /W\/"(-?\d+.*)"/;

export const enum ETagErrors {
  WRONG_WEAK_ETAG_FORMAT = 'WRONG_WEAK_ETAG_FORMAT',
  MISSING_IF_MATCH_HEADER = 'MISSING_IF_MATCH_HEADER',
}

export const isWeakETag = (etag: ETag): etag is WeakETag => {
  return WeakETagRegex.test(etag);
};

export const getWeakETagValue = (etag: ETag): string => {
  const result = WeakETagRegex.exec(etag);
  if (result === null || result.length === 0) {
    throw ETagErrors.WRONG_WEAK_ETAG_FORMAT;
  }
  return result[1];
};

export const toWeakETag = (value: number | bigint | string): WeakETag => {
  return `W/"${value}"`;
};

export const getExpectedRevisionFromETag = (
  eTag: ETag,
): bigint | 'no_stream' => {
  const revision = assertBigInt(getWeakETagValue(eTag));

  if (revision === -1n) return NO_STREAM;

  return revision;
};

export const getETagFromIfMatch = (request: Request): ETag => {
  const etag = request.headers['if-match'];

  if (etag === undefined) {
    throw ETagErrors.MISSING_IF_MATCH_HEADER;
  }

  return etag;
};

//////////////////////////////////////
/// Validation
//////////////////////////////////////

export const enum ValidationErrors {
  NOT_A_NONEMPTY_STRING = 'NOT_A_NONEMPTY_STRING',
  NOT_A_POSITIVE_NUMBER = 'NOT_A_POSITIVE_NUMBER',
  NOT_AN_UNSIGNED_BIGINT = 'NOT_AN_UNSIGNED_BIGINT',
}

export const assertNotEmptyString = (value: unknown): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw ValidationErrors.NOT_A_NONEMPTY_STRING;
  }
  return value;
};

export const assertPositiveNumber = (
  value: string | number | undefined,
): number => {
  if (value === undefined) throw ValidationErrors.NOT_A_POSITIVE_NUMBER;

  const number = typeof value === 'number' ? value : Number(value);

  if (number <= 0) {
    throw ValidationErrors.NOT_A_POSITIVE_NUMBER;
  }
  return number;
};

export const assertBigInt = (value: string): bigint => {
  return BigInt(value);
};

export const assertUnsignedBigInt = (value: string): bigint => {
  const number = assertBigInt(value);
  if (number < 0) {
    throw ValidationErrors.NOT_AN_UNSIGNED_BIGINT;
  }
  return number;
};

//////////////////////////////////////
/// Command Handler
//////////////////////////////////////

export const CommandHandler =
  <State, CommandType extends Command, EventType extends Event>(
    getEventStore: () => EventStoreDBClient,
    toStreamId: (recordId: string) => string,
    decider: Decider<State, CommandType, EventType>,
  ) =>
  async (
    recordId: string,
    command: CommandType,
    eTag: ETag | undefined = undefined,
  ): Promise<AppendResult> => {
    const eventStore = getEventStore();

    const streamId = toStreamId(recordId);
    const events = await readStream<EventType>(eventStore, streamId);

    const state = events.reduce<State>(
      decider.evolve,
      decider.getInitialState(),
    );

    const newEvents = decider.decide(command, state);

    const toAppend = Array.isArray(newEvents) ? newEvents : [newEvents];

    return appendToStream(eventStore, streamId, eTag, ...toAppend);
  };

//////////////////////////////////////
/// HTTP Helpers
//////////////////////////////////////

export const HTTPHandler =
  <Command, RequestType extends Request = Request>(
    handleCommand: (
      recordId: string,
      command: Command,
      eTag?: ETag,
    ) => Promise<AppendResult>,
  ) =>
  (
    mapRequest: (
      request: RequestType,
      handler: (recordId: string, command: Command) => Promise<void>,
    ) => Promise<void>,
  ) =>
  async (request: RequestType, response: Response, next: NextFunction) => {
    try {
      await mapRequest(request, async (recordId, command) => {
        const result = await handleCommand(
          recordId,
          command,
          getETagFromIfMatch(request),
        );

        return mapToResponse(response, recordId, result);
      });
    } catch (error) {
      next(error);
    }
  };

//////////////////////////////////////
/// Routes
//////////////////////////////////////

export const router = Router();

const handleCommand = CommandHandler<
  ShoppingCart,
  ShoppingCartCommand,
  ShoppingCartEvent
>(getEventStore, toShoppingCartStreamId, decider);

const on = HTTPHandler<ShoppingCartCommand>(handleCommand);

// Open Shopping cart
router.post(
  '/clients/:clientId/shopping-carts/',
  on((request, handle) => {
    const shoppingCartId = mongoObjectId();

    return handle(shoppingCartId, {
      type: 'OpenShoppingCart',
      data: {
        shoppingCartId,
        clientId: assertNotEmptyString(request.params.clientId),
      },
    });
  }),
);

type AddProductItemToShoppingCartRequest = Request<
  Partial<{ shoppingCartId: string }>,
  unknown,
  Partial<{ productId: number; quantity: number }>
>;

// Add Product Item
router.post(
  '/clients/:clientId/shopping-carts/:shoppingCartId/product-items',
  on(async (request: AddProductItemToShoppingCartRequest, handle) => {
    const shoppingCartId = assertNotEmptyString(request.params.shoppingCartId);

    const productId = assertNotEmptyString(request.body.productId);
    const quantity = assertPositiveNumber(request.body.quantity);

    const price = await getProductPrice(productId);

    return handle(shoppingCartId, {
      type: 'AddProductItemToShoppingCart',
      data: {
        shoppingCartId,
        productItem: {
          productId,
          quantity,
          price,
        },
      },
    });
  }),
);

export const getProductPrice = (_productId: string): Promise<number> => {
  // You should call some real service or storage in real life, aye?
  return Promise.resolve(Math.random());
};

export type RemoveProductItemFromShoppingCartRequest = Request<
  Partial<{ shoppingCartId: string }>,
  unknown,
  unknown,
  Partial<{ productId: number; quantity: number; price: number }>
>;

// Remove Product Item
router.delete(
  '/clients/:clientId/shopping-carts/:shoppingCartId/product-items',
  on((request: RemoveProductItemFromShoppingCartRequest, handle) => {
    const shoppingCartId = assertNotEmptyString(request.params.shoppingCartId);

    return handle(shoppingCartId, {
      type: 'RemoveProductItemFromShoppingCart',
      data: {
        shoppingCartId,
        productItem: {
          productId: assertNotEmptyString(request.query.productId),
          quantity: assertPositiveNumber(request.query.quantity),
          price: assertPositiveNumber(request.query.price),
        },
      },
    });
  }),
);

type ConfirmShoppingCartRequest = Request<Partial<{ shoppingCartId: string }>>;

// Confirm Shopping Cart
router.post(
  '/clients/:clientId/shopping-carts/:shoppingCartId/confirm',
  on((request: ConfirmShoppingCartRequest, handle) => {
    const shoppingCartId = assertNotEmptyString(request.params.shoppingCartId);

    return handle(shoppingCartId, {
      type: 'ConfirmShoppingCart',
      data: {
        shoppingCartId,
      },
    });
  }),
);

type CancelShoppingCartRequest = Request<Partial<{ shoppingCartId: string }>>;

// Cancel Shopping Cart
router.delete(
  '/clients/:clientId/shopping-carts/:shoppingCartId',
  on((request: CancelShoppingCartRequest, handle) => {
    const shoppingCartId = assertNotEmptyString(request.params.shoppingCartId);

    return handle(shoppingCartId, {
      type: 'CancelShoppingCart',
      data: {
        shoppingCartId,
      },
    });
  }),
);

router.get(
  '/clients/:clientId/shopping-carts/:shoppingCartId',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const collection = await getShoppingCartsCollection();

      const result = await collection.findOne({
        _id: new ObjectId(assertNotEmptyString(request.params.shoppingCartId)),
      });

      if (result === null) {
        response.sendStatus(404);
        return;
      }

      response.set('ETag', toWeakETag(result.revision));
      response.send(result);
    } catch (error) {
      next(error);
    }
  },
);

export type SubscriptionResolvedEvent = AllStreamResolvedEvent & {
  subscriptionId: string;
};

export type Checkpoint = { position: string };

export type EventHandler = (event: SubscriptionResolvedEvent) => Promise<void>;

export const SubscriptionToAll =
  (
    eventStore: EventStoreDBClient,
    loadCheckpoint: (subscriptionId: string) => Promise<bigint | undefined>,
  ) =>
  async (subscriptionId: string, handlers: EventHandler[]) => {
    const currentPosition = await loadCheckpoint(subscriptionId);
    const fromPosition = !currentPosition
      ? START
      : { prepare: currentPosition, commit: currentPosition };

    const subscription = eventStore.subscribeToAll({
      fromPosition,
      filter: excludeSystemEvents(),
    });

    finished(
      subscription.on('data', async (resolvedEvent: AllStreamResolvedEvent) => {
        for (const handler of handlers) {
          await handler({ ...resolvedEvent, subscriptionId });
        }
      }) as Readable,
      (error) => {
        if (!error) {
          console.info(`Stopping subscription.`);
          return;
        }
        console.error('Received error');
        console.error(error);
      },
    );
    return subscription;
  };

//////////////////////////////////////
/// HTTP Helpers
//////////////////////////////////////

const sendCreated = (
  response: Response,
  createdId: string,
  urlPrefix?: string,
): void => {
  response.setHeader(
    'Location',
    `${urlPrefix ?? response.req.url}/${createdId}`,
  );
  response.status(201).json({ id: createdId });
};

const mapToResponse = (
  response: Response,
  recordId: string,
  result: AppendResult,
  urlPrefix?: string,
): void => {
  if (!result.successful) {
    response.sendStatus(412);
    return;
  }

  response.set('ETag', toWeakETag(result.nextExpectedRevision));

  if (result.nextExpectedRevision == toWeakETag(0)) {
    sendCreated(response, recordId, urlPrefix);
    return;
  }

  response.status(200);
};

//////////////////////////////////////
/// MongoDB
//////////////////////////////////////

let mongoClient: MongoClient;

export const getMongoDB = async (
  connectionString?: string,
): Promise<MongoClient> => {
  if (!mongoClient) {
    mongoClient = new MongoClient(
      connectionString ?? 'mongodb://localhost:27017/',
      {
        directConnection: true,
      },
    );
    await mongoClient.connect();
  }

  return mongoClient;
};

export type ExecuteOnMongoDBOptions =
  | {
      collectionName: string;
      databaseName?: string;
    }
  | string;

export async function getMongoCollection<Doc extends Document>(
  options: ExecuteOnMongoDBOptions,
): Promise<Collection<Doc>> {
  const mongo = await getMongoDB();

  const { databaseName, collectionName } =
    typeof options !== 'string'
      ? options
      : { databaseName: undefined, collectionName: options };

  const db = mongo.db(databaseName);
  return db.collection<Doc>(collectionName);
}

export const toObjectId = (id: string) => id as unknown as ObjectId;

export const enum MongoDBErrors {
  FAILED_TO_UPDATE_DOCUMENT = 'FAILED_TO_UPDATE_DOCUMENT',
  DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND',
}

export const assertUpdated = async (
  update: () => Promise<UpdateResult>,
): Promise<UpdateResult> => {
  const result = await update();

  if (result.modifiedCount === 0) {
    throw MongoDBErrors.FAILED_TO_UPDATE_DOCUMENT;
  }

  return result;
};

export const assertFound = async <T>(
  find: () => Promise<T | null>,
): Promise<T> => {
  const result = await find();

  if (result === null) {
    throw MongoDBErrors.DOCUMENT_NOT_FOUND;
  }

  return result;
};

//////////////////////////////////////
/// Retries
//////////////////////////////////////

export const retryIfNotFound = <T>(
  find: () => Promise<T | null>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS,
): Promise<T> => {
  return retryPromise(() => assertFound(find), options);
};

export const retryIfNotUpdated = (
  update: () => Promise<UpdateResult>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS,
): Promise<UpdateResult> => {
  return retryPromise(() => assertUpdated(update), options);
};

//////////////////////////////////////
/// MongoDB Checkpointing
//////////////////////////////////////

export const getCheckpointsCollection = () =>
  getMongoCollection<Checkpoint>('checkpoints');

export const loadCheckPointFromCollection = async (subscriptionId: string) => {
  const checkpoints = await getCheckpointsCollection();

  const checkpoint = await checkpoints.findOne({
    _id: toObjectId(subscriptionId),
  });

  return checkpoint != null ? BigInt(checkpoint.position) : undefined;
};

export const storeCheckpointInCollection =
  (...handlers: EventHandler[]) =>
  async (event: SubscriptionResolvedEvent) => {
    if (!event.commitPosition) return;

    await Promise.all(handlers.map((handle) => handle(event)));

    const checkpoints = await getCheckpointsCollection();

    await checkpoints.updateOne(
      {
        _id: toObjectId(event.subscriptionId),
      },
      {
        $set: {
          position: event.commitPosition.toString(),
        },
      },
      {
        upsert: true,
      },
    );
  };

export const mongoObjectId = () => {
  const timestamp = ((new Date().getTime() / 1000) | 0).toString(16);
  return (
    timestamp +
    'xxxxxxxxxxxxxxxx'
      .replace(/[x]/g, function () {
        return ((Math.random() * 16) | 0).toString(16);
      })
      .toLowerCase()
  );
};

export const SubscriptionToAllWithMongoCheckpoints = SubscriptionToAll(
  getEventStore(),
  loadCheckPointFromCollection,
);

////////////////////////
// PROJECTIONS
///

export const ShoppingCartStatus = {
  Pending: 'Pending',
  Canceled: 'Canceled',
  Confirmed: 'Confirmed',
};

type ShoppingCartDetails = Readonly<{
  shoppingCartId: string;
  clientId: string;
  status: string;
  productItems: PricedProductItem[];
  openedAt: string;
  confirmedAt?: string;
  canceledAt?: string;
  revision: number;
}>;

export const getShoppingCartsCollection = () =>
  getMongoCollection<ShoppingCartDetails>('shoppingCartDetails');

export const projectShoppingCartDetails = async (
  carts: Collection<ShoppingCartDetails>,
  event: ShoppingCartEvent,
  streamRevision: number,
): Promise<UpdateResult> => {
  const expectedRevision = streamRevision - 1;
  switch (event.type) {
    case 'ShoppingCartOpened': {
      return carts.updateOne(
        { _id: new ObjectId(event.data.shoppingCartId) },
        {
          $set: {
            clientId: event.data.clientId,
            status: ShoppingCartStatus.Pending,
            productItems: [],
            openedAt: event.data.openedAt,
            confirmedAt: undefined,
            revision: streamRevision,
          },
        },
        { upsert: true },
      );
    }
    case 'ProductItemAddedToShoppingCart': {
      await carts.updateOne(
        {
          _id: new ObjectId(event.data.shoppingCartId),
          'productItems.productId': { $ne: event.data.productItem.productId },
          'productItems.price': { $ne: event.data.productItem.price },
        },
        {
          $addToSet: {
            productItems: {
              productId: event.data.productItem.productId,
              quantity: 0,
              price: event.data.productItem.price,
            },
          },
        },
      );

      return carts.updateOne(
        {
          _id: new ObjectId(event.data.shoppingCartId),
          revision: expectedRevision,
        },
        {
          $inc: {
            'productItems.$[productItem].quantity':
              event.data.productItem.quantity,
            revision: 1,
          },
        },
        {
          arrayFilters: [
            {
              'productItem.productId': event.data.productItem.productId,
              'productItem.price': event.data.productItem.price,
            },
          ],
          upsert: true,
        },
      );
    }
    case 'ProductItemRemovedFromShoppingCart': {
      return carts.updateOne(
        {
          _id: new ObjectId(event.data.shoppingCartId),
          'productItems.productId': event.data.productItem.productId,
          revision: expectedRevision,
        },
        {
          $inc: {
            'productItems.$.quantity': -event.data.productItem.quantity,
            revision: 1,
          },
        },
        { upsert: false },
      );
    }
    case 'ShoppingCartConfirmed': {
      return carts.updateOne(
        {
          _id: new ObjectId(event.data.shoppingCartId),
          revision: expectedRevision,
        },
        {
          $set: {
            status: ShoppingCartStatus.Confirmed,
            confirmedAt: event.data.confirmedAt,
          },
          $inc: {
            revision: 1,
          },
        },
        { upsert: false },
      );
    }
    case 'ShoppingCartCanceled': {
      return carts.updateOne(
        {
          _id: new ObjectId(event.data.shoppingCartId),
          revision: expectedRevision,
        },
        {
          $set: {
            status: ShoppingCartStatus.Confirmed,
            canceledAt: event.data.canceledAt,
          },
          $inc: {
            revision: 1,
          },
        },
        { upsert: false },
      );
    }
    default: {
      const _: never = event;
      throw ShoppingCartErrors.UNKNOWN_EVENT_TYPE;
    }
  }
};

export const projectToShoppingCartDetails = async (
  resolvedEvent: SubscriptionResolvedEvent,
): Promise<void> => {
  if (
    resolvedEvent.event === undefined ||
    !isCashierShoppingCartEvent(resolvedEvent.event)
  )
    return Promise.resolve();

  const { event } = resolvedEvent;
  const streamRevision = Number(event.revision);
  const shoppingCarts = await getShoppingCartsCollection();

  await projectShoppingCartDetails(shoppingCarts, event, streamRevision);
};

type PendingShoppingCart = {
  shoppingCartId: string;
  totalQuantity: number;
  totalAmount: number;
  isDeleted: boolean;
};

type ClientShoppingHistory = Readonly<{
  totalQuantity: number;
  totalAmount: number;
  pending: PendingShoppingCart[];
  position: Long;
}>;

export const getClientShoppingHistoryCollection = () =>
  getMongoCollection<ClientShoppingHistory>('clientShoppingHistory');

export const project = async (
  clientShoppingHistory: Collection<ClientShoppingHistory>,
  { type, data: event }: ShoppingCartEvent,
  eventPosition: Long,
): Promise<void> => {
  switch (type) {
    case 'ShoppingCartOpened': {
      await clientShoppingHistory.updateOne(
        { _id: new ObjectId(event.clientId) },
        {
          $setOnInsert: {
            totalQuantity: 0,
            totalAmount: 0,
            pending: [],
            position: Long.fromNumber(0),
          },
        },
        { upsert: true },
      );

      await clientShoppingHistory.updateOne(
        { _id: new ObjectId(event.clientId), position: { $lt: eventPosition } },
        {
          $addToSet: {
            pending: {
              shoppingCartId: event.shoppingCartId,
              totalAmount: 0,
              totalQuantity: 0,
              isDeleted: false,
            },
          },
        },
      );
      break;
    }
    case 'ProductItemAddedToShoppingCart': {
      await clientShoppingHistory.updateOne(
        {
          position: { $lt: eventPosition },
          'pending.shoppingCartId': event.shoppingCartId,
        },
        {
          $inc: {
            'pending.$.quantity': event.productItem.quantity,
            'pending.$.totalAmount':
              event.productItem.quantity * event.productItem.price,
          },
          $set: {
            position: eventPosition,
          },
        },
      );
      break;
    }
    case 'ProductItemRemovedFromShoppingCart': {
      await clientShoppingHistory.updateOne(
        {
          position: { $lt: eventPosition },
          'pending.shoppingCartId': event.shoppingCartId,
        },
        {
          $inc: {
            'pending.$.quantity': -event.productItem.quantity,
            'pending.$.totalAmount':
              -event.productItem.quantity * event.productItem.price,
          },
          $set: {
            position: eventPosition,
          },
        },
      );
      break;
    }
    case 'ShoppingCartConfirmed': {
      const history = await retryIfNotFound(() =>
        clientShoppingHistory.findOne(
          {
            position: { $lt: eventPosition },
            'pending.shoppingCartId': event.shoppingCartId,
          },
          {
            projection: {
              'pending.$': 1,
            },
          },
        ),
      ).catch(console.warn);

      if (!history || history.pending.length === 0) return;

      await clientShoppingHistory.updateOne(
        {
          position: { $lt: eventPosition },
          'pending.shoppingCartId': event.shoppingCartId,
        },
        [
          {
            $set: {
              totalQuantity: {
                $add: ['$totalQuantity', history.pending[0].totalQuantity],
              },
              totalAmount: {
                $add: ['$totalAmount', history.pending[0].totalAmount],
              },
            },
          },
          {
            $project: {
              _id: 0,
              totalQuantity: 0,
              totalAmount: 0,
              position: 0,
              pending: {
                $filter: {
                  input: '$pending',
                  as: 'item',
                  cond: {
                    $ne: ['$$item.shoppingCartId', event.shoppingCartId],
                  },
                },
              },
            },
          },
        ],
      );
      break;
    }
    case 'ShoppingCartCanceled': {
      await clientShoppingHistory.updateOne(
        {
          position: { $lt: eventPosition },
          'pending.shoppingCartId': event.shoppingCartId,
        },
        {
          $pull: {
            pending: {
              shoppingCartId: event.shoppingCartId,
            },
          },
        },
      );
      break;
    }
    default: {
      const _: never = event;
      throw ShoppingCartErrors.UNKNOWN_EVENT_TYPE;
    }
  }
};

export const projectToClientShoppingHistory = async (
  resolvedEvent: SubscriptionResolvedEvent,
): Promise<void> => {
  const event = resolvedEvent.event;
  if (event === undefined) return Promise.resolve();
  const eventPosition = event.position.commit;

  if (event === undefined || !isCashierShoppingCartEvent(event))
    return Promise.resolve();

  const summary = await getClientShoppingHistoryCollection();

  await project(summary, event, Long.fromBigInt(eventPosition));
};

//////////////////////////////////////
/// Application
//////////////////////////////////////

const app: Application = express();

app.set('etag', false);
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  }),
);
app.use(router);

const server = http.createServer(app);

server.listen(5000);

(async () => {
  await SubscriptionToAllWithMongoCheckpoints('sub_shopping_carts', [
    storeCheckpointInCollection(
      projectToShoppingCartDetails,
      projectToClientShoppingHistory,
    ),
  ]);
})().catch(console.error);

server.on('listening', () => {
  console.info('server up listening');
});
