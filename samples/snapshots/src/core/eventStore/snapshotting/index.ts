export * from './snapshotEvent';
export * from './reading';
export * from './appending';

export const addSnapshotPrefix = function <
  Aggregate,
  StreamEvent extends Event
>(streamName: string): string {
  return `snapshot-${streamName}`;
};
