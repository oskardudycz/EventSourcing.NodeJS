import { Request } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { failure, Result, success } from '../../primitives';

export type ApiRequest = Request<
  Record<string, unknown> | ParamsDictionary,
  unknown,
  unknown,
  Record<string, unknown> | qs.ParsedQs
>;

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
  const weak = WeakETagRegex.exec(etag);
  if (weak == null || weak.length == 0)
    throw new Error('WRONG_WEAK_ETAG_FORMAT');
  return weak[1] as WeakETag;
}

export function toWeakETag(value: number | bigint | string): WeakETag {
  return `W/"${value}"`;
}

export function getETagFromIfMatch(
  request: ApiRequest
): Result<ETag, MISSING_IF_MATCH_HEADER> {
  const etag = request.headers['if-match'];

  if (etag === undefined) {
    return failure('MISSING_IF_MATCH_HEADER');
  }
  return success(etag);
}

export function getWeakETagValueFromIfMatch(
  request: ApiRequest
): Result<string, WRONG_WEAK_ETAG_FORMAT | MISSING_IF_MATCH_HEADER> {
  const etag = getETagFromIfMatch(request);

  if (etag.isError) return etag;

  if (!isWeakETag(etag.value)) return fail('WRONG_WEAK_ETAG_FORMAT');

  const eTagValue = getWeakETagValue(etag.value);

  return success(eTagValue);
}

export * from './retries';
