import { getEventStore } from '../../core/eventStore';
import { CashRegisterEvent } from '../cashRegister';
import { STREAM_NOT_FOUND } from '../../core/eventStore/reading';
import { readEventsFromSnapshotInSeparateStream } from '../../core/eventStore/eventStoreDB/reading/readFromSnapshotAndStream';
import { Result } from '../../core/primitives/result';
import { FAILED_TO_APPEND_EVENT } from '../../core/eventStore/eventStoreDB/appending';
import { buildSnapshot, CashRegisterSnapshoted } from '../snapshot';
import {
  appendEventAndSnapshotToStreamWithPrefix,
  FAILED_TO_APPEND_SNAPSHOT,
} from '../../core/eventStore/snapshotting';
import { getAndUpdate } from '../../core/eventStore/eventStoreDB/appending';

export async function updateCashRegister<Command, TError = never>(
  streamName: string,
  command: Command,
  handle: (
    currentEvents: CashRegisterEvent[],
    command: Command
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
    (eventStore, streamName) =>
      readEventsFromSnapshotInSeparateStream<
        CashRegisterEvent,
        CashRegisterSnapshoted
      >(eventStore, streamName),
    handle,
    (...args) =>
      appendEventAndSnapshotToStreamWithPrefix(
        (options) => buildSnapshot(options),
        ...args
      ),
    getEventStore(),
    streamName,
    command
  );
}
