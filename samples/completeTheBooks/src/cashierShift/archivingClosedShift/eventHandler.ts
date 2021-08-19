import { Result, success } from '#core/primitives';
import { StreamEvent } from '#core/events';
import { getEventStore } from '#core/eventStore';
import {
  appendToStream,
  FAILED_TO_APPEND_EVENT,
} from '#core/eventStore/appending';
import {
  ArchiveClosedCashierShift,
  handleArchiveClosedCashierShift,
} from './handler';
import { isShiftOpened } from '../openingShift';
import { getArchivisationScheduleStreamName } from '../../archivisation/schedulingArchivisation/handler';

export async function handleCashierShiftOpened(
  streamEvent: StreamEvent
): Promise<Result<boolean, FAILED_TO_APPEND_EVENT>> {
  const { event, streamRevision } = streamEvent;

  if (!isShiftOpened(event)) {
    return success(false);
  }
  const cashRegisterId = event.data.cashRegisterId;

  const command: ArchiveClosedCashierShift = {
    type: 'archive-closed-cashier-shift',
    data: {
      cashRegisterId,
      archiveBeforeRevision: streamRevision,
    },
  };

  const handlingResult = handleArchiveClosedCashierShift(command);

  if (handlingResult.isError) {
    return handlingResult;
  }

  const archiveScheduleStreamName = getArchivisationScheduleStreamName();
  const archivingScheduled = handlingResult.value;

  const result = await appendToStream(
    getEventStore(),
    archiveScheduleStreamName,
    [archivingScheduled]
  );

  if (result.isError) {
    return result;
  }

  return success(true);
}
