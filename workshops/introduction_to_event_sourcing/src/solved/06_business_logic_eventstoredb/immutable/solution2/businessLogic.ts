//////////////////////////////////////
/// Commands
//////////////////////////////////////

import {
  EventStoreDBClient,
  jsonEvent,
  StreamNotFoundError,
} from '@eventstore/db-client';
import {
  PricedProductItem,
  ShoppingCart,
  ShoppingCartEvent,
  ShoppingCartStatus,
} from './businessLogic.solved.test';

export type ShoppingCartCommand =
  | {
      type: 'OpenShoppingCart';
      data: {
        shoppingCartId: string;
        clientId: string;
        now: Date;
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
        now: Date;
      };
    }
  | {
      type: 'CancelShoppingCart';
      data: {
        shoppingCartId: string;
        now: Date;
      };
    };

//////////////////////////////////////
/// Decide
//////////////////////////////////////

export const enum ShoppingCartErrors {
  CART_ALREADY_EXISTS = 'CART_ALREADY_EXISTS',
  CART_IS_ALREADY_CLOSED = 'CART_IS_ALREADY_CLOSED',
  PRODUCT_ITEM_NOT_FOUND = 'PRODUCT_ITEM_NOT_FOUND',
  CART_IS_EMPTY = 'CART_IS_EMPTY',
  UNKNOWN_EVENT_TYPE = 'UNKNOWN_EVENT_TYPE',
  UNKNOWN_COMMAND_TYPE = 'UNKNOWN_COMMAND_TYPE',
}

export const assertProductItemExists = (
  productItems: PricedProductItem[],
  { productId, quantity, unitPrice }: PricedProductItem
): void => {
  const currentQuantity =
    productItems.find(
      (p) => p.productId === productId && p.unitPrice == unitPrice
    )?.quantity ?? 0;

  if (currentQuantity < quantity) {
    throw new Error(ShoppingCartErrors.PRODUCT_ITEM_NOT_FOUND);
  }
};

export const decide = (
  { type, data: command }: ShoppingCartCommand,
  shoppingCart: ShoppingCart
): ShoppingCartEvent | ShoppingCartEvent[] => {
  switch (type) {
    case 'OpenShoppingCart': {
      return {
        type: 'ShoppingCartOpened',
        data: {
          shoppingCartId: command.shoppingCartId,
          clientId: command.clientId,
          openedAt: command.now.toISOString(),
        },
      };
    }

    case 'AddProductItemToShoppingCart': {
      if (shoppingCart.status !== ShoppingCartStatus.Pending) {
        throw new Error(ShoppingCartErrors.CART_IS_ALREADY_CLOSED);
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
      if (shoppingCart.status !== ShoppingCartStatus.Pending) {
        throw new Error(ShoppingCartErrors.CART_IS_ALREADY_CLOSED);
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
      if (shoppingCart.status !== ShoppingCartStatus.Pending) {
        throw new Error(ShoppingCartErrors.CART_IS_ALREADY_CLOSED);
      }

      if (shoppingCart.productItems.length === 0) {
        throw new Error(ShoppingCartErrors.CART_IS_EMPTY);
      }

      return {
        type: 'ShoppingCartConfirmed',
        data: {
          shoppingCartId: command.shoppingCartId,
          confirmedAt: command.now.toISOString(),
        },
      };
    }

    case 'CancelShoppingCart': {
      if (shoppingCart.status !== ShoppingCartStatus.Pending) {
        throw new Error(ShoppingCartErrors.CART_IS_ALREADY_CLOSED);
      }

      return {
        type: 'ShoppingCartCanceled',
        data: {
          shoppingCartId: command.shoppingCartId,
          canceledAt: command.now.toISOString(),
        },
      };
    }
    default: {
      const _: never = command;
      throw new Error(ShoppingCartErrors.UNKNOWN_COMMAND_TYPE);
    }
  }
};

export type Event<
  StreamEvent extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>
> = Readonly<{
  type: Readonly<StreamEvent>;
  data: Readonly<EventData>;
}>;

export type Command<
  CommandType extends string = string,
  CommandData extends Record<string, unknown> = Record<string, unknown>
> = Readonly<{
  type: Readonly<CommandType>;
  data: Readonly<CommandData>;
}>;

export type Decider<
  State,
  CommandType extends Command,
  StreamEvent extends Event
> = {
  decide: (command: CommandType, state: State) => StreamEvent | StreamEvent[];
  evolve: (currentState: State, event: StreamEvent) => State;
  getInitialState: () => State;
};

export const CommandHandler =
  <State, CommandType extends Command, StreamEvent extends Event>(
    {
      decide,
      evolve,
      getInitialState,
    }: Decider<State, CommandType, StreamEvent>,
    mapToStreamId: (id: string) => string
  ) =>
  async (eventStore: EventStoreDBClient, id: string, command: CommandType) => {
    const streamId = mapToStreamId(id);

    let state = getInitialState();

    try {
      const readResult = eventStore.readStream<StreamEvent>(streamId);

      for await (const { event } of readResult) {
        if (!event) continue;

        state = evolve(state, <StreamEvent>{
          type: event.type,
          data: event.data,
        });
      }
    } catch (error) {
      if (!(error instanceof StreamNotFoundError)) {
        throw error;
      }
    }

    const result = decide(command, state);

    const eventsToAppend = Array.isArray(result) ? result : [result];

    return eventStore.appendToStream(streamId, eventsToAppend.map(jsonEvent));
  };
