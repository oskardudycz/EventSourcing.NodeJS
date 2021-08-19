import { Event } from '#core/events';

export type StreamArchivisationScheduled = Event<
  'stream-archivisation-scheduled',
  {
    streamName: string;
    archiveBeforeRevision: string;
    scheduledAt: Date;
  }
>;
