//////////////////////////////////////
/// Events
//////////////////////////////////////
import {
  EventStoreDBClient,
  EventType,
  jsonEvent,
  JSONEventType,
  RecordedEvent,
  ResolvedEvent,
  StreamingRead,
} from '@eventstore/db-client';

// bare interface
interface ShoppingCartOpened {
  type: 'shopping-cart-opened';
  data: {
    shoppingCartId: string;
    clientId: string;
    openedAt: string;
  };
}

// using JSONEventType
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

enum ShoppingCartStatus {
  Opened = 1,
  Confirmed = 2,
  Cancelled = 4,
  Closed = Confirmed | Cancelled,
}

interface ShoppingCart {
  id: string;
  clientId: string;
  status: ShoppingCartStatus;
  productItems: ProductItems;
  openedAt: Date;
  confirmedAt?: Date;
}

const enum ShoppingCartErrors {
  OPENED_EXISTING_CART = 'OPENED_EXISTING_CART',
  CART_NOT_FOUND = 'CART_NOT_FOUND',
  PRODUCT_ITEM_NOT_FOUND = 'PRODUCT_ITEM_NOT_FOUND',
  UNKNOWN_EVENT_TYPE = 'UNKNOWN_EVENT_TYPE',
}

//////////////////////////////////////
/// Product Items
//////////////////////////////////////

interface ProductItem {
  productId: string;
  quantity: number;
}

type ProductItems = Map<string, ProductItem>;

const addProductItem = (
  inventory: ProductItems,
  { productId, quantity }: ProductItem
): ProductItems => {
  const current = inventory.get(productId);

  if (!current) {
    return inventory.set(productId, { productId, quantity });
  }

  return inventory.set(productId, {
    ...current,
    quantity: current.quantity + quantity,
  });
};

const removeProductItem = (
  inventory: ProductItems,
  { productId, quantity }: ProductItem
): ProductItems => {
  const current = inventory.get(productId);

  if (!current || current.quantity < quantity) {
    throw ShoppingCartErrors.PRODUCT_ITEM_NOT_FOUND;
  }

  if (current.quantity === quantity) {
    inventory.delete(productId);
    return inventory;
  }

  return inventory.set(productId, {
    ...current,
    quantity: current.quantity - quantity,
  });
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
        productItems: new Map(),
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

(async () => {
  const enum ProductsIds {
    T_SHIRT = 'team-building-excercise-2022',
    SHOES = 'air-jordan',
  }

  const clientId = 'client-123';
  const shoppingCartId = 'cart-456';
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

  const client = EventStoreDBClient.connectionString(
    'esdb://localhost:2113?tls=false'
  );

  await client.appendToStream<ShoppingCartEvent>(
    streamName,
    events.map((e) => jsonEvent<ShoppingCartEvent>(e))
  );

  const shoppingCartStream = client.readStream<ShoppingCartEvent>(streamName);

  const cart = await getShoppingCart(shoppingCartStream);

  console.log(cart);
})();
