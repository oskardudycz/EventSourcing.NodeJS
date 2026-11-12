import { getEventStore } from '#core/eventStore';
import type { CashRegisterEvent } from '../cashRegister';
import type { STREAM_NOT_FOUND } from '#core/eventStore/reading';
import type { Result } from '#core/primitives';
import type { FAILED_TO_APPEND_EVENT } from '#core/eventStore/appending';
import { add } from '#core/eventStore/appending';
import { buildSnapshot } from '../snapshot';
import type { FAILED_TO_APPEND_SNAPSHOT } from '#core/eventStore/snapshotting';
import { appendEventAndSnapshotToStreamWithPrefix } from '#core/eventStore/snapshotting';

export async function addCashRegister<Command, TError = never>(
  streamName: string,
  command: Command,
  handle: (command: Command) => Result<CashRegisterEvent, TError>,
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
        ...args,
      ),
    getEventStore(),
    streamName,
    command,
  );
}
