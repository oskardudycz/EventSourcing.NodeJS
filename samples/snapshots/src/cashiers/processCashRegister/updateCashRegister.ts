import { getEventStore } from '../../core/eventStore';
import {
  CashRegister,
  CashRegisterEvent,
  isCashier,
  when,
} from '../cashRegister';
import { STREAM_NOT_FOUND } from '../../core/eventStore/reading';
import {
  readEventsFromSnapshotInSeparateStream,
  ReadFromStreamAndSnapshotsResult,
} from '../../core/eventStore/eventStoreDB/reading/readFromSnapshotAndStream';
import {
  mergeResults,
  pipeResultAsync,
  transformResults,
} from '../../core/primitives/pipe';
import { Result, success } from '../../core/primitives/result';
import { EventStoreDBClient } from '@eventstore/db-client';
import {
  AppendResult,
  appendToStream,
  WRONG_EXPECTED_VERSION,
} from '../../core/eventStore/eventStoreDB/appending';
import { CashRegisterSnapshoted } from '../snapshot';
import { aggregateStream } from '../../core/streams';
import {
  appendSnapshotToStreamWithPrefix,
  FAILED_TO_APPEND_SNAPSHOT,
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
    | WRONG_EXPECTED_VERSION
    | FAILED_TO_APPEND_SNAPSHOT
    | TError
    | never
  >
> {
  const eventStore = getEventStore();

  const readEvents = (
    eventStore: EventStoreDBClient,
    streamName: string
  ) => () =>
    readEventsFromSnapshotInSeparateStream<CashRegisterEvent>(
      eventStore,
      streamName
    );

  const handleCommand = (command: Command) => async ({
    events: currentEvents,
  }: ReadFromStreamAndSnapshotsResult<CashRegisterEvent>) => {
    return handle(currentEvents, command);
  };

  const appendEvent = (
    eventStore: EventStoreDBClient,
    streamName: string
  ) => (result: {
    newEvent: CashRegisterEvent;
    lastSnapshotVersion?: bigint | undefined;
    events: CashRegisterEvent[];
  }) => appendToStream(eventStore, streamName, result.newEvent);

  const shouldDoSnapshot = (event: CashRegisterEvent) => {
    return event.type === 'shift-ended';
  };
  const buildSnapshot = (
    currentState: CashRegister,
    streamVersion: bigint
  ): CashRegisterSnapshoted => {
    return {
      type: 'cash-register-snapshoted',
      data: currentState,
      metadata: { streamVersion: streamVersion.toString() },
    };
  };

  const buildSnapshotIfNeeded = (streamName: string) => async ({
    events: currentEvents,
    newEvent,
    nextExpectedRevision: currentStreamVersion,
  }: AppendResult & {
    newEvent: CashRegisterEvent;
    lastSnapshotVersion?: bigint | undefined;
    events: CashRegisterEvent[];
  }) => {
    const currentState = aggregateStream<CashRegister, CashRegisterEvent>(
      [...currentEvents, newEvent],
      when,
      isCashier
    );

    if (
      !shouldDoSnapshot(newEvent) //, currentStreamVersion, streamName, currentState)
    )
      return success(undefined);

    return success(buildSnapshot(currentState, currentStreamVersion));
  };

  const appendSnapshot = (
    eventStore: EventStoreDBClient,
    streamName: string
  ) => async ({
    snapshot,
    lastSnapshotVersion,
  }: {
    snapshot?: CashRegisterSnapshoted;
    lastSnapshotVersion: bigint | undefined;
  }) => {
    if (!snapshot) return success(false);

    const result = await appendSnapshotToStreamWithPrefix(
      eventStore,
      snapshot,
      streamName,
      lastSnapshotVersion
    );

    if (result.isError) return result;

    return success(true);
  };

  return await pipeResultAsync(
    readEvents(eventStore, streamName),
    mergeResults(
      transformResults(handleCommand(command), (newEvent) => {
        return { newEvent };
      })
    ),
    mergeResults(appendEvent(eventStore, streamName)),
    transformResults(
      buildSnapshotIfNeeded(streamName),
      (snapshot, { lastSnapshotVersion }) => {
        return {
          snapshot,
          lastSnapshotVersion: lastSnapshotVersion,
        };
      }
    ),
    appendSnapshot(eventStore, streamName)
  )();
}
