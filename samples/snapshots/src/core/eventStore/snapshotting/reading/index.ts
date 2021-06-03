export * from './readFromSnapshotAndStream';
export * from './readSnapshotFromSeparateStream';

import { Event } from '../../../events';

export type ReadFromStreamAndSnapshotsResult<
  StreamEvent extends Event = Event
> = {
  events: StreamEvent[];
  lastSnapshotVersion?: bigint;
};
