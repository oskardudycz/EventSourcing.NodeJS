import { Mapper } from '#core/mapping';
import { ObjectId } from 'mongodb';
import ShoppingCart from '../../domain/aggregates/shoppingCarts';
import { ShoppingCartModel } from '../../models/shoppingCarts/shoppingCart';

export default class ShoppingCartMapper
  implements Mapper<ShoppingCart, ShoppingCartModel>
{
  toModel(aggregate: ShoppingCart): ShoppingCartModel {
    return new ShoppingCartModel(
      new ObjectId(aggregate.id),
      aggregate.clientId,
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
      model.clientId,
      model.status,
      model.productItems,
      model.openedAt,
      model.confirmedAt,
      model.revision
    );
  }
}
