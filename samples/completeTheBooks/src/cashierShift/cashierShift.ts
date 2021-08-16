import { ShiftOpened } from './openingShift';
import { TransactionRegistered } from './registeringTransaction';
import { ShiftClosed } from './closingShift';
import { aggregateStream } from '#core/streams';
import { isNotEmptyString, isPositiveNumber } from '#core/validation';
import { CashRegisterShiftInitialized } from './initalizeCashRegisterShift/handler';
import { StreamEvent } from '#core/events';

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

  revision: bigint;
}>;

export type InitiatedCashierShift = Readonly<{
  cashRegisterId: string;
}>;

export enum CashierShiftStatus {
  Opened = 'Opened',
  Closed = 'Finished',
}

export type CashierShiftEvent =
  | CashRegisterShiftInitialized
  | ShiftOpened
  | TransactionRegistered
  | ShiftClosed;

export function when(
  currentState: Partial<InitiatedCashierShift | CashierShift>,
  streamEvent: StreamEvent<CashierShiftEvent>
): Partial<InitiatedCashierShift | CashierShift> {
  const { event, streamRevision } = streamEvent;
  switch (event.type) {
    case 'cash-register-shift-initialized':
      return {
        cashRegisterId: event.data.cashRegisterId,
        revision: streamRevision,
      };
    case 'shift-opened':
      return {
        ...currentState,
        number: event.data.shiftNumber,
        cashierId: event.data.cashierId,
        status: CashierShiftStatus.Opened,
        float: event.data.declaredStartAmount,
        startAmount: event.data.declaredStartAmount,
        startedAt: event.data.startedAt,
        revision: streamRevision,
      };
    case 'transaction-registered':
      const currentFloat = isCashierShift(currentState)
        ? currentState.float
        : 0;
      return {
        ...currentState,
        float: currentFloat + event.data.amount,
        revision: streamRevision,
      };
    case 'shift-closed':
      return {
        ...currentState,
        finishedAt: event.data.finishedAt,
        status: CashierShiftStatus.Closed,
        float: event.data.declaredTender,
        overageAmount: event.data.overageAmount,
        shortageAmount: event.data.shortageAmount,
        revision: streamRevision,
      };
    default:
      // Unexpected event type
      return {
        ...currentState,
      };
  }
}

export function isCashierShift(
  cashierShift: Partial<CashierShift | InitiatedCashierShift>
): cashierShift is CashierShift {
  return (
    cashierShift !== undefined &&
    'number' in cashierShift &&
    isPositiveNumber(cashierShift.number) &&
    isPositiveNumber(cashierShift.float) &&
    isNotEmptyString(cashierShift.cashierId) &&
    isNotEmptyString(cashierShift.cashRegisterId) &&
    isNotEmptyString(cashierShift.status) &&
    ['Started', 'Finished'].includes(cashierShift.status!)
  );
}

export function isInitiatedCashierShift(
  cashierShift: Partial<CashierShift | InitiatedCashierShift>
): cashierShift is InitiatedCashierShift {
  return (
    cashierShift !== undefined &&
    !isCashierShift(cashierShift) &&
    isNotEmptyString(cashierShift.cashRegisterId) &&
    !('number' in cashierShift)
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
  events: StreamEvent<CashierShiftEvent>[]
): CashierShift | InitiatedCashierShift {
  return aggregateStream(
    events,
    when,
    (state): state is CashierShift | InitiatedCashierShift =>
      isInitiatedCashierShift(state) || isCashierShift(state)
  );
}

export type SHIFT_ALREADY_INITIALIZED = 'SHIFT_ALREADY_INITIALIZED';
export type SHIFT_NOT_INITIALIZED = 'SHIFT_NOT_INITIALIZED';
export type SHIFT_DOES_NOT_EXIST = 'SHIFT_DOES_NOT_EXIST';
export type SHIFT_NOT_OPENED = 'SHIFT_NOT_OPENED';
export type SHIFT_ALREADY_OPENED = 'SHIFT_ALREADY_OPENED';
export type SHIFT_ALREADY_CLOSED = 'SHIFT_ALREADY_CLOSED';
