import { Mapper } from '#core/mapping';
import { ObjectId } from 'mongodb';
import { ShoppingCart } from 'src/unpeeled/ecommerce/shoppingCarts';
import { ShoppingCartModel } from '../../models/shoppingCart';

export class ShoppingCartMapper
  implements Mapper<ShoppingCart, ShoppingCartModel>
{
  toModel(aggregate: ShoppingCart): ShoppingCartModel {
    return new ShoppingCartModel(
      new ObjectId(aggregate.id),
      aggregate.customerId,
      aggregate.status,
      aggregate.productItems,
      aggregate.openedAt,
      aggregate.confirmedAt,
      aggregate.revision
    );
  }
  toAggregate(model: ShoppingCartModel): ShoppingCart {
    return new ShoppingCart(
      model._id.toHexString(),
      model.customerId,
      model.status,
      model.productItems,
      model.openedAt,
      model.confirmedAt,
      model.revision
    );
  }
}
