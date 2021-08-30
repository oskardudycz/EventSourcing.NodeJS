export function getArchivisationScheduleStreamName(): string {
  return 'archivisation-schedule';
}

export function getArchivisationForStreamName(streamName: string): string {
  return `archivisation_for-${streamName}`;
}

// export async function getFirstEventToArchiveStreamRevision(
//   eventStore: EventStoreDBClient,
//   streamName: string
// ): Promise<Result<bigint, STREAM_NOT_FOUND>> {
//   const archivisationForStreamName = getArchivisationForStreamName(streamName);

//   let revision: bigint | undefined;

//   const lastEvent = await readLastEventFromStream(
//     eventStore,
//     archivisationForStreamName
//   );

//   if (lastEvent.isError && lastEvent.error === 'STREAM_NOT_FOUND') {
//     return failure('STREAM_NOT_FOUND');
//   }

//   revision = !lastEvent.isError ? lastEvent.value.streamRevision : undefined;

//   if (revision !== undefined) {
//     return success(revision);
//   }

// }
