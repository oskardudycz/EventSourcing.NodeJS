import { Query } from '#core/queries';
import { failure, Result, success } from '#core/primitives';
import { getMongoCollection, retryIfNotFound } from '#core/mongoDB';
import { SHIFT_DOES_NOT_EXIST } from '../shoppingCart';
import { ShoppingCartDetails, SHOPPING_CART_DETAILS } from '.';

export type GetShoppingCartDetails = Query<
  'get-shopping-cart-details',
  {
    shoppingCartId: string;
  }
>;

export async function getShoppingCartDetails(
  query: GetShoppingCartDetails
): Promise<Result<ShoppingCartDetails, SHIFT_DOES_NOT_EXIST>> {
  const collection = await getMongoCollection<ShoppingCartDetails>(
    SHOPPING_CART_DETAILS
  );

  const result = await retryIfNotFound(() =>
    collection.findOne({
      shoppingCartId: query.data.shoppingCartId,
    })
  );

  if (result === null) {
    return failure('SHIFT_DOES_NOT_EXIST');
  }

  return success(result);
}
