import { PlacedAtWorkStation } from './placeAtWorkStation';
import { aggregateStream } from '#core/streams';
import { isNotEmptyString, isPositiveNumber } from '#core/validation';
import { StreamEvent } from '#core/events';

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

  revision: bigint;
}>;

export type CashRegisterEvent = PlacedAtWorkStation;

export function when(
  currentState: Partial<CashRegister>,
  streamEvent: StreamEvent<CashRegisterEvent>,
): Partial<CashRegister> {
  const { event, streamRevision } = streamEvent;
  switch (event.type) {
    case 'placed-at-workstation':
      return {
        id: event.data.cashRegisterId,
        workstation: event.data.workstation,
        float: 0,
        revision: streamRevision,
      };
    default:
      // Unexpected event type
      return {
        ...currentState,
      };
  }
}

export function isCashRegister(
  cashRegister: any,
): cashRegister is CashRegister {
  return (
    cashRegister !== undefined &&
    isNotEmptyString(cashRegister.id) &&
    isPositiveNumber(cashRegister.float) &&
    isNotEmptyString(cashRegister.workstation) &&
    (cashRegister.currentCashierId === undefined ||
      isNotEmptyString(cashRegister.currentCashierId))
  );
}

export function isCashRegisterEvent(event: any): event is CashRegisterEvent {
  switch (event.type) {
    case 'placed-at-workstation':
      return true;
    default:
      return false;
  }
}

export function getCashRegisterStreamName(cashRegisterId: string) {
  return `cashregister-${cashRegisterId}`;
}

export function getCashRegisterFrom(
  events: StreamEvent<CashRegisterEvent>[],
): CashRegister {
  return aggregateStream(events, when, isCashRegister);
}
