import { getEventStore } from '../../core/eventStore';
import { CashRegisterEvent } from '../cashRegister';
import { getCashRegisterEvents } from '../getCashRegisterEvents/indext';
import { saveCashRegister } from '../saveCashRegister';
import { isEvent } from '../../core/events';
import { STREAM_NOT_FOUND } from '../../core/eventStore/reading';

export async function updateCashRegister<Command, TError = never>(
  streamName: string,
  command: Command,
  handle: (
    currentEvents: CashRegisterEvent[],
    command: Command
  ) => CashRegisterEvent | TError
): Promise<boolean | STREAM_NOT_FOUND | TError | never> {
  const eventStore = getEventStore();

  const stream = await getCashRegisterEvents(eventStore, streamName);

  if (stream === 'STREAM_NOT_FOUND') {
    return 'STREAM_NOT_FOUND';
  }

  const { events, lastSnapshotVersion } = stream;

  const newEvent = handle(events, command);

  if (!isEvent(newEvent)) {
    return newEvent;
  }

  return await saveCashRegister(
    eventStore,
    streamName,
    events,
    newEvent,
    lastSnapshotVersion
  );
}
