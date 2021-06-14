import { getEventStore } from '../../core/eventStore';
import { CashRegisterEvent } from '../cashRegister';
import { STREAM_NOT_FOUND } from '../../core/eventStore/reading';
import { readEventsFromSnapshotInSeparateStream } from '../../core/eventStore/eventStoreDB/reading/readFromSnapshotAndStream';
import { pipeResultAsync, transformResults } from '../../core/primitives/pipe';
import { Result, success } from '../../core/primitives/result';
import {
  appendToStream,
  FAILED_TO_APPEND_EVENT,
} from '../../core/eventStore/eventStoreDB/appending';
import { buildSnapshot, CashRegisterSnapshoted } from '../snapshot';
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

  const readEventsFromSnapshot = () =>
    readEventsFromSnapshotInSeparateStream<CashRegisterEvent>(
      eventStore,
      streamName
    );

  const handleCommand = transformResults(
    async ({
      events: currentEvents,
    }: {
      events: CashRegisterEvent[];
      lastSnapshotVersion?: bigint;
    }) => {
      return handle(currentEvents, command);
    },
    (newEvent, { events: currentEvents, lastSnapshotVersion }) => {
      return { newEvent, currentEvents, lastSnapshotVersion };
    }
  );

  const appendNewEvent = transformResults(
    async ({
      newEvent,
    }: {
      newEvent: CashRegisterEvent;
      currentEvents: CashRegisterEvent[];
      lastSnapshotVersion?: bigint;
    }) => appendToStream(eventStore, streamName, [newEvent]),
    ({ nextExpectedRevision }, inputs) => {
      return {
        ...inputs,
        currentStreamVersion: nextExpectedRevision,
      };
    }
  );

  const tryBuildSnapshot = transformResults(
    async (params: {
      currentStreamVersion: bigint;
      newEvent: CashRegisterEvent;
      lastSnapshotVersion?: bigint;
    }) => buildSnapshot(params),
    ({ snapshot }, { lastSnapshotVersion }) => {
      return { snapshot, lastSnapshotVersion };
    }
  );

  const appendSnapshot = ({
    snapshot,
    lastSnapshotVersion,
  }: {
    snapshot: CashRegisterSnapshoted;
    lastSnapshotVersion?: bigint;
  }) =>
    appendSnapshotToStreamWithPrefix(
      eventStore,
      snapshot,
      streamName,
      lastSnapshotVersion
    );

  return ignoreSnapshotSkipped(
    pipeResultAsync(
      readEventsFromSnapshot,
      handleCommand,
      appendNewEvent,
      tryBuildSnapshot,
      appendSnapshot,
      async (_) => success(true)
    )
  );
}
