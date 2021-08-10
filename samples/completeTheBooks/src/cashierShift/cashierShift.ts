import { ShiftOpened } from './openingShift';
import { TransactionRegistered } from './registeringTransaction';
import { ShiftClosed } from './closingShift';
import { aggregateStream } from '#core/streams';
import { isNotEmptyString, isPositiveNumber } from '#core/validation';

/**
 * System used to key in purchases; also makes mathematical calculations and records payments
 * See more: https://www.englishclub.com/english-for-work/cashier-vocabulary.htm
 */
export type CashierShift = Readonly<{
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
}>;

export type NotInitiatedCashierShift = Readonly<{
  cashRegisterId: string;
}>;

export enum CashierShiftStatus {
  Opened = 'Opened',
  Closed = 'Finished',
}

export type CashierShiftEvent =
  | ShiftOpened
  | TransactionRegistered
  | ShiftClosed;

export function when(
  currentState: Partial<NotInitiatedCashierShift | CashierShift>,
  event: CashierShiftEvent
): Partial<NotInitiatedCashierShift | CashierShift> {
  switch (event.type) {
    case 'shift-opened':
      return {
        ...currentState,
        number: event.data.shiftNumber,
        cashierId: event.data.cashierId,
        status: CashierShiftStatus.Opened,
        float: event.data.declaredStartAmount,
        startAmount: event.data.declaredStartAmount,
      };
    case 'transaction-registered':
      const currentFloat = isCashierShift(currentState)
        ? currentState.float
        : 0;
      return {
        ...currentState,
        float: currentFloat + event.data.amount,
      };
    case 'shift-closed':
      return {
        ...currentState,
        finishedAt: event.data.finishedAt,
        status: CashierShiftStatus.Closed,
        float: event.data.declaredTender,
        overageAmount: event.data.overageAmount,
        shortageAmount: event.data.shortageAmount,
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
    isPositiveNumber(cashierShift.number) &&
    isPositiveNumber(cashierShift.float) &&
    isNotEmptyString(cashierShift.cashierId) &&
    isNotEmptyString(cashierShift.cashRegisterId) &&
    isNotEmptyString(cashierShift.status) &&
    ['Started', 'Finished'].includes(cashierShift.status!)
  );
}

export function isNotInitiatedCashierShift(
  cashierShift: CashierShift | NotInitiatedCashierShift
): cashierShift is NotInitiatedCashierShift {
  return (
    cashierShift !== undefined &&
    !isCashierShift(cashierShift) &&
    isNotEmptyString(cashierShift.cashRegisterId)
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

export function getCurrentCashierShiftStreamName(cashRegisterId: string) {
  return `cashiershift-cr_${cashRegisterId}_cs_current`;
}

export function getCashierShiftFrom(
  events: CashierShiftEvent[]
): CashierShift | NotInitiatedCashierShift {
  return aggregateStream(events, when, isCashierShift);
}

export type SHIFT_ALREADY_INITIALIZED = 'SHIFT_ALREADY_INITIALIZED';
export type SHIFT_NOT_INITIALIZED = 'SHIFT_NOT_INITIALIZED';
export type SHIFT_NOT_OPENED = 'SHIFT_NOT_OPENED';
export type SHIFT_ALREADY_OPENED = 'SHIFT_ALREADY_OPENED';
export type SHIFT_ALREADY_CLOSED = 'SHIFT_ALREADY_CLOSED';
