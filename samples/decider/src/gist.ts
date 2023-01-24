import express, {
  Application,
  Router,
  NextFunction,
  Request,
  Response,
} from 'express';
import http from 'http';
import {
  EventStoreDBClient,
  jsonEvent,
  NO_STREAM,
  WrongExpectedVersionError,
} from '@eventstore/db-client';
import { v4 as uuid } from 'uuid';

//////////////////////////////////////
/// Events
//////////////////////////////////////

type ShoppingCartEvent =
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
        productItem: ProductItem;
      };
    }
  | {
      type: 'ProductItemRemovedFromShoppingCart';
      data: {
        shoppingCartId: string;
        productItem: ProductItem;
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
/// Entity/State
//////////////////////////////////////

type ShoppingCart =
  | {
      status: 'Empty';
    }
  | {
      status: 'Pending';
      id: string;
      clientId: string;
      productItems: ProductItem[];
    }
  | {
      status: 'Confirmed';
      id: string;
      clientId: string;
      productItems: ProductItem[];
      confirmedAt: Date;
    }
  | {
      status: 'Canceled';
      id: string;
      clientId: string;
      productItems: ProductItem[];
      canceledAt: Date;
    };

//////////////////////////////////////
/// Getting the state from events
//////////////////////////////////////

const evolve = (
  currentState: ShoppingCart,
  event: ShoppingCartEvent
): ShoppingCart => {
  switch (event.type) {
    case 'ShoppingCartOpened':
      if (currentState.status != 'Empty') return currentState;

      return {
        id: event.data.shoppingCartId,
        clientId: event.data.clientId,
        productItems: [],
        status: 'Pending',
      };
    case 'ProductItemAddedToShoppingCart':
      if (currentState.status != 'Pending') return currentState;

      return {
        ...currentState,
        productItems: addProductItem(
          currentState.productItems,
          event.data.productItem
        ),
      };
    case 'ProductItemRemovedFromShoppingCart':
      if (currentState.status != 'Pending') return currentState;

      return {
        ...currentState,
        productItems: removeProductItem(
          currentState.productItems,
          event.data.productItem
        ),
      };
    case 'ShoppingCartConfirmed':
      if (currentState.status != 'Pending') return currentState;

      return {
        ...currentState,
        status: 'Confirmed',
        confirmedAt: new Date(event.data.confirmedAt),
      };
    case 'ShoppingCartCanceled':
      if (currentState.status != 'Pending') return currentState;

      return {
        ...currentState,
        status: 'Canceled',
        canceledAt: new Date(event.data.canceledAt),
      };
    default: {
      const _: never = event;
      return currentState;
    }
  }
};

//////////////////////////////////////
/// Commands
//////////////////////////////////////

type ShoppingCartCommand =
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
        productItem: ProductItem;
      };
    }
  | {
      type: 'RemoveProductItemFromShoppingCart';
      data: {
        shoppingCartId: string;
        productItem: ProductItem;
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
/// Decide
//////////////////////////////////////

const decide = (
  { type, data: command }: ShoppingCartCommand,
  shoppingCart: ShoppingCart
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

const decider: Decider<ShoppingCart, ShoppingCartCommand, ShoppingCartEvent> = {
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

const enum ShoppingCartErrors {
  CART_ALREADY_EXISTS = 'CART_ALREADY_EXISTS',
  CART_IS_ALREADY_CLOSED = 'CART_IS_ALREADY_CLOSED',
  PRODUCT_ITEM_NOT_FOUND = 'PRODUCT_ITEM_NOT_FOUND',
  UNKNOWN_EVENT_TYPE = 'UNKNOWN_EVENT_TYPE',
  UNKNOWN_COMMAND_TYPE = 'UNKNOWN_COMMAND_TYPE',
}

const toShoppingCartStreamId = (shoppingCartId: string) =>
  `shopping_cart-${shoppingCartId}`;

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
/// Decider
//////////////////////////////////////

type Event<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>
> = Readonly<{
  type: Readonly<EventType>;
  data: Readonly<EventData>;
}>;

type Command<
  CommandType extends string = string,
  CommandData extends Record<string, unknown> = Record<string, unknown>
> = Readonly<{
  type: Readonly<CommandType>;
  data: Readonly<CommandData>;
}>;

export type Decider<
  State,
  CommandType extends Command,
  EventType extends Event
> = {
  decide: (command: CommandType, state: State) => EventType | EventType[];
  evolve: (currentState: State, event: EventType) => State;
  getInitialState: () => State;
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

const readStream = async <EventType extends Event>(
  eventStore: EventStoreDBClient,
  streamId: string
) => {
  const events = [];
  for await (const { event } of eventStore.readStream<EventType>(streamId)) {
    if (!event) continue;

    events.push(<EventType>{
      type: event.type,
      data: event.data,
    });
  }
  return events;
};

type AppendResult =
  | {
      nextExpectedRevision: ETag;
      successful: true;
    }
  | { expected: ETag; actual: ETag; successful: false };

const appendToStream = async (
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
      }
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
/// Command Handler
//////////////////////////////////////

const CommandHandler =
  <State, CommandType extends Command, EventType extends Event>(
    getEventStore: () => EventStoreDBClient,
    toStreamId: (recordId: string) => string,
    decider: Decider<State, CommandType, EventType>
  ) =>
  async (
    recordId: string,
    command: CommandType,
    eTag: ETag | undefined = undefined
  ): Promise<AppendResult> => {
    const eventStore = getEventStore();

    const streamId = toStreamId(recordId);
    const events = await readStream<EventType>(eventStore, streamId);

    const state = events.reduce<State>(
      decider.evolve,
      decider.getInitialState()
    );

    const newEvents = decider.decide(command, state);

    const toAppend = Array.isArray(newEvents) ? newEvents : [newEvents];

    return appendToStream(eventStore, streamId, eTag, ...toAppend);
  };

//////////////////////////////////////
/// HTTP Handler
//////////////////////////////////////

const HTTPHandler =
  <Command, RequestType extends Request = Request>(
    handleCommand: (
      recordId: string,
      command: Command,
      eTag?: ETag
    ) => Promise<AppendResult>
  ) =>
  (
    mapRequest: (
      request: RequestType,
      handler: (recordId: string, command: Command) => Promise<void>
    ) => Promise<void>
  ) =>
  async (request: RequestType, response: Response, next: NextFunction) => {
    try {
      await mapRequest(request, async (recordId, command) => {
        const result = await handleCommand(
          recordId,
          command,
          getETagFromIfMatch(request)
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

const router = Router();

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
    const shoppingCartId = uuid();

    return handle(shoppingCartId, {
      type: 'OpenShoppingCart',
      data: {
        shoppingCartId,
        clientId: assertNotEmptyString(request.params.clientId),
      },
    });
  })
);

type AddProductItemToShoppingCartRequest = Request<
  Partial<{ shoppingCartId: string }>,
  unknown,
  Partial<{ productId: number; quantity: number }>
>;

// Add Product Item
router.post(
  '/clients/:clientId/shopping-carts/:shoppingCartId/product-items',
  on((request: AddProductItemToShoppingCartRequest, handle) => {
    const shoppingCartId = assertNotEmptyString(request.params.shoppingCartId);

    return handle(shoppingCartId, {
      type: 'AddProductItemToShoppingCart',
      data: {
        shoppingCartId,
        productItem: {
          productId: assertNotEmptyString(request.body.productId),
          quantity: assertPositiveNumber(request.body.quantity),
        },
      },
    });
  })
);

export type RemoveProductItemFromShoppingCartRequest = Request<
  Partial<{ shoppingCartId: string }>,
  unknown,
  unknown,
  Partial<{ productId: number; quantity: number }>
>;

// Remove Product Item
router.post(
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
        },
      },
    });
  })
);

type ConfirmShoppingCartRequest = Request<Partial<{ shoppingCartId: string }>>;

// Confirm Shopping Cart
router.put(
  '/clients/:clientId/shopping-carts/:shoppingCartId',
  on((request: ConfirmShoppingCartRequest, handle) => {
    const shoppingCartId = assertNotEmptyString(request.params.shoppingCartId);

    return handle(shoppingCartId, {
      type: 'ConfirmShoppingCart',
      data: {
        shoppingCartId,
      },
    });
  })
);

type CancelShoppingCartRequest = Request<Partial<{ shoppingCartId: string }>>;

// Confirm Shopping Cart
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
  })
);

