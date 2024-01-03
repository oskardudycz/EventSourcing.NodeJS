import { Mapper } from '#core/mapping';
import { ShoppingCartModel } from '../../../models/shoppingCarts/shoppingCart';
import { CustomerShoppingHistoryItem } from '../queries/customerShoppingHistoryItem';

export class CustomerShoppingHistoryMapper
  implements Mapper<CustomerShoppingHistoryItem, ShoppingCartModel>
{
  toModel(_aggregate: CustomerShoppingHistoryItem): ShoppingCartModel {
    throw Error('Not implemented');
  }
  toAggregate(model: ShoppingCartModel): CustomerShoppingHistoryItem {
    return new CustomerShoppingHistoryItem(
      model.customerId,
      model._id.toHexString(),
      model.status,
      model.productItems.length,
    );
  }
}
