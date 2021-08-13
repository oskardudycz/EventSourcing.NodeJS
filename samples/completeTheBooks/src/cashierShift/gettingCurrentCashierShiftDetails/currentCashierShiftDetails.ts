import { CashierShiftStatus } from '../cashierShift';

export const CurrentCashierShiftDetailsCollection =
  'currentCashierShiftDetails';

export type CurrentCashierShiftDetails = Readonly<{
  number: number;

  /**
   * Cash amount in the drawer declared during opening the shift
   */
  startAmount: number;

  /**
   *
   * The amount of money in a cash register or till before and after a person's shift
   * @type {number}
   */
  float: number;

  /**
   * Cash amount in the drawer declared during closing the shift
   */
  declaredTender?: number;

  overageAmount?: number;

  shortageAmount?: number;

  /**
   * The area where a cashier works
   */
  cashRegisterId: string;

  /**
   * Cashier working on the cash register
   */
  cashierId: string;

  /**
   * Shift Status (Started or Finished)
   */
  status: CashierShiftStatus;

  startedAt: Date;

  finishedAt?: Date;

  revision: string;
}>;
