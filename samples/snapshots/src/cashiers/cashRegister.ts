import { ShiftStarted } from './startingShift';
import { PlacedAtWorkStation } from './placeAtWorkStation';
import { CashRegisterSnapshotted } from './snapshotting';

/**
 * System used to key in purchases; also makes mathematical calculations and records payments
 * See more: https://www.englishclub.com/english-for-work/cashier-vocabulary.htm
 */
export type CashRegister = Readonly<{
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
  workstation: string;

  /**
   * Current cashier working on the cash register
   */
  currentCashierId?: string;
}>;

export type CashRegisterEvent =
  | PlacedAtWorkStation
  | ShiftStarted
  | CashRegisterSnapshotted;

export function when(
  currentState: Partial<CashRegister>,
  event: CashRegisterEvent
): Partial<CashRegister> {
  switch (event.type) {
    case 'placed-at-workstation':
      return {
        id: event.data.cashRegisterId,
        workstation: event.data.workstation,
        float: 0,
      };
    case 'shift-started':
      return {
        ...currentState,
        currentCashierId: event.data.cashierId,
      };
    case 'cash-register-snapshotted':
      return {
        ...event.data,
      };
    default:
      throw 'Unexpected event type';
  }
}

export function getCashRegisterStreamName(cashRegisterId: string) {
  return `cashregister-${cashRegisterId}`;
}
