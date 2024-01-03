import { isCashRegisterEvent } from '../cashRegister';
import { Result, success } from '#core/primitives';
import { buildSnapshot, shouldDoSnapshot } from '../snapshot';
import { STREAM_NOT_FOUND } from '#core/eventStore/reading';
import { FAILED_TO_APPEND_SNAPSHOT } from '#core/eventStore/snapshotting';
import { Event } from '#core/events';
import { snapshotOnSubscriptionToStreamWithPrefix } from '#core/eventStore/snapshotting/subscribing';

export async function storeCashRegisterSnapshotOnSubscription(
  event: Event,
  options: { position: bigint; revision: bigint; streamName: string },
): Promise<Result<boolean, STREAM_NOT_FOUND | FAILED_TO_APPEND_SNAPSHOT>> {
  if (!isCashRegisterEvent(event)) return success(false);

  return snapshotOnSubscriptionToStreamWithPrefix(
    shouldDoSnapshot,
    buildSnapshot,
    event,
    options,
  );
}
