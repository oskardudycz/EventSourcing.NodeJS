import {
  PricedProductItem,
  ShoppingCartEvent,
  ShoppingCartStatus,
} from './businessLogic.solved.test';
import { Event, EventStore } from './businessLogic.solved.test';

export abstract class Aggregate<E extends Event> {
  #uncommitedEvents: Event[] = [];

  abstract evolve(event: E): void;

  protected enqueue = (event: E) => {
    this.#uncommitedEvents = [...this.#uncommitedEvents, event];
  };

  dequeueUncommitedEvents = (): Event[] => {
    const events = this.#uncommitedEvents;

    this.#uncommitedEvents = [];

    return events;
  };
}

export interface Repository<Entity> {
  find(id: string): Entity;
  store(id: string, entity: Entity): void;
}

export class EventStoreRepository<
  Entity extends Aggregate<StreamEvent>,
  StreamEvent extends Event
> implements Repository<Entity>
{
  constructor(
    private eventStore: EventStore,
    private getInitialState: () => Entity
  ) {}

  find = (id: string): Entity => {
    const currentState = this.getInitialState();

    const events = this.eventStore.readStream<StreamEvent>(id);

    for (const event of events) {
      currentState.evolve(event);
    }

    return currentState;
  };

  store = (id: string, entity: Entity): void => {
    const events = entity.dequeueUncommitedEvents();

    if (events.length === 0) return;

    this.eventStore.appendToStream(id, events);
  };
}

export abstract class ApplicationService<Entity> {
  constructor(protected repository: Repository<Entity>) {}

  protected on = (id: string, handle: (state: Entity) => void) => {
    const aggregate = this.repository.find(id);

    handle(aggregate);

    this.repository.store(id, aggregate);
  };
}

export class ShoppingCart extends Aggregate<ShoppingCartEvent> {
  private constructor(
    private _id: string,
    private _clientId: string,
    private _status: ShoppingCartStatus,
    private _openedAt: Date,
    private _productItems: PricedProductItem[] = [],
    private _confirmedAt?: Date,
    private _canceledAt?: Date
  ) {
    super();
  }

  get id() {
    return this._id;
  }

  get clientId() {
    return this._clientId;
  }

  get status() {
    return this._status;
  }

  get openedAt() {
    return this._openedAt;
  }

  get productItems() {
    return this._productItems;
  }

  get confirmedAt() {
    return this._confirmedAt;
  }

  get canceledAt() {
    return this._canceledAt;
  }

  public static default = () =>
    new ShoppingCart(
      undefined!,
      undefined!,
      undefined!,
      undefined!,
      undefined,
      undefined,
      undefined
    );

  public open = (shoppingCartId: string, clientId: string, now: Date) => {
    this.enqueue({
      type: 'ShoppingCartOpened',
      data: { shoppingCartId, clientId, openedAt: now },
    });
  };

  public addProductItem = (productItem: PricedProductItem): void => {
    this.assertIsPending();

    this.enqueue({
      type: 'ProductItemAddedToShoppingCart',
      data: { productItem, shoppingCartId: this._id },
    });
  };

  public removeProductItem = (productItem: PricedProductItem): void => {
    this.assertIsPending();
    this.assertProductItemExists(productItem);

    this.enqueue({
      type: 'ProductItemRemovedFromShoppingCart',
      data: { productItem, shoppingCartId: this._id },
    });
  };

  public confirm = (now: Date): void => {
    this.assertIsPending();
    this.assertIsNotEmpty();

    this.enqueue({
      type: 'ShoppingCartConfirmed',
      data: { shoppingCartId: this._id, confirmedAt: now },
    });
  };

  public cancel = (now: Date): void => {
    this.assertIsPending();

    this.enqueue({
      type: 'ShoppingCartCanceled',
      data: { shoppingCartId: this._id, canceledAt: now },
    });
  };

