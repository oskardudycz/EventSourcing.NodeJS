import { getEventStore } from '../../core/eventStore';
import { CashRegisterEvent, isCashRegisterEvent } from '../cashRegister';
import { readEventsFromSnapshotInSeparateStream } from '../../core/eventStore/eventStoreDB/reading/readFromSnapshotAndStream';
import {
  forwardInputsAsResults,
  pipeResultAsync,
} from '../../core/primitives/pipe';
import { Result, success } from '../../core/primitives/result';
import { buildSnapshot, shouldDoSnapshot } from '../snapshot';
import { appendSnapshotToStreamWithPrefix } from '../../core/eventStore/snapshotting';
import { Event } from '../../core/events';

export async function storeSnapshotOnSubscription(
  event: Event,
  {
    position,
    revision,
    streamName,
  }: { position: bigint; revision: bigint; streamName: string }
): Promise<Result<boolean>> {
  const eventStore = getEventStore();

  if (!isCashRegisterEvent(event) || !shouldDoSnapshot(event))
    return success(false);

  const result = await pipeResultAsync(
    () =>
      readEventsFromSnapshotInSeparateStream<CashRegisterEvent>(
        eventStore,
        streamName,
        { toPosition: position }
      ),
    forwardInputsAsResults(async ({ events: currentEvents }) =>
      buildSnapshot({
        currentStreamVersion: revision,
        currentEvents,
        newEvent: event,
      })
    ),
    ({ snapshot, lastSnapshotVersion }) =>
      appendSnapshotToStreamWithPrefix(
        eventStore,
        snapshot,
        streamName,
        lastSnapshotVersion
      )
  )();

  if (result.isError) return success(false);

  return success(true);
}
