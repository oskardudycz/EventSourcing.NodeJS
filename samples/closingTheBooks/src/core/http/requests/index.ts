import type { Request } from 'express';
import type { Result } from '../../primitives';
import { failure, success } from '../../primitives';

export type WeakETag = string;
export type ETag = WeakETag;

export const WeakETagRegex = /W\/"(\d+.*)"/;
export type WRONG_WEAK_ETAG_FORMAT = 'WRONG_WEAK_ETAG_FORMAT';
export type MISSING_IF_MATCH_HEADER = 'MISSING_IF_MATCH_HEADER';

export function isWeakETag(etag: ETag): etag is WeakETag {
  return WeakETagRegex.test(etag);
}

export function getWeakETagValue(etag: ETag): string {
  return WeakETagRegex.exec(etag)![1];
}

export function toWeakETag(value: number | bigint | string): WeakETag {
  return `W/"${value}"`;
}

export function getETagFromIfMatch(
  request: Request,
): Result<WeakETag, MISSING_IF_MATCH_HEADER> {
  const etag = request.headers['if-match'];

  if (etag === undefined) {
    return failure('MISSING_IF_MATCH_HEADER');
  }
  return success(etag);
}

export function getWeakETagFromIfMatch(
  request: Request,
): Result<WeakETag, WRONG_WEAK_ETAG_FORMAT | MISSING_IF_MATCH_HEADER> {
  const etag = getETagFromIfMatch(request);

  if (etag.isError) return etag;

  if (!isWeakETag(etag.value)) return failure('WRONG_WEAK_ETAG_FORMAT');

  const eTagValue = getWeakETagValue(etag.value);

  return success(eTagValue);
}
