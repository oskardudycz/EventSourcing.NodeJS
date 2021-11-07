import { Request } from 'express';
import { failure, Result, success } from '../../primitives';

export type WeakETag = `W/${string}`;
export type ETag = WeakETag | string;

export const WeakETagRegex = /W\/"(\d+.*)"/;

export type WRONG_WEAK_ETAG_FORMAT = 'WRONG_WEAK_ETAG_FORMAT';
export type MISSING_IF_MATCH_HEADER = 'MISSING_IF_MATCH_HEADER';

export type WRONG_ETAG = WRONG_WEAK_ETAG_FORMAT | MISSING_IF_MATCH_HEADER;

export function isWeakETag(etag: ETag): etag is WeakETag {
  return WeakETagRegex.test(etag);
}

export function getWeakETagValue(etag: ETag): string {
  return WeakETagRegex.exec(etag)![1];
}

export function toWeakETag(value: any): WeakETag {
  return `W/"${value}"`;
}

export function getETagFromIfMatch(
  request: Request
): Result<ETag, MISSING_IF_MATCH_HEADER> {
  const etag = request.headers['if-match'];

  if (etag === undefined) {
    return failure('MISSING_IF_MATCH_HEADER');
  }
  return success(<ETag>etag);
}

export function getWeakETagValueFromIfMatch(
  request: Request
): Result<string, WRONG_WEAK_ETAG_FORMAT | MISSING_IF_MATCH_HEADER> {
  const etag = getETagFromIfMatch(request);

  if (etag.isError) return etag;

  if (!isWeakETag(etag.value)) return fail('WRONG_WEAK_ETAG_FORMAT');

  const eTagValue = getWeakETagValue(etag.value);

  return success(eTagValue);
}

export * from './retries';
