import { getEventStore } from '#core/eventStore';
import { STREAM_NOT_FOUND } from '#core/eventStore/reading';
import { readEventsFromSnapshotInSeparateStream } from '#core/eventStore/snapshotting';
import { Result } from '#core/primitives';
import {
  FAILED_TO_APPEND_EVENT,
  getAndUpdate,
} from '#core/eventStore/appending';
import {
  appendEventAndSnapshotToStreamWithPrefix,
  FAILED_TO_APPEND_SNAPSHOT,
} from '#core/eventStore/snapshotting';
import { CashRegisterEvent } from '../cashRegister';
import { buildSnapshot, CashRegisterSnapshoted } from '../snapshot';

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
