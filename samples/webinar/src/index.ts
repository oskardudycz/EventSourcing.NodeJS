//////////////////////////////////////
/// Events
//////////////////////////////////////
import {
  AllStreamResolvedEvent,
  AppendResult,
  EventStoreDBClient,
  EventType,
  excludeSystemEvents,
  jsonEvent,
  JSONEventType,
  NO_STREAM,
  RecordedEvent,
  ResolvedEvent,
  START,
  StreamingRead,
} from '@eventstore/db-client';
import express, {
  NextFunction,
  Request,
  Response,
  Application,
  Router,
} from 'express';
import http from 'http';
import { Collection, MongoClient, ObjectId, UpdateResult } from 'mongodb';
import { v4 as uuid } from 'uuid';

//////////////////////////////////////
/// Entity/State
//////////////////////////////////////

type ShoppingCartOpened = JSONEventType<
  'shopping-cart-opened',
  {
    shoppingCartId: string;
    clientId: string;
    openedAt: string;
  }
>;

type ProductItemAddedToShoppingCart = JSONEventType<
  'product-item-added-to-shopping-cart',
  {
    shoppingCartId: string;
    productItem: ProductItem;
  }
>;

type ProductItemRemovedFromShoppingCart = JSONEventType<
  'product-item-removed-from-shopping-cart',
  {
    shoppingCartId: string;
    productItem: ProductItem;
  }
>;

type ShoppingCartConfirmed = JSONEventType<
  'shopping-cart-confirmed',
  {
    shoppingCartId: string;
    confirmedAt: string;
  }
>;

type ShoppingCartEvent =
  | ShoppingCartOpened
  | ProductItemAddedToShoppingCart
  | ProductItemRemovedFromShoppingCart
  | ShoppingCartConfirmed;

//////////////////////////////////////
/// Entity/State
//////////////////////////////////////

const enum ShoppingCartStatus {
  Opened = 1,
  Confirmed = 2,
  Cancelled = 4,
  Closed = Confirmed | Cancelled,
}

interface ShoppingCart {
  id: string;
  clientId: string;
  status: ShoppingCartStatus;
  productItems: ProductItem[];
  openedAt: Date;
  confirmedAt?: Date;
}

const isCashierShoppingCartEvent = (event: any): event is ShoppingCartEvent => {
  return (
    event != null &&
    (event.type === 'shopping-cart-opened' ||
      event.type === 'product-item-added-to-shopping-cart' ||
      event.type === 'product-item-removed-from-shopping-cart' ||
      event.type === 'shopping-cart-confirmed')
  );
};

const enum ShoppingCartErrors {
  OPENED_EXISTING_CART = 'OPENED_EXISTING_CART',
  CART_IS_ALREADY_CLOSED = 'CART_IS_ALREADY_CLOSED',
  CART_NOT_FOUND = 'CART_NOT_FOUND',
  PRODUCT_ITEM_NOT_FOUND = 'PRODUCT_ITEM_NOT_FOUND',
  UNKNOWN_EVENT_TYPE = 'UNKNOWN_EVENT_TYPE',
}

const toShoppingCartStreamName = (shoppingCartId: string) =>
  `shopping_cart-${shoppingCartId}`;

const assertShoppingCartIsNotClosed = (shoppingCart: ShoppingCart) => {
  if (
    (shoppingCart.status & ShoppingCartStatus.Closed) ===
    ShoppingCartStatus.Closed
  ) {
    throw ShoppingCartErrors.CART_IS_ALREADY_CLOSED;
  }
};

//////////////////////////////////////
/// Product Items
//////////////////////////////////////

interface ProductItem {
  productId: string;
  quantity: number;
}

const addProductItem = (
  productItems: ProductItem[],
  newProductItem: ProductItem
): ProductItem[] => {
  const { productId, quantity } = newProductItem;

  const currentProductItem = findProductItem(productItems, productId);

  if (!currentProductItem) return [...productItems, newProductItem];

  const newQuantity = currentProductItem.quantity + quantity;
  const mergedProductItem = { productId, quantity: newQuantity };

  return productItems.map((pi) =>
    pi.productId === productId ? mergedProductItem : pi
  );
};

