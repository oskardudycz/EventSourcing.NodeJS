import { getEventStore } from '#core/eventStore';
import { CashierShiftEvent } from '../cashierShift';
import { Result, success } from '#core/primitives';
import {
  add,
  appendToStream,
  FAILED_TO_APPEND_EVENT,
} from '#core/eventStore/appending';
import { NO_STREAM } from '@eventstore/db-client';

export async function addCashierShift<Command, TError = never>(
  streamName: string,
  command: Command,
  handle: (command: Command) => Result<CashierShiftEvent, TError>
): Promise<Result<boolean, FAILED_TO_APPEND_EVENT | TError>> {
  return add(
    handle,
    async (
      eventStore,
      streamName,
      _currentEvents,
      newEvent,
      _lastSnapshotVersion
    ) => {
      const appendResult = await appendToStream(
        eventStore,
        streamName,
        [newEvent],
        { expectedRevision: NO_STREAM }
      );

      if (appendResult.isError) {
        return appendResult;
      }
      return success(true);
    },
    getEventStore(),
    streamName,
    command
  );
}
