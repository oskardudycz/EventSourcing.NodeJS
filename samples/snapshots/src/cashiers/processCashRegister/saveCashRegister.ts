import { EventStoreDBClient } from '@eventstore/db-client';
import { appendSnapshotToStreamWithPrefix } from '../../core/eventStore/snapshotting';
import { appendEventAndSeparateSnapshot } from '../../core/eventStore/snapshotting/appending/appendEventAndSeparateSnapshot';
import { aggregateStream } from '../../core/streams';
import {
  CashRegister,
  CashRegisterEvent,
  isCashier,
  when,
} from '../cashRegister';
import { CashRegisterSnapshoted } from '../snapshot';

export function saveCashRegister(
  eventStore: EventStoreDBClient,
  streamName: string,
  {
    newEvent,
    currentEvents,
    lastSnapshotVersion,
  }: {
    newEvent: CashRegisterEvent;
    currentEvents: CashRegisterEvent[] = [];
    lastSnapshotVersion?: bigint | undefined;
  }
): Promise<boolean> {
  const currentState = aggregateStream<CashRegister, CashRegisterEvent>(
    [...currentEvents, newEvent],
    when,
    isCashier
  );

  return appendEventAndSeparateSnapshot(
    eventStore,
    streamName,
    currentState,
    lastSnapshotVersion,
    newEvent,
    {
      shouldDoSnapshot: (event: CashRegisterEvent) => {
        return event.type === 'shift-ended';
      },
      buildSnapshot: (
        currentState: CashRegister,
        streamVersion: bigint
      ): CashRegisterSnapshoted => {
        return {
          type: 'cash-register-snapshoted',
          data: currentState,
          metadata: { streamVersion: streamVersion.toString() },
        };
      },
      appendSnapshot: async (
        snapshot: CashRegisterSnapshoted,
        streamName: string,
        lastSnapshotVersion: bigint | undefined
      ) =>
        appendSnapshotToStreamWithPrefix(
          eventStore,
          snapshot,
          streamName,
          lastSnapshotVersion
        ),
    }
  );
}
