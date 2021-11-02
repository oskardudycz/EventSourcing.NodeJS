import { getEventStore } from '#core/eventStore';
import { readFromStream, STREAM_NOT_FOUND } from '#core/eventStore/reading';
import { Result, success } from '#core/primitives';
import {
  AppendResult,
  appendToStream,
  FAILED_TO_APPEND_EVENT,
  getAndUpdate,
} from '#core/eventStore/appending';
import { FAILED_TO_APPEND_SNAPSHOT } from '#core/eventStore/snapshotting';
import { StreamEvent } from '#core/events';
import { Command } from '#core/commands';
import { CashierShiftEvent } from '../cashierShift';

export async function updateCashierShift<
  TCommand extends Command,
  TError = never
>(
  streamName: string,
  command: TCommand,
  handle: (
    currentEvents: StreamEvent<CashierShiftEvent>[],
    command: TCommand
  ) => Result<CashierShiftEvent, TError>
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
      const expectedRevision = command.metadata?.$expectedRevision
        ? BigInt(command.metadata?.$expectedRevision)
        : undefined;

      return appendToStream(eventStore, streamName, [newEvent], {
        expectedRevision,
      });
    },
    getEventStore(),
    streamName,
    command
  );
}
