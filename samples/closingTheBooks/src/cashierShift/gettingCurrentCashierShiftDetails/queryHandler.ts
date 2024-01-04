import { Query } from '#core/queries';
import { failure, Result, success } from '#core/primitives';
import { executeOnMongoDB } from '#core/mongoDB';
import { SHIFT_DOES_NOT_EXIST } from '../cashierShift';
import { CurrentCashierShiftDetails } from './currentCashierShiftDetails';

export type GetCurrentCashierShiftDetails = Query<
  'get-cashier-shift-details',
  {
    cashRegisterId: string;
  }
>;

export async function handleGetCashierShift(
  query: GetCurrentCashierShiftDetails,
): Promise<Result<CurrentCashierShiftDetails, SHIFT_DOES_NOT_EXIST>> {
  const result = await executeOnMongoDB<
    CurrentCashierShiftDetails,
    CurrentCashierShiftDetails | null
  >({ collectionName: 'currentCashierShiftDetails' }, (currentCashierShifts) =>
    currentCashierShifts.findOne({
      cashRegisterId: query.data.cashRegisterId,
    }),
  );

  if (result === null) {
    return failure('SHIFT_DOES_NOT_EXIST');
  }

  return success(result);
}
