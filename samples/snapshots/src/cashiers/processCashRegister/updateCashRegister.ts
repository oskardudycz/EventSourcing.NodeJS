import { getEventStore } from '../../core/eventStore';
import { CashRegisterEvent } from '../cashRegister';
import { STREAM_NOT_FOUND } from '../../core/eventStore/reading';
import { readEventsFromSnapshotInSeparateStream } from '../../core/eventStore/eventStoreDB/reading/readFromSnapshotAndStream';
import {
  mergeResults,
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
    | never
  >
> {
  const eventStore = getEventStore();

  return ignoreSnapshotSkipped(
    pipeResultAsync(
      () =>
        readEventsFromSnapshotInSeparateStream<CashRegisterEvent>(
          eventStore,
          streamName
        ),
      transformResults(
        async ({ events }) => handle(events, command),
        (newEvent, { events: currentEvents, lastSnapshotVersion }) => {
          return { newEvent, currentEvents, lastSnapshotVersion };
        }
      ),
      mergeResults(async ({ newEvent }) =>
        appendToStream(eventStore, streamName, newEvent)
      ),
      mergeResults(
        async ({
          nextExpectedRevision: currentStreamVersion,
          currentEvents,
          newEvent,
        }) => buildSnapshot({ currentStreamVersion, currentEvents, newEvent })
      ),
      transformResults(
        ({ snapshot, lastSnapshotVersion }) =>
          appendSnapshotToStreamWithPrefix(
            eventStore,
            snapshot,
            streamName,
            lastSnapshotVersion
          ),
        (_) => success(true)
      )
    )
  );
}
