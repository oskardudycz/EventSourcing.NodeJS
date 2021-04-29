export type SnapshotMetadata = {
  streamVersion: bigint;
};

export type SnapshotEvent<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>,
  EventMetadata extends SnapshotMetadata &
    Record<string, unknown> = SnapshotMetadata & Record<string, unknown>
> = Readonly<{
  type: Readonly<EventType>;
  data: Readonly<EventData>;
  metadata: Readonly<EventMetadata>;
}>;
