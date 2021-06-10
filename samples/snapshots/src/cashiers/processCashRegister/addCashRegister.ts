import { getEventStore } from '../../core/eventStore';
import { CashRegisterEvent } from '../cashRegister';
import { STREAM_NOT_FOUND } from '../../core/eventStore/reading';
import {
  forwardInputsAsResults,
  pipeResultAsync,
  transformResults,
} from '../../core/primitives/pipe';
import { Result, success } from '../../core/primitives/result';
import {
  appendToStream,
  FAILED_TO_APPEND_EVENT,
} from '../../core/eventStore/eventStoreDB/appending';
import { buildSnapshot } from '../snapshot';
import {
  appendSnapshotToStreamWithPrefix,
  FAILED_TO_APPEND_SNAPSHOT,
  ignoreSnapshotSkipped,
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
    | never
  >
> {
  const eventStore = getEventStore();

  return ignoreSnapshotSkipped(
    pipeResultAsync(
      transformResults(
        async () => handle(command),
        (newEvent) => {
          return { newEvent };
        }
      ),
      forwardInputsAsResults(async ({ newEvent }) =>
        appendToStream(eventStore, streamName, newEvent)
      ),
      forwardInputsAsResults(
        async ({ nextExpectedRevision: currentStreamVersion, newEvent }) =>
          buildSnapshot({ currentStreamVersion, newEvent })
      ),
      transformResults(
        ({ snapshot }) =>
          appendSnapshotToStreamWithPrefix(eventStore, snapshot, streamName),
        (_) => success(true)
      )
    )
  );
}
