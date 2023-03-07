import {
  SnapshotEvent,
  SNAPSHOT_CREATION_SKIPPED,
} from '#core/eventStore/snapshotting';
import { failure, Result, success } from '#core/primitives';
import {
  CashRegister,
  CashRegisterEvent,
  getCashRegisterFrom,
} from '../cashRegister';

export type CashRegisterSnapshoted = SnapshotEvent<
  'cash-register-snapshoted',
  CashRegister
>;

export function shouldDoSnapshot({
  newEvent,
}: {
  newEvent: CashRegisterEvent;
}) {
  return newEvent.type === 'shift-ended';
}

export function buildSnapshot({
  currentEvents = [],
  newEvent,
  currentStreamVersion,
}: {
  newEvent: CashRegisterEvent;
  currentEvents: CashRegisterEvent[];
  currentStreamVersion: bigint;
  streamName: string;
}): Result<CashRegisterSnapshoted, SNAPSHOT_CREATION_SKIPPED> {
  if (!shouldDoSnapshot({ newEvent }))
    return failure('SNAPSHOT_CREATION_SKIPPED');

  const currentState: CashRegister = getCashRegisterFrom([
    ...currentEvents,
    newEvent,
  ]);

  return success({
    type: 'cash-register-snapshoted',
    data: currentState,
    metadata: { snapshottedStreamVersion: currentStreamVersion.toString() },
  });
}
