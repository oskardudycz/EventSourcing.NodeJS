import { getEventStore } from '../../core/eventStore';
import { CashRegisterEvent, getCashRegisterStreamName } from '../cashRegister';
import { getCashRegisterEvents } from '../getCashRegisterEvents/indext';
import { saveCashRegister } from '../saveCashRegister';
import { cashierRouter as router } from '..';

export async function updateCashRegister<Command, HandlingError>(
  cashRegisterId: string,
  command: Command,
  handle: (
    currentEvents: CashRegisterEvent[],
    command: Command
  ) => Promise<CashRegisterEvent | string>
): Promise<CashRegisterEvent | HandlingError> {
  const eventStore = getEventStore();

  const streamName = getCashRegisterStreamName(cashRegisterId);
  const stream = await getCashRegisterEvents(eventStore, streamName);

  if (stream === 'STREAM_NOT_FOUND') {
    return 'STREAM_NOT_FOUND';
  }

  const { events, lastSnapshotVersion } = stream;

  const newEvent = await handle(events, command);

  if (typeof newEvent === 'string') {
    return newEvent;
  }

  await saveCashRegister(
    eventStore,
    streamName,
    events,
    newEvent,
    lastSnapshotVersion
  );
}

export { router };
