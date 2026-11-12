import { getEventStore } from '#core/eventStore';
import type { STREAM_NOT_FOUND } from '#core/eventStore/reading';
import { readEventsFromSnapshotInSeparateStream } from '#core/eventStore/snapshotting';
import type { Result } from '#core/primitives';
import type { FAILED_TO_APPEND_EVENT } from '#core/eventStore/appending';
import { getAndUpdate } from '#core/eventStore/appending';
import type { FAILED_TO_APPEND_SNAPSHOT } from '#core/eventStore/snapshotting';
import { appendEventAndSnapshotToStreamWithPrefix } from '#core/eventStore/snapshotting';
import type { CashRegisterEvent } from '../cashRegister';
import type { CashRegisterSnapshoted } from '../snapshot';
import { buildSnapshot } from '../snapshot';

export async function updateCashRegister<Command, TError = never>(
  streamName: string,
  command: Command,
  handle: (
    currentEvents: CashRegisterEvent[],
    command: Command,
  ) => Result<CashRegisterEvent, TError>,
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
    (eventStore, streamName) =>
      readEventsFromSnapshotInSeparateStream<
        CashRegisterEvent,
        CashRegisterSnapshoted
      >(eventStore, streamName),
    handle,
    (...args) =>
      appendEventAndSnapshotToStreamWithPrefix(
        (options) => buildSnapshot(options),
        ...args,
      ),
    getEventStore(),
    streamName,
    command,
  );
}
