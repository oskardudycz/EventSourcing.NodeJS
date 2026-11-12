import type { Query } from '#core/queries';
import type { Result } from '#core/primitives';
import { failure, success } from '#core/primitives';
import { executeOnMongoDB } from '#core/mongoDB';
import type { SHIFT_DOES_NOT_EXIST } from '../cashierShift';
import type { CurrentCashierShiftDetails } from './currentCashierShiftDetails';

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
