import { executeOnMongoDB } from '#core/mongoDB';
import { Result, success } from '#core/primitives';
import { Event } from '#core/events';
import { CashierShiftStatus } from '../cashierShift';
import { ShiftOpened } from '../openingShift';
import { TransactionRegistered } from '../registeringTransaction';
import { ShiftClosed } from '../closingShift';
import { CurrentCashierShiftDetails } from './currentCashierShiftDetails';

export async function projectShiftOpened(
  event: ShiftOpened
): Promise<Result<true>> {
  await executeOnMongoDB<CurrentCashierShiftDetails>(
    { collectionName: 'currentCashierShiftDetails' },
    async (currentCashierShifts) => {
      await currentCashierShifts.insertOne({
        number: event.data.shiftNumber,
        cashRegisterId: event.data.cashRegisterId,
        cashierId: event.data.cashierId,
        status: CashierShiftStatus.Opened,
        float: event.data.declaredStartAmount,
        startAmount: event.data.declaredStartAmount,
        revision: '1', // TODO: use the real stream revision
        startedAt: event.data.startedAt,
      });
    }
  );

  return success(true);
}

export async function projectTransactionRegistered(
  event: TransactionRegistered
): Promise<Result<true>> {
  await executeOnMongoDB<CurrentCashierShiftDetails>(
    { collectionName: 'currentCashierShiftDetails' },
    async (currentCashierShifts) => {
      await currentCashierShifts.updateOne(
        {
          cashRegisterId: event.data.cashRegisterId,
        },
        { $inc: { float: event.data.amount } }
      );
    }
  );

  return success(true);
}

export async function projectShiftClosed(
  event: ShiftClosed
): Promise<Result<true>> {
  await executeOnMongoDB<CurrentCashierShiftDetails>(
    { collectionName: 'currentCashierShiftDetails' },
    async (currentCashierShifts) => {
      await currentCashierShifts.updateOne(
        {
          cashRegisterId: event.data.cashRegisterId,
        },
        {
          $set: {
            finishedAt: event.data.finishedAt,
            status: CashierShiftStatus.Closed,
            float: event.data.declaredTender,
            overageAmount: event.data.overageAmount,
            shortageAmount: event.data.shortageAmount,
          },
        }
      );
    }
  );

  return success(true);
}

type CashierShiftDetailsEvent =
  | ShiftOpened
  | TransactionRegistered
  | ShiftClosed;

function isCashierShiftDetailsEvent(
  event: Event
): event is CashierShiftDetailsEvent {
  const eventType = (event as CashierShiftDetailsEvent).type;

  return (
    eventType === 'shift-opened' ||
    eventType === 'transaction-registered' ||
    eventType === 'shift-closed'
  );
}

export async function projectToCurrentCashierShiftDetails(
  event: Event
): Promise<Result<boolean>> {
  if (!isCashierShiftDetailsEvent(event)) {
    return success(false);
  }

  switch (event.type) {
    case 'shift-opened':
      return projectShiftOpened(event);
    case 'transaction-registered':
      return projectTransactionRegistered(event);
    case 'shift-closed':
      return projectShiftClosed(event);
    default:
      throw `Unknown event type`;
  }
}
