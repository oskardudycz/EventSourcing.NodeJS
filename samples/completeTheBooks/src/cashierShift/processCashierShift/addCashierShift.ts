import { getEventStore } from '#core/eventStore';
import { CashierShiftEvent } from '../cashierShift';
import { Result } from '#core/primitives';
import {
  add,
  AppendResult,
  appendToStream,
  FAILED_TO_APPEND_EVENT,
} from '#core/eventStore/appending';
import { NO_STREAM } from '@eventstore/db-client';

export async function addCashierShift<Command, TError = never>(
  streamName: string,
  command: Command,
  handle: (command: Command) => Result<CashierShiftEvent, TError>
): Promise<Result<AppendResult, FAILED_TO_APPEND_EVENT | TError>> {
  return add(
    handle,
    async (
      eventStore,
      streamName,
      _currentEvents,
      newEvent,
      _lastSnapshotVersion
    ) =>
      appendToStream(eventStore, streamName, [newEvent], {
        expectedRevision: NO_STREAM,
      }),
    getEventStore(),
    streamName,
    command
  );
}
