import { NextFunction, Request, Response } from 'express';
import { ETag, ETagErrors, toWeakETag } from './eTag';
import { AppendResult } from './streams';

//////////////////////////////////////
/// ETAG
//////////////////////////////////////

export const getETagFromIfMatch = (request: Request): ETag => {
  const etag = request.headers['if-match'];

  if (etag === undefined) {
    throw ETagErrors.MISSING_IF_MATCH_HEADER;
  }

  return etag;
};

//////////////////////////////////////
/// HTTP Helpers
//////////////////////////////////////

export const HTTPHandler =
  <Command, RequestType extends Request = Request>(
    handleCommand: (
      recordId: string,
      command: Command,
      eTag?: ETag,
    ) => Promise<AppendResult>,
  ) =>
  (
    mapRequest: (
      request: RequestType,
      handler: (recordId: string, command: Command) => Promise<void>,
    ) => Promise<void>,
  ) =>
  async (request: RequestType, response: Response, next: NextFunction) => {
    try {
      await mapRequest(request, async (recordId, command) => {
        const result = await handleCommand(
          recordId,
          command,
          getETagFromIfMatch(request),
        );

        return mapToResponse(response, recordId, result);
      });
    } catch (error) {
      next(error);
    }
  };

export const sendCreated = (
  response: Response,
  createdId: string,
  urlPrefix?: string,
): void => {
  response.setHeader(
    'Location',
    `${urlPrefix ?? response.req.url}/${createdId}`,
  );
  response.status(201).json({ id: createdId });
};

export const mapToResponse = (
  response: Response,
  recordId: string,
  result: AppendResult,
  urlPrefix?: string,
): void => {
  if (!result.successful) {
    response.sendStatus(412);
    return;
  }

  response.set('ETag', toWeakETag(result.nextExpectedRevision));

  if (result.nextExpectedRevision == toWeakETag(0)) {
    sendCreated(response, recordId, urlPrefix);
    return;
  }

  response.status(200);
};
