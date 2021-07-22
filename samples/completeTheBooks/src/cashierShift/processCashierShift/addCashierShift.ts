import { getEventStore } from '#core/eventStore';
import { CashierShiftEvent } from '../cashierShift';
import { STREAM_NOT_FOUND } from '#core/eventStore/reading';
import { Result, success } from '#core/primitives';
import {
  add,
  appendToStream,
  FAILED_TO_APPEND_EVENT,
} from '#core/eventStore/appending';

export async function addCashierShift<Command, TError = never>(
  streamName: string,
  command: Command,
  handle: (command: Command) => Result<CashierShiftEvent, TError>
): Promise<
  Result<boolean, STREAM_NOT_FOUND | FAILED_TO_APPEND_EVENT | TError>
> {
  return add(
    handle,
    async (
      eventStore,
      streamName,
      _currentEvents,
      newEvent,
      _lastSnapshotVersion
    ) => {
      const appendResult = await appendToStream(eventStore, streamName, [
        newEvent,
      ]);

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
