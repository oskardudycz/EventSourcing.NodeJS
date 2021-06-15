import { getEventStore } from '#core/eventStore';
import { CashRegisterEvent, isCashRegisterEvent } from '../cashRegister';
import { Result, success } from '#core/primitives';
import { buildSnapshot, shouldDoSnapshot } from '../snapshot';
import {
  appendSnapshotToStreamWithPrefix,
  readEventsFromSnapshotInSeparateStream,
} from '#core/eventStore/snapshotting';
import { Event } from '#core/events';
import { STREAM_NOT_FOUND } from '#core/eventStore/reading';

export async function storeSnapshotOnSubscription(
  event: Event,
  {
    position,
    revision,
    streamName,
  }: { position: bigint; revision: bigint; streamName: string }
): Promise<Result<boolean, STREAM_NOT_FOUND>> {
  const eventStore = getEventStore();

  if (!isCashRegisterEvent(event) || !shouldDoSnapshot(event))
    return success(false);

  const events = await readEventsFromSnapshotInSeparateStream<CashRegisterEvent>(
    eventStore,
    streamName,
    { toPosition: position }
  );

  if (events.isError) return events;

  const { events: currentEvents, lastSnapshotVersion } = events.value;

  const snapshot = buildSnapshot({
    currentStreamVersion: revision,
    currentEvents,
    newEvent: event,
    streamName,
  });

  if (snapshot.isError) return success(false);

  const result = await appendSnapshotToStreamWithPrefix(
    eventStore,
    snapshot.value,
    streamName,
    lastSnapshotVersion
  );

  if (result.isError) return success(false);

  return success(true);
}
