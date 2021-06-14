import { getEventStore } from '../../core/eventStore';
import { CashRegisterEvent } from '../cashRegister';
import { STREAM_NOT_FOUND } from '../../core/eventStore/reading';
import { pipeResultAsync, transformResults } from '../../core/primitives/pipe';
import { Result, success } from '../../core/primitives/result';
import {
  appendToStream,
  FAILED_TO_APPEND_EVENT,
} from '../../core/eventStore/eventStoreDB/appending';
import { buildSnapshot, CashRegisterSnapshoted } from '../snapshot';
import {
  appendSnapshotToStreamWithPrefix,
  FAILED_TO_APPEND_SNAPSHOT,
  ignoreSnapshotSkipped,
} from '../../core/eventStore/snapshotting';

export async function addCashRegister<Command, TError = never>(
  streamName: string,
  command: Command,
  handle: (command: Command) => Result<CashRegisterEvent, TError>
): Promise<
  Result<
    boolean,
    | STREAM_NOT_FOUND
    | FAILED_TO_APPEND_EVENT
    | FAILED_TO_APPEND_SNAPSHOT
    | TError
    | never
  >
> {
  const eventStore = getEventStore();

  const handleCommand = async () => {
    return handle(command);
  };

  const appendNewEvent = transformResults(
    async (newEvent: CashRegisterEvent) =>
      appendToStream(eventStore, streamName, [newEvent]),
    ({ nextExpectedRevision }, newEvent) => {
      return {
        newEvent,
        currentStreamVersion: nextExpectedRevision,
      };
    }
  );

  const tryBuildSnapshot = async (params: {
    currentStreamVersion: bigint;
    newEvent: CashRegisterEvent;
  }) => buildSnapshot(params);

  const appendSnapshot = ({ snapshot }: { snapshot: CashRegisterSnapshoted }) =>
    appendSnapshotToStreamWithPrefix(eventStore, snapshot, streamName);

  return ignoreSnapshotSkipped(
    pipeResultAsync(
      handleCommand,
      appendNewEvent,
      tryBuildSnapshot,
      appendSnapshot,
      async (_) => success(true)
    )
  );
}
