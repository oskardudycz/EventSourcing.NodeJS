import {
  SnapshotEvent,
  SNAPSHOT_CREATION_SKIPPED,
} from '../../core/eventStore/snapshotting';
import { failure, Result, success } from '../../core/primitives/result';
import { aggregateStream } from '../../core/streams';
import {
  CashRegister,
  CashRegisterEvent,
  isCashier,
  when,
} from '../cashRegister';

export type CashRegisterSnapshoted = SnapshotEvent<
  'cash-register-snapshoted',
  CashRegister
>;

export function shouldDoSnapshot(event: CashRegisterEvent) {
  return event.type === 'shift-ended';
}

export function buildSnapshot({
  currentEvents = [],
  newEvent,
  currentStreamVersion,
}: {
  currentEvents?: CashRegisterEvent[];
  newEvent: CashRegisterEvent;
  currentStreamVersion: bigint;
}): Result<{ snapshot: CashRegisterSnapshoted }, SNAPSHOT_CREATION_SKIPPED> {
  const currentState: CashRegister = aggregateStream(
    [...currentEvents, newEvent],
    when,
    isCashier
  );

  return shouldDoSnapshot(newEvent)
    ? success({
        snapshot: {
          type: 'cash-register-snapshoted',
          data: currentState,
          metadata: { streamVersion: currentStreamVersion.toString() },
        },
      })
    : failure('SNAPSHOT_CREATION_SKIPPED');
}
