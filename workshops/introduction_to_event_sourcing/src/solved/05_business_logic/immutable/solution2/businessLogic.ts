//////////////////////////////////////
/// Commands
//////////////////////////////////////

import {
  EventStore,
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
    throw ShoppingCartErrors.PRODUCT_ITEM_NOT_FOUND;
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
          openedAt: command.now,
        },
      };
    }

    case 'AddProductItemToShoppingCart': {
      if (shoppingCart.status !== ShoppingCartStatus.Pending) {
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
      if (shoppingCart.status !== ShoppingCartStatus.Pending) {
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
      if (shoppingCart.status !== ShoppingCartStatus.Pending) {
        throw ShoppingCartErrors.CART_IS_ALREADY_CLOSED;
      }

      if (shoppingCart.productItems.length === 0) {
        throw ShoppingCartErrors.CART_IS_EMPTY;
      }

      return {
        type: 'ShoppingCartConfirmed',
        data: {
          shoppingCartId: command.shoppingCartId,
          confirmedAt: command.now,
        },
      };
    }

    case 'CancelShoppingCart': {
      if (shoppingCart.status !== ShoppingCartStatus.Pending) {
        throw ShoppingCartErrors.CART_IS_ALREADY_CLOSED;
      }

      return {
        type: 'ShoppingCartCanceled',
        data: {
          shoppingCartId: command.shoppingCartId,
          canceledAt: command.now,
        },
      };
    }
    default: {
      const _: never = command;
      throw ShoppingCartErrors.UNKNOWN_COMMAND_TYPE;
    }
  }
};

export type Event<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>
> = Readonly<{
  type: Readonly<EventType>;
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
  EventType extends Event
> = {
  decide: (command: CommandType, state: State) => EventType | EventType[];
  evolve: (currentState: State, event: EventType) => State;
  getInitialState: () => State;
};

export const CommandHandler =
  <State, CommandType extends Command, EventType extends Event>({
    decide,
    evolve,
    getInitialState,
  }: Decider<State, CommandType, EventType>) =>
  (eventStore: EventStore, streamId: string, command: CommandType): void => {
    const events = eventStore.readStream<EventType>(streamId);

    const state = events.reduce<State>(evolve, getInitialState());

    const result = decide(command, state);

    eventStore.appendEvents(
      streamId,
      Array.isArray(result) ? result : [result]
    );
  };
