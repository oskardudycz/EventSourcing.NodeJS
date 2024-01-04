export * from './readEventsFromExternalSnapshot';
export * from './readEventsFromSnapshotInSeparateStream';
export * from './readEventsFromSnapshotInTheSameStream';
export * from './readSnapshotFromSeparateStream';
export * from './getLastSnapshotVersionFromStreamMetadata';

import { Event, StreamEvent } from '../../../events';

export type ReadFromStreamAndSnapshotsResult<
  StreamEventType extends Event = Event,
> = {
  events: StreamEvent<StreamEventType>[];
  lastSnapshotVersion?: bigint;
};
