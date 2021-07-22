import { getEventStore } from '#core/eventStore';
import { appendToStream } from '#core/eventStore/appending';
import { failure, Result, success } from '#core/primitives';
import { NO_STREAM } from '@eventstore/db-client';
import { getActiveCashierShiftStreamName } from '../cashierShift';
import { handleSetActiveShift, SetActiveShift } from './handler';

export type SHIFT_ALREADY_STARTED = 'SHIFT_ALREADY_STARTED';
export type UNEXPECTED_FAILURE = 'UNEXPECTED_FAILURE';

export async function setActiveShift(
  command: SetActiveShift
): Promise<Result<true, SHIFT_ALREADY_STARTED>> {
  const eventStore = getEventStore();

  const event = handleSetActiveShift(command);

  if (event.isError) return event;

  const result = await appendToStream(
    eventStore,
    getActiveCashierShiftStreamName(command.data.cashRegisterId),
    [event.value],
    { expectedRevision: NO_STREAM }
  );

  if (result.isError) return failure('SHIFT_ALREADY_STARTED');

  return success(true);
}