  public evolve = ({ type, data: event }: ShoppingCartEvent): void => {
    switch (type) {
      case 'ShoppingCartOpened': {
        this._id = event.shoppingCartId;
        this._clientId = event.clientId;
        this._status = ShoppingCartStatus.Pending;
        this._openedAt = event.openedAt;
        this._productItems = [];
        return;
      }
      case 'ProductItemAddedToShoppingCart': {
        const {
          productItem: { productId, quantity, unitPrice },
        } = event;

        const currentProductItem = this._productItems.find(
          (pi) => pi.productId === productId && pi.unitPrice === unitPrice
        );

        if (currentProductItem) {
          currentProductItem.quantity += quantity;
        } else {
          this._productItems.push({ ...event.productItem });
        }
        return;
      }
      case 'ProductItemRemovedFromShoppingCart': {
        const {
          productItem: { productId, quantity, unitPrice },
        } = event;

        const currentProductItem = this._productItems.find(
          (pi) => pi.productId === productId && pi.unitPrice === unitPrice
        );

        if (!currentProductItem) {
          return;
        }

        currentProductItem.quantity -= quantity;

        if (currentProductItem.quantity <= 0) {
          this._productItems.splice(
            this._productItems.indexOf(currentProductItem),
            1
          );
        }
        return;
      }
      case 'ShoppingCartConfirmed': {
        this._status = ShoppingCartStatus.Confirmed;
        this._confirmedAt = event.confirmedAt;
        return;
      }
      case 'ShoppingCartCanceled': {
        this._status = ShoppingCartStatus.Canceled;
        this._canceledAt = event.canceledAt;
        return;
      }
      default: {
        const _: never = type;
        throw new Error(ShoppingCartErrors.UNKNOWN_EVENT_TYPE);
      }
    }
  };

  private assertIsPending = (): void => {
    if (this._status !== ShoppingCartStatus.Pending) {
      throw new Error(ShoppingCartErrors.CART_IS_ALREADY_CLOSED);
    }
  };

  private assertProductItemExists = ({
    productId,
    quantity,
    unitPrice,
  }: PricedProductItem): void => {
    const currentQuantity =
      this.productItems.find(
        (p) => p.productId === productId && p.unitPrice == unitPrice
      )?.quantity ?? 0;

    if (currentQuantity < quantity) {
      throw new Error(ShoppingCartErrors.PRODUCT_ITEM_NOT_FOUND);
    }
  };

  private assertIsNotEmpty = (): void => {
    if (this._productItems.length === 0) {
      throw new Error(ShoppingCartErrors.CART_IS_EMPTY);
    }
  };
}

export const enum ShoppingCartErrors {
  CART_IS_ALREADY_CLOSED = 'CART_IS_ALREADY_CLOSED',
  PRODUCT_ITEM_NOT_FOUND = 'PRODUCT_ITEM_NOT_FOUND',
  CART_IS_EMPTY = 'CART_IS_EMPTY',
  UNKNOWN_EVENT_TYPE = 'UNKNOWN_EVENT_TYPE',
  UNKNOWN_COMMAND_TYPE = 'UNKNOWN_COMMAND_TYPE',
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

export class ShoppingCartService extends ApplicationService<ShoppingCart> {
  constructor(protected repository: Repository<ShoppingCart>) {
    super(repository);
  }

  public open = ({ shoppingCartId, clientId, now }: OpenShoppingCart) =>
    this.on(shoppingCartId, (shoppingCart) =>
      shoppingCart.open(shoppingCartId, clientId, now)
    );

  public addProductItem = ({
    shoppingCartId,
    productItem,
  }: AddProductItemToShoppingCart) =>
    this.on(shoppingCartId, (shoppingCart) =>
      shoppingCart.addProductItem(productItem)
    );

  public removeProductItem = ({
    shoppingCartId,
    productItem,
  }: RemoveProductItemFromShoppingCart) =>
    this.on(shoppingCartId, (shoppingCart) =>
      shoppingCart.removeProductItem(productItem)
    );

  public confirm = ({ shoppingCartId, now }: ConfirmShoppingCart) =>
    this.on(shoppingCartId, (shoppingCart) => shoppingCart.confirm(now));

  public cancel = ({ shoppingCartId, now }: CancelShoppingCart) =>
    this.on(shoppingCartId, (shoppingCart) => shoppingCart.cancel(now));
}
