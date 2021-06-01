import { getEventStore } from '../../core/eventStore';
import { CashRegisterEvent } from '../cashRegister';
import { saveCashRegister } from './saveCashRegister';
import { add } from '../../core/eventStore/eventStoreDB/appending';

export function addCashRegister<Command, TError = never>(
  streamName: string,
  command: Command,
  handle: (command: Command) => CashRegisterEvent | TError
): Promise<boolean | TError | never> {
  return add<Command, CashRegisterEvent, TError>(
    getEventStore(),
    saveCashRegister,
    streamName,
    command,
    handle
  );
}
