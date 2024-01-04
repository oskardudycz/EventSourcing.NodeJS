import { Command } from '#core/commands';
import { Result, success, getCurrentTime } from '#core/primitives';
import { StreamArchivisationScheduled } from 'src/archivisation/schedulingArchivisation/eventHandler';
import { getCurrentCashierShiftStreamName } from '../cashierShift';

export type ArchiveClosedCashierShift = Command<
  'archive-closed-cashier-shift',
  {
    cashRegisterId: string;
    archiveBeforeRevision: bigint;
  }
>;

export function handleArchiveClosedCashierShift(
  command: ArchiveClosedCashierShift,
): Result<StreamArchivisationScheduled> {
  return success({
    type: 'stream-archivisation-scheduled',
    data: {
      streamName: getCurrentCashierShiftStreamName(command.data.cashRegisterId),
      archiveBeforeRevision: command.data.archiveBeforeRevision.toString(),
      scheduledAt: getCurrentTime(),
    },
  });
}
