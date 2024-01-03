import { failure, Result, success } from '../../../primitives';

export * from './appendEventAndExternalSnapshot';
export * from './appendEventAndSnapshotToStreamWithPrefix';
// export * from './appendSnapshotOnSubscription';
export * from './appendSnapshotToStreamWithPrefix';
export * from './appendSnapshotToTheSameStream';

export type FAILED_TO_APPEND_SNAPSHOT = 'FAILED_TO_APPEND_SNAPSHOT';

export type SNAPSHOT_CREATION_SKIPPED = 'SNAPSHOT_CREATION_SKIPPED';

export async function ignoreSnapshotSkipped<T = never, E = never>(
  result: Result<T, E | SNAPSHOT_CREATION_SKIPPED>,
): Promise<Result<boolean, E>> {
  if (result.isError) {
    if (result.error === 'SNAPSHOT_CREATION_SKIPPED') return success(false);
    return failure(result.error);
  }

  return success(true);
}
