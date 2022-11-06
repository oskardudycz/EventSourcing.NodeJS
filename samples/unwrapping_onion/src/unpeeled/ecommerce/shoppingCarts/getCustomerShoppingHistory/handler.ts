import { Collection } from 'mongodb';
import { ShoppingCartModel } from '../storage/';

export const findAllByCustomerId = async (
  carts: Collection<ShoppingCartModel>,
  query: GetCustomerShoppingHistory
): Promise<CustomerShoppingHistoryItem[]> => {
  const result = await carts.find({ customerId: query.customerId }).toArray();

  return result.map((cart) => {
    return {
      customerId: cart.customerId,
      shoppingCartId: cart._id.toHexString(),
      status: cart.status,
      totalCount: cart.productItems.length,
    };
  });
};

export type GetCustomerShoppingHistory = {
  customerId: string;
};

export type CustomerShoppingHistoryItem = {
  customerId: string;
  shoppingCartId: string;
  status: string;
  totalCount: number;
};
