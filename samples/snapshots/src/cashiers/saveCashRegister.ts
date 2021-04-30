import { EventStoreDBClient } from '@eventstore/db-client';
import { appendSnapshotToStreamWithPrefix } from '../core/eventStore/snapshotting';
import { appendEventAndSnapshot } from '../core/eventStore/snapshotting/appendEventAndSnapshot';
import { aggregateStream } from '../core/streams';
import { CashRegister, CashRegisterEvent, when } from './cashRegister';
import { CashRegisterSnapshotted } from './snapshotting';

export function saveCashRegister(
  eventStore: EventStoreDBClient,
  streamName: string,
  currentEvents: CashRegisterEvent[],
  lastSnapshotVersion: bigint | undefined,
  newEvent: CashRegisterEvent
): Promise<boolean> {
  const currentState = aggregateStream<CashRegister, CashRegisterEvent>(
    [...currentEvents, newEvent],
    when
  );

  return appendEventAndSnapshot<
    CashRegister,
    CashRegisterEvent,
    CashRegisterSnapshotted
  >(eventStore, streamName, currentState, lastSnapshotVersion, newEvent, {
    shouldDoSnapshot: (event) => {
      return event.type === 'shift-started';
    },
    buildSnapshot: (currentState, streamVersion) => {
      return {
        type: 'cash-register-snapshotted',
        data: currentState,
        metadata: { streamVersion },
      };
    },
    appendSnapshot: async (snapshot, streamName) =>
      appendSnapshotToStreamWithPrefix(eventStore, snapshot, streamName),
  });
}
