import { getEventStore } from '../../core/eventStore';
import { CashRegisterEvent } from '../cashRegister';
import { saveCashRegister } from './saveCashRegister';
import { STREAM_NOT_FOUND } from '../../core/eventStore/reading';
import { getAndUpdate } from '../../core/eventStore/eventStoreDB/appending';
import { readEventsFromSnapshotInSeparateStream } from '../../core/eventStore/eventStoreDB/reading/readFromSnapshotAndStream';
import { pipe } from '../../core/primitives/pipe';
import { switchErrorAsync } from '../../core/primitives/switchError';
import { isEvent } from '../../core/events';
import { failure, Result, success } from '../../core/primitives/result';

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

export async function updateCashRegister2<Command, TError = never>(
  streamName: string,
  command: Command,
  handle: (
    currentEvents: CashRegisterEvent[],
    command: Command
  ) => CashRegisterEvent | TError
): Promise<Result<boolean, STREAM_NOT_FOUND | TError | never>> {
  const eventStore = getEventStore();

  return pipe(
    async () => {
      const result = await readEventsFromSnapshotInSeparateStream<CashRegisterEvent>(
        eventStore,
        streamName
      );

      if (result === 'STREAM_NOT_FOUND') return failure(result);

      return success(result);
    },
    switchErrorAsync(async (stream) => {
      const { events, lastSnapshotVersion } = stream;

      const newEvent = handle(events, command);

      if (!isEvent(newEvent)) {
        return failure(newEvent);
      }

      return success({
        lastSnapshotVersion,
        newEvent,
        events,
      });
    }),
    switchErrorAsync(async (result) => {
      const { lastSnapshotVersion, newEvent, events } = result;

      return success(
        await saveCashRegister(
          eventStore,
          streamName,
          newEvent,
          events,
          lastSnapshotVersion
        )
      );
    })
  )();
}
