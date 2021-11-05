import { Query } from '#core/queries';
import { failure, Result, success } from '#core/primitives';
import { getSingleFromMongoDB } from '#core/mongoDB';
import { SHIFT_DOES_NOT_EXIST } from '../shoppingCart';
import { CurrentShoppingCartDetails, CURRENT_SHOPPING_CART_DETAILS } from '.';

export type GetCurrentShoppingCartDetails = Query<
  'get-current-shopping-cart-details',
  {
    shoppingCartId: string;
  }
>;

export async function handleGetCurrentShoppingCartDetails(
  query: GetCurrentShoppingCartDetails
): Promise<Result<CurrentShoppingCartDetails, SHIFT_DOES_NOT_EXIST>> {
  const result = await getSingleFromMongoDB<CurrentShoppingCartDetails>(
    CURRENT_SHOPPING_CART_DETAILS,
    (collection) =>
      collection.findOne({
        shoppingCartId: query.data.shoppingCartId,
      })
  );

  if (result === undefined) {
    return failure('SHIFT_DOES_NOT_EXIST');
  }

  return success(result);
}
