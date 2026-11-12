import { getEventStore } from '#core/eventStore';
import type { STREAM_NOT_FOUND } from '#core/eventStore/reading';
import { readFromStream } from '#core/eventStore/reading';
import type { Result } from '#core/primitives';
import { success } from '#core/primitives';
import type {
  AppendResult,
  FAILED_TO_APPEND_EVENT,
} from '#core/eventStore/appending';
import { appendToStream, getAndUpdate } from '#core/eventStore/appending';
import type { FAILED_TO_APPEND_SNAPSHOT } from '#core/eventStore/snapshotting';
import type { StreamEvent } from '#core/events';
import type { Command } from '#core/commands';
import type { CashierShiftEvent } from '../cashierShift';

export async function updateCashierShift<
  TCommand extends Command,
  TError = never,
>(
  streamName: string,
  command: TCommand,
  handle: (
    currentEvents: StreamEvent<CashierShiftEvent>[],
    command: TCommand,
  ) => Result<CashierShiftEvent, TError>,
): Promise<
  Result<
    AppendResult,
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
        streamName,
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
      _lastSnapshotVersion,
    ) => {
      const expectedRevision = command.metadata?.$expectedRevision
        ? BigInt(command.metadata?.$expectedRevision)
        : undefined;

      return appendToStream(eventStore, streamName, [newEvent], {
        streamState: expectedRevision,
      });
    },
    getEventStore(),
    streamName,
    command,
  );
}