const removeProductItem = (
  productItems: ProductItem[],
  newProductItem: ProductItem
): ProductItem[] => {
  const { productId, quantity } = newProductItem;

  const currentProductItem = assertProductItemExists(
    productItems,
    newProductItem
  );

  const newQuantity = currentProductItem.quantity - quantity;

  if (newQuantity === 0)
    return productItems.filter((pi) => pi.productId !== productId);

  const mergedProductItem = { productId, quantity: newQuantity };

  return productItems.map((pi) =>
    pi.productId === productId ? mergedProductItem : pi
  );
};

const findProductItem = (
  productItems: ProductItem[],
  productId: string
): ProductItem | undefined => {
  return productItems.find((pi) => pi.productId === productId);
};

const assertProductItemExists = (
  productItems: ProductItem[],
  { productId, quantity }: ProductItem
): ProductItem => {
  const current = findProductItem(productItems, productId);

  if (!current || current.quantity < quantity) {
    throw ShoppingCartErrors.PRODUCT_ITEM_NOT_FOUND;
  }

  return current;
};

//////////////////////////////////////
/// Getting the state from events
//////////////////////////////////////

type ApplyEvent<Entity, E extends EventType> = (
  currentState: Entity | undefined,
  event: RecordedEvent<E>
) => Entity;

const StreamAggregator =
  <Entity, StreamEvents extends EventType>(
    when: ApplyEvent<Entity, StreamEvents>
  ) =>
  async (
    eventStream: StreamingRead<ResolvedEvent<StreamEvents>>
  ): Promise<Entity> => {
    let currentState: Entity | undefined = undefined;
    for await (const { event } of eventStream) {
      if (!event) continue;
      currentState = when(currentState, event);
    }
    if (currentState == null) throw 'oh no';
    return currentState;
  };

const getShoppingCart = StreamAggregator<ShoppingCart, ShoppingCartEvent>(
  (currentState, event) => {
    if (event.type === 'shopping-cart-opened') {
      if (currentState != null) throw ShoppingCartErrors.OPENED_EXISTING_CART;
      return {
        id: event.data.shoppingCartId,
        clientId: event.data.clientId,
        openedAt: new Date(event.data.openedAt),
        productItems: [],
        status: ShoppingCartStatus.Opened,
      };
    }

    if (currentState == null) throw ShoppingCartErrors.CART_NOT_FOUND;

    switch (event.type) {
      case 'product-item-added-to-shopping-cart':
        return {
          ...currentState,
          productItems: addProductItem(
            currentState.productItems,
            event.data.productItem
          ),
        };
      case 'product-item-removed-from-shopping-cart':
        return {
          ...currentState,
          productItems: removeProductItem(
            currentState.productItems,
            event.data.productItem
          ),
        };
      case 'shopping-cart-confirmed':
        return {
          ...currentState,
          status: ShoppingCartStatus.Confirmed,
          confirmedAt: new Date(event.data.confirmedAt),
        };
      default: {
        const _: never = event;
        throw ShoppingCartErrors.UNKNOWN_EVENT_TYPE;
      }
    }
  }
);

//////////////////////////////////////
/// Open shopping cart
//////////////////////////////////////

type OpenShoppingCart = {
  shoppingCartId: string;
  clientId: string;
};

const openShoppingCart = ({
  shoppingCartId,
  clientId,
}: OpenShoppingCart): ShoppingCartOpened => {
  return {
    type: 'shopping-cart-opened',
    data: {
      shoppingCartId,
      clientId,
      openedAt: new Date().toJSON(),
    },
  };
};

//////////////////////////////////////
/// Add product item to shopping cart
//////////////////////////////////////

// type CommandHandler<E extends EventType, Command> =
//   | ((command: Command) => EventType)
//   | ((
//       events: StreamingRead<ResolvedEvent<E>>,
//       command: Command
//     ) => Promise<EventType>);

// type ShoppingCartCommandHandler<Command> = CommandHandler<
//   ShoppingCartEvent,
//   Command
// >;

type AddProductItemToShoppingCart = {
  shoppingCartId: string;
  productItem: ProductItem;
};

