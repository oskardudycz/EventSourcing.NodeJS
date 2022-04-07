import { Request, Response } from 'express';
import { assertUnsignedBigInt } from './validation';

//////////////////////////////////////
/// ETAG
//////////////////////////////////////

type WeakETag = `W/${string}`;
type ETag = WeakETag | string;

const enum HeaderNames {
  IF_MATCH = 'if-match',
  IF_NOT_MATCH = 'if-not-match',
}

export const WeakETagRegex = /W\/"(\d+.*)"/;

export const enum ETagErrors {
  WRONG_WEAK_ETAG_FORMAT = 'WRONG_WEAK_ETAG_FORMAT',
  MISSING_HEADER = 'MISSING_HEADER',
}

export const isWeakETag = (etag: ETag): etag is WeakETag => {
  return WeakETagRegex.test(etag);
};

export const getWeakETagValue = (etag: ETag): WeakETag => {
  const weak = WeakETagRegex.exec(etag);
  if (weak == null || weak.length == 0) throw ETagErrors.WRONG_WEAK_ETAG_FORMAT;
  return weak[1] as WeakETag;
};

export const toWeakETag = (value: unknown): WeakETag => {
  return `W/"${value}"`;
};

export const getETagFromHeader = (
  request: Request,
  headerName: HeaderNames
): ETag | undefined => {
  const etag = request.headers[headerName];

  if (etag === undefined) {
    return undefined;
  }

  return Array.isArray(etag) ? etag[0] : etag;
};

export const getWeakETagValueFromHeader = (
  request: Request,
  headerName: HeaderNames
): WeakETag | undefined => {
  const etag = getETagFromHeader(request, headerName);

  if (etag === undefined) {
    return undefined;
  }

  if (!isWeakETag(etag)) {
    throw ETagErrors.WRONG_WEAK_ETAG_FORMAT;
  }

  return getWeakETagValue(etag);
};

export const getExpectedRevision = (
  request: Request,
  headerName: HeaderNames
): bigint | undefined => {
  const eTag = getWeakETagValueFromHeader(request, headerName);

  if (eTag === undefined) {
    return undefined;
  }

  return assertUnsignedBigInt(eTag);
};

export const getExpectedRevisionFromIfMatch = (request: Request): bigint => {
  const revision = getExpectedRevision(request, HeaderNames.IF_MATCH);

  if (revision === undefined) {
    throw ETagErrors.MISSING_HEADER;
  }

  return revision;
};

export const getExpectedRevisionFromIfNotMatch = (
  request: Request
): bigint | undefined => getExpectedRevision(request, HeaderNames.IF_NOT_MATCH);

//////////////////////////////////////
/// HTTP Helpers
//////////////////////////////////////

export const sendCreated = (
  response: Response,
  createdId: string,
  urlPrefix?: string
): void => {
  response.setHeader(
    'Location',
    `${urlPrefix ?? response.req.url}/${createdId}`
  );
  response.status(201).json({ id: createdId });
};
