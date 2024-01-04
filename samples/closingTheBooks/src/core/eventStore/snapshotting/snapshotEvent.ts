import { Event } from '../../events';
export type SnapshotMetadata = {
  snapshottedStreamVersion: string;
};

export type SnapshotEvent<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>,
  EventMetadata extends SnapshotMetadata &
    Record<string, unknown> = SnapshotMetadata & Record<string, unknown>,
> = Event<EventType, EventData, EventMetadata> &
  Readonly<{
    metadata: Readonly<EventMetadata>;
  }>;
