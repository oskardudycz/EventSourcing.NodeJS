import { isCashRegisterEvent } from '../cashRegister';
import type { Result } from '#core/primitives';
import { success } from '#core/primitives';
import { buildSnapshot, shouldDoSnapshot } from '../snapshot';
import type { STREAM_NOT_FOUND } from '#core/eventStore/reading';
import type { FAILED_TO_APPEND_SNAPSHOT } from '#core/eventStore/snapshotting';
import type { Event } from '#core/events';
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
