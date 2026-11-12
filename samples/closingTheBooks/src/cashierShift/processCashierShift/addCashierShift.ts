import { getEventStore } from '#core/eventStore';
import type { CashierShiftEvent } from '../cashierShift';
import type { Result } from '#core/primitives';
import type {
  AppendResult,
  FAILED_TO_APPEND_EVENT,
} from '#core/eventStore/appending';
import { add, appendToStream } from '#core/eventStore/appending';
import { NO_STREAM } from '@kurrent/kurrentdb-client';

export async function addCashierShift<Command, TError = never>(
  streamName: string,
  command: Command,
  handle: (command: Command) => Result<CashierShiftEvent, TError>,
): Promise<Result<AppendResult, FAILED_TO_APPEND_EVENT | TError>> {
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
        streamState: NO_STREAM,
      }),
    getEventStore(),
    streamName,
    command,
  );
}
