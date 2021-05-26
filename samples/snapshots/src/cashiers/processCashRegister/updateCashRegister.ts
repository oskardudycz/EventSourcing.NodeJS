import { getEventStore } from '../../core/eventStore';
import { CashRegisterEvent } from '../cashRegister';
import { saveCashRegister } from './saveCashRegister';
import { STREAM_NOT_FOUND } from '../../core/eventStore/reading';
import { getAndUpdate } from '../../core/eventStore/eventStoreDB/appending';
import { readEventsFromSnapshotInSeparateStream } from '../../core/eventStore/eventStoreDB/reading/readFromSnapshotAndStream';

export function updateCashRegister<Command, TError = never>(
  streamName: string,
  command: Command,
  handle: (
    currentEvents: CashRegisterEvent[],
    command: Command
  ) => CashRegisterEvent | TError
): Promise<boolean | STREAM_NOT_FOUND | TError | never> {
  return getAndUpdate<Command, CashRegisterEvent, TError>(
    getEventStore(),
    (...args) =>
      readEventsFromSnapshotInSeparateStream<CashRegisterEvent>(...args),
    saveCashRegister,
    streamName,
    command,
    handle
  );
}
