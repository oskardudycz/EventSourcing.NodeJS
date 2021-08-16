import { getEventStore } from '#core/eventStore';
import { readFromStream, STREAM_NOT_FOUND } from '#core/eventStore/reading';
import { Result, success } from '#core/primitives';
import {
  appendToStream,
  FAILED_TO_APPEND_EVENT,
  getAndUpdate,
} from '#core/eventStore/appending';
import { FAILED_TO_APPEND_SNAPSHOT } from '#core/eventStore/snapshotting';
import { CashRegisterEvent } from '../cashRegister';
import { StreamEvent } from '#core/events';
import { Command } from '#core/commands';

export async function updateCashRegister<
  TCommand extends Command,
  TError = never
>(
  streamName: string,
  command: TCommand,
  handle: (
    currentEvents: StreamEvent<CashRegisterEvent>[],
    command: TCommand
  ) => Result<CashRegisterEvent, TError>
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
      const result = await readFromStream<CashRegisterEvent>(
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

      const appendResult = await appendToStream(
        eventStore,
        streamName,
        [newEvent],
        { expectedRevision }
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
