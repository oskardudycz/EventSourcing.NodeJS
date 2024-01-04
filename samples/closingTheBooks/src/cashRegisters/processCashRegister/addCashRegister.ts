import { getEventStore } from '#core/eventStore';
import { CashRegisterEvent } from '../cashRegister';
import { STREAM_NOT_FOUND } from '#core/eventStore/reading';
import { Result } from '#core/primitives';
import {
  add,
  appendToStream,
  AppendResult,
  FAILED_TO_APPEND_EVENT,
} from '#core/eventStore/appending';
import { NO_STREAM } from '@eventstore/db-client';

export async function addCashRegister<Command, TError = never>(
  streamName: string,
  command: Command,
  handle: (command: Command) => Result<CashRegisterEvent, TError>,
): Promise<
  Result<AppendResult, STREAM_NOT_FOUND | FAILED_TO_APPEND_EVENT | TError>
> {
  return add(
    handle,
    async (
      eventStore,
      streamName,
      _currentEvents,
      newEvent,
      _lastSnapshotVersion,
    ) =>
      appendToStream(eventStore, streamName, [newEvent], {
        expectedRevision: NO_STREAM,
      }),
    getEventStore(),
    streamName,
    command,
  );
}
