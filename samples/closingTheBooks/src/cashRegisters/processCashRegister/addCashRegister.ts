import { getEventStore } from '#core/eventStore';
import type { CashRegisterEvent } from '../cashRegister';
import type { STREAM_NOT_FOUND } from '#core/eventStore/reading';
import type { Result } from '#core/primitives';
import type {
  AppendResult,
  FAILED_TO_APPEND_EVENT,
} from '#core/eventStore/appending';
import { add, appendToStream } from '#core/eventStore/appending';
import { NO_STREAM } from '@kurrent/kurrentdb-client';

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
        streamState: NO_STREAM,
      }),
    getEventStore(),
    streamName,
    command,
  );
}
