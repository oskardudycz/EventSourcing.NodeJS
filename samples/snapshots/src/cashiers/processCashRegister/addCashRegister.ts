import { getEventStore } from '../../core/eventStore';
import { CashRegisterEvent } from '../cashRegister';
import { STREAM_NOT_FOUND } from '../../core/eventStore/reading';
import { Result } from '../../core/primitives/result';
import {
  add,
  FAILED_TO_APPEND_EVENT,
} from '../../core/eventStore/eventStoreDB/appending';
import { buildSnapshot } from '../snapshot';
import {
  appendEventAndSnapshotToStreamWithPrefix,
  FAILED_TO_APPEND_SNAPSHOT,
} from '../../core/eventStore/snapshotting';

export async function addCashRegister<Command, TError = never>(
  streamName: string,
  command: Command,
  handle: (command: Command) => Result<CashRegisterEvent, TError>
): Promise<
  Result<
    boolean,
    | STREAM_NOT_FOUND
    | FAILED_TO_APPEND_EVENT
    | FAILED_TO_APPEND_SNAPSHOT
    | TError
  >
> {
  return add(
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
