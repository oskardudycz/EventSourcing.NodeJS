import { getEventStore } from '#core/eventStore';
import { readFromStream, STREAM_NOT_FOUND } from '#core/eventStore/reading';
import { Result, success } from '#core/primitives';
import {
  appendToStream,
  FAILED_TO_APPEND_EVENT,
  getAndUpdate,
} from '#core/eventStore/appending';
import { FAILED_TO_APPEND_SNAPSHOT } from '#core/eventStore/snapshotting';
import { CashierShiftEvent } from '../cashierShift';

export async function updateCashierShift<Command, TError = never>(
  streamName: string,
  command: Command,
  handle: (
    currentEvents: CashierShiftEvent[],
    command: Command
  ) => Result<CashierShiftEvent, TError>
): Promise<
  Result<
    boolean,
    | STREAM_NOT_FOUND
    | FAILED_TO_APPEND_EVENT
    | FAILED_TO_APPEND_SNAPSHOT
    | TError
  >
> {
  return getAndUpdate(
    async (eventStore, streamName) => {
      const result = await readFromStream<CashierShiftEvent>(
        eventStore,
        streamName
      );

      if (result.isError) return result;

      return success({ events: result.value });
    },
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
