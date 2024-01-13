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

  public open = ({
    data: { shoppingCartId, clientId, now },
  }: OpenShoppingCart) =>
    this.on(shoppingCartId, () =>
      ShoppingCart.open(shoppingCartId, clientId, now),
    );

  public addProductItem = ({
    data: { shoppingCartId, productItem },
  }: AddProductItemToShoppingCart) =>
    this.on(shoppingCartId, (shoppingCart) =>
      shoppingCart.addProductItem(productItem),
    );

  public removeProductItem = ({
    data: { shoppingCartId, productItem },
  }: RemoveProductItemFromShoppingCart) =>
    this.on(shoppingCartId, (shoppingCart) =>
      shoppingCart.removeProductItem(productItem),
    );

  public confirm = ({ data: { shoppingCartId, now } }: ConfirmShoppingCart) =>
    this.on(shoppingCartId, (shoppingCart) => shoppingCart.confirm(now));

  public cancel = ({ data: { shoppingCartId, now } }: CancelShoppingCart) =>
    this.on(shoppingCartId, (shoppingCart) => shoppingCart.cancel(now));
}
