import { Mapper } from '#core/mapping';
import { QueryHandler } from '#core/queries';
import { ShoppingCartRepository } from '../../../infrastructure/shoppingCarts/shoppingCartRepository';
import { ShoppingCartModel } from '../../../models/shoppingCarts/shoppingCart';
import { CustomerShoppingHistoryItem } from '../queries/customerShoppingHistoryItem';
import { GetCustomerShoppingHistory } from '../queries/getCustomerShoppingHistory';

export class GetCustomerShoppingHistoryHandler
  implements
    QueryHandler<GetCustomerShoppingHistory, CustomerShoppingHistoryItem[]>
{
  constructor(
    private repository: ShoppingCartRepository,
    private mapper: Mapper<CustomerShoppingHistoryItem, ShoppingCartModel>,
  ) {}

  async handle(
    query: GetCustomerShoppingHistory,
  ): Promise<CustomerShoppingHistoryItem[]> {
    const items = await this.repository.findAllByCustomerId(query.customerId);

    return items.map((item) => this.mapper.toAggregate(item));
  }
}
