export type Range = Readonly<{
  from: bigint;
  to: bigint;
}>;

export const WRONG_RANGE = 'WRONG_RANGE';
export const WRONG_CHUNK_SIZE = 'WRONG_CHUNK_SIZE';

export const DefaultChunkSize = 100;

export function getNumberRanges(
  from: bigint,
  to: bigint,
  chunkSize: number = DefaultChunkSize
): Range[] {
  const difference = to - from;

  if (to < 0 || from < 0 || difference < 0) throw WRONG_RANGE;

  if (chunkSize < 0) throw WRONG_CHUNK_SIZE;

  const chunkSizeBI = BigInt(chunkSize);
  let numberOfChunks = difference / chunkSizeBI;
  let currentFrom = from;

  const ranges: Range[] = [];

  do {
    const currentTo = currentFrom + chunkSizeBI;

    ranges.push({
      from: currentTo,
      to: currentTo < to ? currentTo : to,
    });

    currentFrom += chunkSizeBI;
    numberOfChunks--;
  } while (numberOfChunks > 0);

  return ranges;
}