const addProductItemToShoppingCart = async (
  events: StreamingRead<ResolvedEvent<ShoppingCartEvent>>,
  { shoppingCartId, productItem }: AddProductItemToShoppingCart
): Promise<ProductItemAddedToShoppingCart> => {
  const shoppingCart = await getShoppingCart(events);

  assertShoppingCartIsNotClosed(shoppingCart);

  assertProductItemExists(shoppingCart.productItems, productItem);

  return {
    type: 'product-item-added-to-shopping-cart',
    data: {
      shoppingCartId,
      productItem,
    },
  };
};

//////////////////////////////////////
/// Remove product item to shopping cart
//////////////////////////////////////

type RemoveProductItemFromShoppingCart = {
  shoppingCartId: string;
  productItem: ProductItem;
};

const removeProductItemFromShoppingCart = async (
  events: StreamingRead<ResolvedEvent<ShoppingCartEvent>>,
  { shoppingCartId, productItem }: RemoveProductItemFromShoppingCart
): Promise<ProductItemRemovedFromShoppingCart> => {
  const shoppingCart = await getShoppingCart(events);

  assertShoppingCartIsNotClosed(shoppingCart);

  assertProductItemExists(shoppingCart.productItems, productItem);

  return {
    type: 'product-item-removed-from-shopping-cart',
    data: {
      shoppingCartId,
      productItem,
    },
  };
};

//////////////////////////////////////
/// Confirm shopping cart
//////////////////////////////////////

type ConfirmShoppingCart = {
  shoppingCartId: string;
};

const confirmShoppingCart = async (
  events: StreamingRead<ResolvedEvent<ShoppingCartEvent>>,
  { shoppingCartId }: ConfirmShoppingCart
): Promise<ShoppingCartConfirmed> => {
  const shoppingCart = await getShoppingCart(events);

  assertShoppingCartIsNotClosed(shoppingCart);

  return {
    type: 'shopping-cart-confirmed',
    data: {
      shoppingCartId,
      confirmedAt: new Date().toJSON(),
    },
  };
};

//////////////////////////////////////
/// ESDB
//////////////////////////////////////

let eventStore: EventStoreDBClient;

const getEventStore = (connectionString?: string) => {
  if (!eventStore) {
    eventStore = EventStoreDBClient.connectionString(
      connectionString ?? 'esdb://localhost:2113?tls=false'
    );
  }

  return eventStore;
};

const create =
  <Command, StreamEvent extends JSONEventType>(
    eventStore: EventStoreDBClient,
    handle: (command: Command) => StreamEvent
  ) =>
  (streamName: string, command: Command): Promise<AppendResult> => {
    const event = handle(command);

    return eventStore.appendToStream(streamName, jsonEvent(event), {
      expectedRevision: NO_STREAM,
    });
  };

const update =
  <Command, StreamEvent extends JSONEventType>(
    eventStore: EventStoreDBClient,
    handle: (
      events: StreamingRead<ResolvedEvent<StreamEvent>>,
      command: Command
    ) => Promise<StreamEvent>
  ) =>
  async (
    streamName: string,
    command: Command,
    expectedRevision: bigint
  ): Promise<AppendResult> => {
    const readStream = eventStore.readStream(streamName);

    const event = await handle(readStream, command);

    const eventData = jsonEvent(event);

    return eventStore.appendToStream(streamName, eventData, {
      expectedRevision,
    });
  };

//////////////////////////////////////
/// Validation
//////////////////////////////////////

const enum ValidationErrors {
  NOT_A_NONEMPTY_STRING = 'NOT_A_NONEMPTY_STRING',
  NOT_A_POSITIVE_NUMBER = 'NOT_A_POSITIVE_NUMBER',
  NOT_AN_UNSIGNED_BIGINT = 'NOT_AN_UNSIGNED_BIGINT',
}

const assertNotEmptyString = (value: any): string => {
  if (typeof value !== 'string' || value.length > 0) {
    throw ValidationErrors.NOT_A_NONEMPTY_STRING;
  }
  return value;
};

const assertPositiveNumber = (value: any): number => {
  if (typeof value !== 'number' || value <= 0) {
    throw ValidationErrors.NOT_A_POSITIVE_NUMBER;
  }
  return value;
};

const assertUnsignedBigInt = (value: any): bigint => {
  if (typeof value !== 'number' || value <= 0) {
    throw ValidationErrors.NOT_AN_UNSIGNED_BIGINT;
  }
  return BigInt(value);
};

//////////////////////////////////////
/// ETAG
//////////////////////////////////////

