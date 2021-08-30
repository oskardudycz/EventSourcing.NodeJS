import { Command } from '#core/commands';
import { Result, success, getCurrentTime } from '#core/primitives';
import { StreamArchivisationScheduled } from 'src/archivisation/schedulingArchivisation/eventHandler';
import { getArchivisationForStreamName } from '..';

export type ArchiveStream = Command<
  'archive-stream',
  {
    streamName: string;
    archiveBeforeRevision: bigint;
  }
>;

export function handleArchiveStream(
  command: ArchiveStream
): Result<StreamArchivisationScheduled> {
  const { streamName, archiveBeforeRevision } = command.data;

  const toStreamName = getArchivisationForStreamName(streamName);

  return success({
    type: 'stream-archivisation-scheduled',
    data: {
      streamName,
      toStreamName,
      archiveBeforeRevision: archiveBeforeRevision.toString(),
      scheduledAt: getCurrentTime(),
    },
  });
}