//////////////////////////////////////
/// Validation
//////////////////////////////////////

const enum ValidationErrors {
  NOT_A_NONEMPTY_STRING = 'NOT_A_NONEMPTY_STRING',
  NOT_A_POSITIVE_NUMBER = 'NOT_A_POSITIVE_NUMBER',
  NOT_AN_UNSIGNED_BIGINT = 'NOT_AN_UNSIGNED_BIGINT',
}

export const assertNotEmptyString = (value: unknown): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(ValidationErrors.NOT_A_NONEMPTY_STRING);
  }
  return value;
};

export const assertPositiveNumber = (value: unknown): number => {
  if (typeof value !== 'number' || value <= 0) {
    throw new Error(ValidationErrors.NOT_A_POSITIVE_NUMBER);
  }
  return value;
};

export const assertUnsignedBigInt = (value: string): bigint => {
  if (value === undefined) {
    throw new Error(ValidationErrors.NOT_AN_UNSIGNED_BIGINT);
  }

  const number = BigInt(value);
  if (number < 0) {
    throw new Error(ValidationErrors.NOT_AN_UNSIGNED_BIGINT);
  }
  return number;
};

//////////////////////////////////////
/// ETag
//////////////////////////////////////

type WeakETag = `W/${string}`;
type ETag = WeakETag | string;

const WeakETagRegex = /W\/"(\d+.*)"/;

const enum ETagErrors {
  WRONG_WEAK_ETAG_FORMAT = 'WRONG_WEAK_ETAG_FORMAT',
  MISSING_IF_MATCH_HEADER = 'MISSING_IF_MATCH_HEADER',
}

const getWeakETagValue = (etag: ETag): string => {
  const result = WeakETagRegex.exec(etag);
  if (result === null || result.length === 0) {
    throw ETagErrors.WRONG_WEAK_ETAG_FORMAT;
  }
  return result[1];
};

const toWeakETag = (value: number | bigint | string): WeakETag => {
  return `W/"${value}"`;
};

const getExpectedRevisionFromETag = (eTag: ETag): bigint =>
  assertUnsignedBigInt(getWeakETagValue(eTag));

//////////////////////////////////////
/// ETAG
//////////////////////////////////////

const getETagFromIfMatch = (request: Request): ETag => {
  const etag = request.headers['if-match'];

  if (etag === undefined) {
    throw ETagErrors.MISSING_IF_MATCH_HEADER;
  }

  return etag;
};

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

const mapToResponse = (
  response: Response,
  recordId: string,
  result: AppendResult,
  urlPrefix?: string
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
/// Application
//////////////////////////////////////

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
