import { Query } from '#core/queries';
import { failure, Result, success } from '#core/primitives';
import { getSingleFromMongoDB } from '#core/mongoDB';
import { SHIFT_DOES_NOT_EXIST } from '../shoppingCart';

export type GetCurrentShoppingCartDetails = Query<
  'get-current-shopping-cart-details',
  {
    cashRegisterId: string;
  }
>;

export type ProductItem = Readonly<{
  productId: string;
  quantity: number;
}>;

export type CurrentShoppingCartDetails = Readonly<{
  id: string;
  clientId: string;
  status: string;
  productItems: ProductItem[];
  openedAt: Date;
  confirmedAt?: Date;
  revision: string;
}>;

const CurrentShoppingCartDetails = 'currentShoppingCartDetails';

export async function handleGetCurrentShoppingCartDetails(
  query: GetCurrentShoppingCartDetails
): Promise<Result<CurrentShoppingCartDetails, SHIFT_DOES_NOT_EXIST>> {
  const result = await getSingleFromMongoDB<CurrentShoppingCartDetails>(
    CurrentShoppingCartDetails,
    (collection) =>
      collection.findOne({
        cashRegisterId: query.data.cashRegisterId,
      })
  );

  if (result === undefined) {
    return failure('SHIFT_DOES_NOT_EXIST');
  }

  return success(result);
}
