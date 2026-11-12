import type { Mapper } from '#core/mapping';
import type { QueryHandler } from '#core/queries';
import type { ShoppingCartRepository } from '../../../infrastructure/shoppingCarts/shoppingCartRepository';
import type { ShoppingCartModel } from '../../../models/shoppingCarts/shoppingCart';
import type { CustomerShoppingHistoryItem } from '../queries/customerShoppingHistoryItem';
import type { GetCustomerShoppingHistory } from '../queries/getCustomerShoppingHistory';

export class GetCustomerShoppingHistoryHandler implements QueryHandler<
  GetCustomerShoppingHistory,
  CustomerShoppingHistoryItem[]
> {
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
