import { EventStoreDBClient } from '@eventstore/db-client';
import { STREAM_NOT_FOUND } from '../core/eventStore/reading';
import {
  addSnapshotPrefix,
  getSnapshotFromSeparateStream,
  readFromStreamAndSnapshot,
  ReadFromStreamAndSnapshotsResult,
} from '../core/eventStore/snapshotting';
import { CashRegisterEvent } from './cashRegister';
import { CashRegisterSnapshotted } from './snapshotting';

export function getCashRegisterEvents(
  eventStore: EventStoreDBClient,
  streamName: string
): Promise<
  ReadFromStreamAndSnapshotsResult<CashRegisterEvent> | STREAM_NOT_FOUND
> {
  const getSnapshot = (streamName: string) =>
    getSnapshotFromSeparateStream<CashRegisterSnapshotted>(
      eventStore,
      streamName,
      addSnapshotPrefix
    );

  return readFromStreamAndSnapshot<CashRegisterEvent, CashRegisterSnapshotted>(
    eventStore,
    streamName,
    getSnapshot
  );
}