type WeakETag = `W/${string}`;
type ETag = WeakETag | string;

const WeakETagRegex = /W\/"(\d+.*)"/;

const enum ETagErrors {
  WRONG_WEAK_ETAG_FORMAT = 'WRONG_WEAK_ETAG_FORMAT',
  MISSING_IF_MATCH_HEADER = 'MISSING_IF_MATCH_HEADER',
}

const isWeakETag = (etag: ETag): etag is WeakETag => {
  return WeakETagRegex.test(etag);
};

const getWeakETagValue = (etag: ETag): WeakETag => {
  return WeakETagRegex.exec(etag)![1] as WeakETag;
};

const toWeakETag = (value: any): WeakETag => {
  return `W/"${value}"`;
};

const getETagFromIfMatch = (request: Request): ETag => {
  const etag = request.headers['if-match'];

  if (etag === undefined) {
    throw ETagErrors.MISSING_IF_MATCH_HEADER;
  }

  return etag;
};

const getWeakETagValueFromIfMatch = (request: Request): WeakETag => {
  const etag = getETagFromIfMatch(request);

  if (!isWeakETag(etag)) {
    throw ETagErrors.WRONG_WEAK_ETAG_FORMAT;
  }

  return getWeakETagValue(etag);
};

const getExpectedRevisionFromETag = (request: Request): bigint =>
  assertUnsignedBigInt(getWeakETagValueFromIfMatch(request));

//////////////////////////////////////
/// HTTP Helpers
//////////////////////////////////////

const sendCreated = (
  response: Response,
  createdId: string,
  urlPrefix?: string
): void => {
  response.setHeader(
    'Location',
    `${urlPrefix ?? response.req.url}/${createdId}`
  );
  response.status(201).json({ id: createdId });
};

//////////////////////////////////////
/// Routes
//////////////////////////////////////

const router = Router();

// Open Shopping cart
router.post(
  '/clients/:clientId/shopping-carts/',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const shoppingCartId = uuid();
      const streamName = toShoppingCartStreamName(shoppingCartId);

      const result = await create(getEventStore(), openShoppingCart)(
        streamName,
        {
          shoppingCartId,
          clientId: assertNotEmptyString(request.body.clientId),
        }
      );

      response.set('ETag', toWeakETag(result.nextExpectedRevision));
      sendCreated(response, shoppingCartId);
    } catch (error) {
      next(error);
    }
  }
);

// TODO: Add Pattern matching here

// Add Product Item
router.post(
  '/clients/:clientId/shopping-carts/:shoppingCartId/product-items',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const shoppingCartId = assertNotEmptyString(
        request.params.shoppingCartId
      );
      const streamName = toShoppingCartStreamName(shoppingCartId);
      const expectedRevision = getExpectedRevisionFromETag(request);

      const result = await update(
        getEventStore(),
        addProductItemToShoppingCart
      )(
        streamName,
        {
          shoppingCartId: assertNotEmptyString(request.params.shoppingCartId),
          productItem: {
            productId: assertNotEmptyString(request.body.productId),
            quantity: assertPositiveNumber(request.body.quantity),
          },
        },
        expectedRevision
      );

      response.set('ETag', toWeakETag(result.nextExpectedRevision));
      response.sendStatus(200);
    } catch (error) {
      next(error);
    }
  }
);

// Remove Product Item
router.delete(
  '/clients/:clientId/shopping-carts/:shoppingCartId/product-items',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const shoppingCartId = assertNotEmptyString(
        request.params.shoppingCartId
      );
      const streamName = toShoppingCartStreamName(shoppingCartId);
      const expectedRevision = getExpectedRevisionFromETag(request);

      const result = await update(
        getEventStore(),
        removeProductItemFromShoppingCart
      )(
        streamName,
        {
          shoppingCartId: assertNotEmptyString(request.params.shoppingCartId),
          productItem: {
            productId: assertNotEmptyString(request.body.productId),
            quantity: assertPositiveNumber(request.body.quantity),
          },
        },
        expectedRevision
      );

      response.set('ETag', toWeakETag(result.nextExpectedRevision));
      response.sendStatus(200);
    } catch (error) {
      next(error);
    }
  }
);

