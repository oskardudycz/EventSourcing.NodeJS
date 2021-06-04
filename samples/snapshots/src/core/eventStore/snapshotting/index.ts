import { failure, Result, success } from '../../primitives/result';

export * from './snapshotEvent';
export * from './reading';
export * from './appending';

export const addSnapshotPrefix = function <
  Aggregate,
  StreamEvent extends Event
>(streamName: string): string {
  return `snapshot-${streamName}`;
};

export type SNAPSHOT_CREATION_SKIPPED = 'SNAPSHOT_CREATION_SKIPPED';

export async function ignoreSnapshotSkipped<T = never, E = never>(
  getResult: () => Promise<Result<T, E | SNAPSHOT_CREATION_SKIPPED>>
): Promise<Result<boolean, E>> {
  const result = await getResult();

  if (result.isError) {
    if (result.error === 'SNAPSHOT_CREATION_SKIPPED') return success(false);
    return failure(result.error);
  }

  return success(true);
}
