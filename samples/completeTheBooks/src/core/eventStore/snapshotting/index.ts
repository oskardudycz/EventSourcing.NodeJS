export * from './snapshotEvent';
export * from './reading';
export * from './appending';

export function addSnapshotPrefix(streamName: string): string {
  return `snapshot-${streamName}`;
}
