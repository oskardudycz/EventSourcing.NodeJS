import { Request, Response } from 'express';
//import { assertUnsignedBigInt } from './validation';

export const enum HeaderNames {
  IF_MATCH = 'if-match',
  IF_NOT_MATCH = 'if-not-match',
  ETag = 'etag',
}

export type WeakETag = `W/${string}`;
export type ETag = string;

export const WeakETagRegex = /W\/"(-?\d+.*)"/;

export const enum ETagErrors {
  WRONG_WEAK_ETAG_FORMAT = 'WRONG_WEAK_ETAG_FORMAT',
  MISSING_IF_MATCH_HEADER = 'MISSING_IF_MATCH_HEADER',
  MISSING_IF_NOT_MATCH_HEADER = 'MISSING_IF_NOT_MATCH_HEADER',
}

export const isWeakETag = (etag: ETag): etag is WeakETag => {
  return WeakETagRegex.test(etag);
};

export const getWeakETagValue = (etag: ETag): string => {
  const result = WeakETagRegex.exec(etag);
  if (result === null || result.length === 0) {
    throw new Error(ETagErrors.WRONG_WEAK_ETAG_FORMAT);
  }
  return result[1];
};

export const toWeakETag = (value: number | bigint | string): WeakETag => {
  return `W/"${value}"`;
};

export const getETagFromIfMatch = (request: Request): ETag => {
  const etag = request.headers[HeaderNames.IF_MATCH];

  if (etag === undefined) {
    throw new Error(ETagErrors.MISSING_IF_MATCH_HEADER);
  }

  return etag;
};

export const getETagFromIfNotMatch = (request: Request): ETag => {
  const etag = request.headers[HeaderNames.IF_NOT_MATCH];

  if (etag === undefined) {
    throw new Error(ETagErrors.MISSING_IF_MATCH_HEADER);
  }

  return Array.isArray(etag) ? etag[0] : etag;
};

export const setETag = (response: Response, etag: ETag): void => {
  response.setHeader(HeaderNames.ETag, etag);
};

// export const getExpectedRevision = (request: Request): bigint => {
//   const eTag = getETagFromIfMatch(request);
//   const weakEtag = getWeakETagValue(eTag);

//   return assertUnsignedBigInt(weakEtag);
// };

// export const setNextExpectedRevision = (response: Response, nextEspectedRevision): void => {
//   const eTag = getETagFromIfMatch(response);
//   const weakEtag = getWeakETagValue(eTag);

//   return assertUnsignedBigInt(weakEtag);
// };
