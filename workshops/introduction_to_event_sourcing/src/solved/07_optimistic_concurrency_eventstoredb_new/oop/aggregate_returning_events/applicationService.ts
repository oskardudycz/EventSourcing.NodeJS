import {
  AddProductItemToShoppingCart,
  CancelShoppingCart,
  ConfirmShoppingCart,
  OpenShoppingCart,
  RemoveProductItemFromShoppingCart,
} from './businessLogic';
import { Repository } from './core/repository';
import { ApplicationService } from './core/service';
import { ShoppingCart, ShoppingCartEvent } from './shoppingCart';

export class ShoppingCartService extends ApplicationService<
  ShoppingCart,
  ShoppingCartEvent
> {
  constructor(
    protected repository: Repository<ShoppingCart, ShoppingCartEvent>,
  ) {
    super(repository);
  }

  public open = (
    { data: { shoppingCartId, clientId, now } }: OpenShoppingCart,
    options?: { expectedRevision?: bigint | 'no_stream' },
  ) =>
    this.on(
      shoppingCartId,
      () => ShoppingCart.open(shoppingCartId, clientId, now),
      options,
    );

  public addProductItem = (
    { data: { shoppingCartId, productItem } }: AddProductItemToShoppingCart,
    options?: { expectedRevision?: bigint | 'no_stream' },
  ) =>
    this.on(
      shoppingCartId,
      (shoppingCart) => shoppingCart.addProductItem(productItem),
      options,
    );

  public removeProductItem = (
    {
      data: { shoppingCartId, productItem },
    }: RemoveProductItemFromShoppingCart,
    options?: { expectedRevision?: bigint | 'no_stream' },
  ) =>
    this.on(
      shoppingCartId,
      (shoppingCart) => shoppingCart.removeProductItem(productItem),
      options,
    );

  public confirm = (
    { data: { shoppingCartId, now } }: ConfirmShoppingCart,
    options?: { expectedRevision?: bigint | 'no_stream' },
  ) =>
    this.on(
      shoppingCartId,
      (shoppingCart) => shoppingCart.confirm(now),
      options,
    );

  public cancel = (
    { data: { shoppingCartId, now } }: CancelShoppingCart,
    options?: { expectedRevision?: bigint | 'no_stream' },
  ) =>
    this.on(
      shoppingCartId,
      (shoppingCart) => shoppingCart.cancel(now),
      options,
    );
}
