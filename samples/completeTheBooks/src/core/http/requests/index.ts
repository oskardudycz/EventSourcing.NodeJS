import { Request } from 'express';
import { Result, success } from '../../primitives';

export type WeakETag = string;
export type ETag = WeakETag | string;

export const WeakETagRegex = /W\/"\d+.*"/;
export type WRONG_WEAK_ETAG_FORMAT = 'WRONG_WEAK_ETAG_FORMAT';

export function isWeakETag(etag: ETag): etag is WeakETag {
  return WeakETagRegex.test(etag);
}

export function getWeakETagValue(etag: ETag): string {
  return WeakETagRegex.exec(etag)![1];
}

export function getETagFromIfMatch(request: Request): ETag | undefined {
  return <ETag | undefined>request.headers['If-Match'];
}

export function getWeakETagFromIfMatch(
  request: Request
): Result<string | undefined, WRONG_WEAK_ETAG_FORMAT> {
  const etag = getETagFromIfMatch(request);

  if (!etag) return success(undefined);

  if (!isWeakETag(etag)) return fail('WRONG_WEAK_ETAG_FORMAT');

  const eTagValue = getWeakETagValue(etag);

  return success(eTagValue);
}
