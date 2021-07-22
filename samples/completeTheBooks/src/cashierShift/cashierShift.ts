import { ShiftStarted } from './startingShift';
import { TransactionRegistered } from './registeringTransaction';
import { ShiftEnded } from './endingShift';
import { aggregateStream } from '#core/streams';
import { isNotEmptyString, isPositiveNumber } from '#core/validation';

/**
 * System used to key in purchases; also makes mathematical calculations and records payments
 * See more: https://www.englishclub.com/english-for-work/cashier-vocabulary.htm
 */
export type CashierShift = Readonly<{
  id: string;
  /**
   *
   * The amount of money in a cash register or till before and after a person's shift
   * @type {number}
   */
  float: number;

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
}>;

export enum CashierShiftStatus {
  Started = 'Started',
  Finished = 'Finished',
}

export type CashierShiftEvent =
  | ShiftStarted
  | TransactionRegistered
  | ShiftEnded;

export function when(
  currentState: Partial<CashierShift>,
  event: CashierShiftEvent
): Partial<CashierShift> {
  switch (event.type) {
    case 'shift-started':
      return {
        ...currentState,
        cashierId: event.data.cashierId,
      };
    case 'transaction-registered':
      return {
        ...currentState,
        float: (currentState.float ?? 0) + event.data.amount,
      };
    case 'shift-ended':
      return {
        ...currentState,
        startedAt: event.data.finishedAt,
      };
    default:
      // Unexpected event type
      return {
        ...currentState,
      };
  }
}

export function isCashierShift(
  cashierShift: Partial<CashierShift>
): cashierShift is CashierShift {
  return (
    cashierShift !== undefined &&
    isNotEmptyString(cashierShift.id) &&
    isPositiveNumber(cashierShift.float) &&
    isNotEmptyString(cashierShift.cashierId) &&
    isNotEmptyString(cashierShift.cashRegisterId) &&
    isNotEmptyString(cashierShift.status) &&
    ['Started', 'Finished'].includes(cashierShift.status!)
  );
}

export function isCashierShiftEvent(event: any): event is CashierShiftEvent {
  switch (event.type) {
    case 'shift-started':
    case 'transaction-registered':
    case 'shift-ended':
      return true;
    default:
      return false;
  }
}

export function getCashierShiftStreamName(
  cashRegisterId: string,
  cashierShiftId: string
) {
  return `cashiershift-cr_${cashRegisterId}_cs_${cashierShiftId}`;
}

export function getActiveCashierShiftStreamName(cashRegisterId: string) {
  return `cashiershift-cr_${cashRegisterId}_cs_active`;
}

export function getCashierShiftFrom(events: CashierShiftEvent[]): CashierShift {
  return aggregateStream(events, when, isCashierShift);
}