// Confirm Shopping Cart
router.put(
  '/clients/:clientId/shopping-carts/:shoppingCartId',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const shoppingCartId = assertNotEmptyString(
        request.params.shoppingCartId
      );
      const streamName = toShoppingCartStreamName(shoppingCartId);
      const expectedRevision = getExpectedRevisionFromETag(request);

      const result = await update(getEventStore(), confirmShoppingCart)(
        streamName,
        {
          shoppingCartId: assertNotEmptyString(request.params.shoppingCartId),
        },
        expectedRevision
      );

      response.set('ETag', toWeakETag(result.nextExpectedRevision));
      response.sendStatus(200);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/clients/:clientId/shopping-carts/:shoppingCartId',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const collection = await getShoppingCartsCollection();

      const result = await collection.findOne({
        shoppingCartId: assertNotEmptyString(request.params.shoppingCartId),
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
  }
);

//////////////////////////////////////
/// API
//////////////////////////////////////

const startAPI = (router: Router) => {
  const app: Application = express();

  app.set('etag', false);
  app.use(express.json());
  app.use(
    express.urlencoded({
      extended: true,
    })
  );
  app.use(router);

  const server = http.createServer(app);

  server.listen(5000);

  server.on('listening', () => {
    console.info('server up listening');
  });
};

startAPI(router);

//////////////////////////////////////
/// MongoDB
//////////////////////////////////////

let mongoClient: MongoClient;

const getMongoDB = async (connectionString?: string): Promise<MongoClient> => {
  if (!mongoClient) {
    mongoClient = new MongoClient(
      connectionString ?? 'mongodb://localhost:27017/'
    );
    await mongoClient.connect();
  }

  return mongoClient;
};

type ExecuteOnMongoDBOptions =
  | {
      collectionName: string;
      databaseName?: string;
    }
  | string;

const getMongoCollection = async <Document>(
  options: ExecuteOnMongoDBOptions
): Promise<Collection<Document>> => {
  const mongo = await getMongoDB();

  const { databaseName, collectionName } =
    typeof options !== 'string'
      ? options
      : { databaseName: undefined, collectionName: options };

  const db = mongo.db(databaseName);
  return db.collection<Document>(collectionName);
};

const toObjectId = (id: string) => id as unknown as ObjectId;

const enum MongoDBErrors {
  FAILED_TO_UPDATE_DOCUMENT = 'FAILED_TO_UPDATE_DOCUMENT',
  DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND',
}

const assertUpdated = async (
  update: () => Promise<UpdateResult>
): Promise<UpdateResult> => {
  const result = await update();

  if (result.modifiedCount === 0) {
    throw MongoDBErrors.FAILED_TO_UPDATE_DOCUMENT;
  }

  return result;
};

const assertFound = async <T>(find: () => Promise<T | null>): Promise<T> => {
  const result = await find();

  if (result === null) {
    throw MongoDBErrors.DOCUMENT_NOT_FOUND;
  }

  return result;
};

type RetryOptions = Readonly<{
  maxRetries?: number;
  delay?: number;
  shouldRetry?: (error: any) => boolean;
}>;

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 5,
  delay: 100,
  shouldRetry: () => true,
};

const sleep = async (timeout: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, timeout));
};

