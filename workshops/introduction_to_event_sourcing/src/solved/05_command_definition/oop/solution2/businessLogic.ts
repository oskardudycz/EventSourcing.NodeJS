import { Event, EventStore } from './core';
import {
  PricedProductItem,
  ShoppingCart,
  ShoppingCartEvent,
} from './shoppingCart';

export interface Repository<Entity, StreamEvent extends Event> {
  find(id: string): Entity;
  store(id: string, ...events: StreamEvent[]): void;
}

export class EventStoreRepository<Entity, StreamEvent extends Event>
  implements Repository<Entity, StreamEvent>
{
  constructor(
    private eventStore: EventStore,
    private getInitialState: () => Entity,
    private evolve: (state: Entity, event: StreamEvent) => Entity,
  ) {}

  find = (id: string): Entity => {
    const events = this.eventStore.readStream<StreamEvent>(id);

    return events.reduce<Entity>(this.evolve, this.getInitialState());
  };

  store = (id: string, ...events: StreamEvent[]): void => {
    if (events.length === 0) return;

    this.eventStore.appendToStream(id, events);
  };
}

export abstract class ApplicationService<Entity, StreamEvent extends Event> {
  constructor(protected repository: Repository<Entity, StreamEvent>) {}

  protected on = (
    id: string,
    handle: (state: Entity) => StreamEvent | StreamEvent[],
  ) => {
    const aggregate = this.repository.find(id);

    const result = handle(aggregate);

    this.repository.store(id, ...(Array.isArray(result) ? result : [result]));
  };
}

export type OpenShoppingCart = {
  shoppingCartId: string;
  clientId: string;
  now: Date;
};

export type AddProductItemToShoppingCart = {
  shoppingCartId: string;
  productItem: PricedProductItem;
};

export type RemoveProductItemFromShoppingCart = {
  shoppingCartId: string;
  productItem: PricedProductItem;
};

export type ConfirmShoppingCart = {
  shoppingCartId: string;
  now: Date;
};

export type CancelShoppingCart = {
  shoppingCartId: string;
  now: Date;
};

export type ShoppingCartCommand =
  | OpenShoppingCart
  | AddProductItemToShoppingCart
  | RemoveProductItemFromShoppingCart
  | ConfirmShoppingCart
  | CancelShoppingCart;

export class ShoppingCartService extends ApplicationService<
  ShoppingCart,
  ShoppingCartEvent
> {
  constructor(
    protected repository: Repository<ShoppingCart, ShoppingCartEvent>,
  ) {
    super(repository);
  }

  public open = ({ shoppingCartId, clientId, now }: OpenShoppingCart) =>
    this.on(shoppingCartId, (shoppingCart) =>
      shoppingCart.open(shoppingCartId, clientId, now),
    );

  public addProductItem = ({
    shoppingCartId,
    productItem,
  }: AddProductItemToShoppingCart) =>
    this.on(shoppingCartId, (shoppingCart) =>
      shoppingCart.addProductItem(productItem),
    );

  public removeProductItem = ({
    shoppingCartId,
    productItem,
  }: RemoveProductItemFromShoppingCart) =>
    this.on(shoppingCartId, (shoppingCart) =>
      shoppingCart.removeProductItem(productItem),
    );

  public confirm = ({ shoppingCartId, now }: ConfirmShoppingCart) =>
    this.on(shoppingCartId, (shoppingCart) => shoppingCart.confirm(now));

  public cancel = ({ shoppingCartId, now }: CancelShoppingCart) =>
    this.on(shoppingCartId, (shoppingCart) => shoppingCart.cancel(now));
}
