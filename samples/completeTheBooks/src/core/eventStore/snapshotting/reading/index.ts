export * from './readEventsFromExternalSnapshot';
export * from './readEventsFromSnapshotInSeparateStream';
export * from './readEventsFromSnapshotInTheSameStream';
export * from './readSnapshotFromSeparateStream';
export * from './getLastSnapshotVersionFromStreamMetadata';

import { Event } from '../../../events';

export type ReadFromStreamAndSnapshotsResult<
  StreamEvent extends Event = Event
> = {
  events: StreamEvent[];
  lastSnapshotVersion?: bigint;
};
