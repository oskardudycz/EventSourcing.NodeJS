import { Event } from '../../events';

export type SnapshotMetadata = Readonly<{
  snapshottedStreamVersion: string;
}>;

export type SnapshotEvent<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>,
  EventMetadata extends SnapshotMetadata = SnapshotMetadata,
> = Event<EventType, EventData, EventMetadata> &
  Readonly<{
    metadata: EventMetadata;
  }>;