const retryPromise = async <T = never>(
  callback: () => Promise<T>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<T> => {
  let retryCount = 0;
  const { maxRetries, delay, shouldRetry } = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  do {
    try {
      return await callback();
    } catch (error) {
      if (!shouldRetry(error) || retryCount == maxRetries) {
        console.error(`[retry] Exceeded max retry count, throwing: ${error}`);
        throw error;
      }

      const sleepTime = Math.pow(2, retryCount) * delay + Math.random() * delay;

      console.warn(
        `[retry] Retrying (number: ${
          retryCount + 1
        }, delay: ${sleepTime}): ${error}`
      );

      await sleep(sleepTime);
      retryCount++;
    }
  } while (true);
};

const retryIfNotFound = <T>(
  find: () => Promise<T | null>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<T> => {
  return retryPromise(() => assertFound(find), options);
};

const retryIfNotUpdated = (
  update: () => Promise<UpdateResult>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<UpdateResult> => {
  return retryPromise(() => assertUpdated(update), options);
};

//////////////////////////////////////
/// MongoDB Checkpointing
//////////////////////////////////////

const getCheckpointsCollection = () =>
  getMongoCollection<Checkpoint>('checkpoints');

const loadCheckPointFromCollection = async (subscriptionId: string) => {
  const checkpoints = await getCheckpointsCollection();

  const checkpoint = await checkpoints.findOne({
    _id: toObjectId(subscriptionId),
  });

  return checkpoint != null ? BigInt(checkpoint.position) : undefined;
};

const storeCheckpointInCollection =
  (handle: EventHandler) => async (event: SubscriptionResolvedEvent) => {
    await handle(event);
    const checkpoints = await getCheckpointsCollection();

    await checkpoints.updateOne(
      {
        _id: toObjectId(event.subscriptionId),
      },
      {
        $set: {
          position: event.commitPosition!.toString(),
        },
      },
      {
        upsert: true,
      }
    );
  };

//////////////////////////////////////
/// Subscriptions
//////////////////////////////////////

type SubscriptionResolvedEvent = AllStreamResolvedEvent & {
  subscriptionId: string;
};

type Checkpoint = { position: string };

type EventHandler = (event: SubscriptionResolvedEvent) => Promise<void>;

const SubscriptionToAll =
  (
    eventStore: EventStoreDBClient,
    loadCheckpoint: (subscriptionId: string) => Promise<bigint | undefined>
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

    subscription
      .on('data', async (resolvedEvent: AllStreamResolvedEvent) => {
        for (const handler of handlers) {
          await handler({ ...resolvedEvent, subscriptionId });
        }
      })
      .on('error', async (error) => {
        console.error(`Received error: ${error ?? 'UNEXPECTED ERROR'}.`);
      })
      .on('close', async () => {
        console.info(`Subscription closed.`);
      })
      .on('end', () => {
        console.info(`Received 'end' event. Stopping subscription.`);
      });
    return subscription;
  };

const SubscriptionToAllWithMongoCheckpoints = SubscriptionToAll(
  getEventStore(),
  loadCheckPointFromCollection
);

//////////////////////////////////////
/// ShoppingCartDetails projection
//////////////////////////////////////

const getShoppingCartsCollection = () =>
  getMongoCollection<ShoppingCartItem>('shoppingCartDetails');

type ShoppingCartItem = Readonly<{
  shoppingCartId: string;
  clientId: string;
  status: string;
  productItems: ProductItem[];
  revision: number;
}>;

const projectToShoppingCartItem = (
  resolvedEvent: SubscriptionResolvedEvent
): Promise<void> => {
  if (
    resolvedEvent.event === undefined ||
    !isCashierShoppingCartEvent(resolvedEvent.event)
  )
    return Promise.resolve();

  const { event } = resolvedEvent;
  const streamRevision = Number(event.revision);

  switch (event.type) {
    case 'shopping-cart-opened':
      return projectShoppingCartOpened(event, streamRevision);
    case 'product-item-added-to-shopping-cart':
      return projectProductItemAddedToShoppingCart(event, streamRevision);
    case 'product-item-removed-from-shopping-cart':
      return projectProductItemRemovedFromShoppingCart(event, streamRevision);
    case 'shopping-cart-confirmed':
      return projectShoppingCartConfirmed(event, streamRevision);
    default: {
      const _: never = event;
      throw ShoppingCartErrors.UNKNOWN_EVENT_TYPE;
    }
  }
};

const projectShoppingCartOpened = async (
  event: ShoppingCartOpened,
  streamRevision: number
): Promise<void> => {
  const shoppingCarts = await getShoppingCartsCollection();

  await shoppingCarts.insertOne({
    shoppingCartId: event.data.shoppingCartId,
    clientId: event.data.clientId,
    status: ShoppingCartStatus.Opened.toString(),
    productItems: [],
    revision: streamRevision,
  });
};

const projectProductItemAddedToShoppingCart = async (
  event: ProductItemAddedToShoppingCart,
  streamRevision: number
): Promise<void> => {
  const shoppingCarts = await getShoppingCartsCollection();
  const lastRevision = streamRevision - 1;

  const { productItems, revision } = await retryIfNotFound(() =>
    shoppingCarts.findOne(
      {
        _id: toObjectId(event.data.shoppingCartId),
        revision: { $gte: lastRevision },
      },
      {
        projection: { productItems: 1, revision: 1 },
      }
    )
  );

  if (revision > lastRevision) {
    return;
  }

  retryIfNotUpdated(() =>
    shoppingCarts.updateOne(
      {
        _id: toObjectId(event.data.shoppingCartId),
        revision: lastRevision,
      },
      {
        $set: {
          productItems: addProductItem(productItems, event.data.productItem),
          revision: streamRevision,
        },
      },
      { upsert: false }
    )
  );
};

const projectProductItemRemovedFromShoppingCart = async (
  event: ProductItemRemovedFromShoppingCart,
  streamRevision: number
): Promise<void> => {
  const shoppingCarts = await getShoppingCartsCollection();
  const lastRevision = streamRevision - 1;

  const { productItems, revision } = await retryIfNotFound(() =>
    shoppingCarts.findOne(
      {
        _id: toObjectId(event.data.shoppingCartId),
        revision: { $gte: lastRevision },
      },
      {
        projection: { productItems: 1, revision: 1 },
      }
    )
  );
  if (revision > lastRevision) {
    return;
  }

  await retryIfNotUpdated(() =>
    shoppingCarts.updateOne(
      {
        _id: toObjectId(event.data.shoppingCartId),
        revision: lastRevision,
      },
      {
        $set: {
          productItems: removeProductItem(productItems, event.data.productItem),
          revision: streamRevision,
        },
      },
      { upsert: false }
    )
  );
};

const projectShoppingCartConfirmed = async (
  event: ShoppingCartConfirmed,
  streamRevision: number
): Promise<void> => {
  const shoppingCarts = await getShoppingCartsCollection();

  const lastRevision = streamRevision - 1;

  const { revision } = await retryIfNotFound(() =>
    shoppingCarts.findOne(
      {
        _id: toObjectId(event.data.shoppingCartId),
        revision: { $gte: lastRevision },
      },
      { projection: { revision: 1 } }
    )
  );

  if (revision > lastRevision) {
    return;
  }

  await shoppingCarts.updateOne(
    {
      _id: toObjectId(event.data.shoppingCartId),
      revision: lastRevision,
    },
    {
      $set: {
        confirmedAt: event.data.confirmedAt,
        status: ShoppingCartStatus.Confirmed.toString(),
        revision: streamRevision,
      },
    },
    { upsert: false }
  );
};

//////////////////////////////////////
/// Run
//////////////////////////////////////

(async () => {
  const enum ProductsIds {
    T_SHIRT = 'team-building-excercise-2022',
    SHOES = 'air-jordan',
  }

  const clientId = 'client-123';
  const shoppingCartId = `cart-${uuid()}`;
  const events: ShoppingCartEvent[] = [
    {
      type: 'shopping-cart-opened',
      data: {
        shoppingCartId,
        clientId,
        openedAt: new Date().toJSON(),
      },
    },
    {
      type: 'product-item-added-to-shopping-cart',
      data: {
        shoppingCartId,
        productItem: {
          productId: ProductsIds.SHOES,
          quantity: 1,
        },
      },
    },
    {
      type: 'product-item-added-to-shopping-cart',
      data: {
        shoppingCartId,
        productItem: {
          productId: ProductsIds.T_SHIRT,
          quantity: 3,
        },
      },
    },
    {
      type: 'product-item-removed-from-shopping-cart',
      data: {
        shoppingCartId,
        productItem: {
          productId: ProductsIds.SHOES,
          quantity: 1,
        },
      },
    },
    {
      type: 'shopping-cart-confirmed',
      data: {
        shoppingCartId,
        confirmedAt: new Date().toJSON(),
      },
    },
  ];

  const streamName = `shopping_cart-${shoppingCartId}`;

  const eventStore = EventStoreDBClient.connectionString(
    'esdb://localhost:2113?tls=false'
  );

  await SubscriptionToAllWithMongoCheckpoints('sub_shopping_carts', [
    storeCheckpointInCollection(projectToShoppingCartItem),
  ]);

  await eventStore.appendToStream<ShoppingCartEvent>(
    streamName,
    events.map((e) => jsonEvent<ShoppingCartEvent>(e))
  );

  const shoppingCartStream =
    eventStore.readStream<ShoppingCartEvent>(streamName);

  const cart = await getShoppingCart(shoppingCartStream);

  console.log(cart);
})();
