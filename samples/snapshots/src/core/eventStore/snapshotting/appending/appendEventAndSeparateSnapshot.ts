import { EventStoreDBClient } from '@eventstore/db-client';
import { Event } from '../../../events';
import { FAILED_TO_APPEND_SNAPSHOT, SnapshotEvent } from '..';
import {
  AppendResult,
  appendToStream,
  WRONG_EXPECTED_VERSION,
} from '../../eventStoreDB/appending/appendToStream';
import { Result, success } from '../../../primitives/result';
import { pipeResultAsync } from '../../../primitives/pipe';

export type SnapshotOptions<
  Aggregate extends Record<string, unknown> = Record<string, unknown>,
  StreamEvent extends Event = Event,
  SnapshotStreamEvent extends SnapshotEvent = StreamEvent & SnapshotEvent
> = {
  appendSnapshot: (
    snapshot: SnapshotStreamEvent,
    streamName: string,
    lastSnapshotVersion: bigint | undefined
  ) => Promise<Result<boolean, FAILED_TO_APPEND_SNAPSHOT>>;
  shouldDoSnapshot: (
    event: StreamEvent,
    currentStreamVersion: bigint,
    streamName: string,
    currentState: Aggregate
  ) => boolean;
  buildSnapshot: (
    currentState: Aggregate,
    currentStreamVersion: bigint,
    lastSnapshotVersion: bigint | undefined,
    streamName: string,
    event: StreamEvent
  ) => SnapshotStreamEvent;
};

export async function appendEventAndSeparateSnapshot<
  Aggregate extends Record<string, unknown> = Record<string, unknown>,
  StreamEvent extends Event = Event,
  SnapshotStreamEvent extends SnapshotEvent = StreamEvent & SnapshotEvent
>(
  eventStore: EventStoreDBClient,
  streamName: string,
  currentState: Aggregate,
  lastSnapshotVersion: bigint | undefined,
  event: StreamEvent,
  options: SnapshotOptions<Aggregate, StreamEvent, SnapshotStreamEvent>
): Promise<
  Result<boolean, WRONG_EXPECTED_VERSION | FAILED_TO_APPEND_SNAPSHOT>
> {
  const { shouldDoSnapshot, buildSnapshot, appendSnapshot } = options;

  const buildSnapshotIfNeeded = async ({
    nextExpectedRevision: currentStreamVersion,
  }: AppendResult) => {
    if (
      !shouldDoSnapshot(event, currentStreamVersion, streamName, currentState)
    )
      return success(undefined);

    return success(
      buildSnapshot(
        currentState,
        currentStreamVersion,
        lastSnapshotVersion,
        streamName,
        event
      )
    );
  };

  return pipeResultAsync(
    () => appendToStream(eventStore, streamName, event),
    buildSnapshotIfNeeded,
    async (snapshot) => {
      if (!snapshot) return success(false);
      return appendSnapshot(snapshot, streamName, lastSnapshotVersion);
    }
  )();
}
