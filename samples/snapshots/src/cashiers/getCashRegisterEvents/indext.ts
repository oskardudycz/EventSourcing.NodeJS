import { EventStoreDBClient } from '@eventstore/db-client';
import { STREAM_NOT_FOUND } from '../../core/eventStore/reading';
import {
  readSnapshotFromSeparateStream,
  readFromSnapshotAndStream,
  ReadFromStreamAndSnapshotsResult,
} from '../../core/eventStore/snapshotting';
import { addSnapshotPrefix } from '../../core/eventStore/snapshotting';
import { CashRegisterEvent } from '../cashRegister';
import { CashRegisterSnapshoted } from '../snapshot';

export function getCashRegisterEvents(
  eventStore: EventStoreDBClient,
  streamName: string
): Promise<
  ReadFromStreamAndSnapshotsResult<CashRegisterEvent> | STREAM_NOT_FOUND
> {
  const getSnapshot = (streamName: string) =>
    readSnapshotFromSeparateStream<CashRegisterSnapshoted>(
      eventStore,
      streamName,
      addSnapshotPrefix
    );

  return readFromSnapshotAndStream<CashRegisterEvent, CashRegisterSnapshoted>(
    eventStore,
    streamName,
    getSnapshot
  );
}
