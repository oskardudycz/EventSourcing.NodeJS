import { EventStoreDBClient } from '@eventstore/db-client';
import { appendSnapshotToStreamWithPrefix } from '../../core/eventStore/snapshotting';
import { appendEventAndSeparateSnapshot } from '../../core/eventStore/snapshotting/appending/appendEventAndSeparateSnapshot';
import { aggregateStream } from '../../core/streams';
import { CashRegister, CashRegisterEvent, when } from '../cashRegister';
import { CashRegisterSnapshoted } from '../snapshot';

export function saveCashRegister(
  eventStore: EventStoreDBClient,
  streamName: string,
  currentEvents: CashRegisterEvent[],
  newEvent: CashRegisterEvent,
  lastSnapshotVersion: bigint | undefined
): Promise<boolean> {
  const currentState = aggregateStream<CashRegister, CashRegisterEvent>(
    [...currentEvents, newEvent],
    when
  );

  return appendEventAndSeparateSnapshot<
    CashRegister,
    CashRegisterEvent,
    CashRegisterSnapshoted
  >(eventStore, streamName, currentState, lastSnapshotVersion, newEvent, {
    shouldDoSnapshot: (event) => {
      return event.type === 'shift-started';
    },
    buildSnapshot: (currentState, streamVersion) => {
      return {
        type: 'cash-register-snapshoted',
        data: currentState,
        metadata: { streamVersion },
      };
    },
    appendSnapshot: async (snapshot, streamName) =>
      appendSnapshotToStreamWithPrefix(eventStore, snapshot, streamName),
  });
}
