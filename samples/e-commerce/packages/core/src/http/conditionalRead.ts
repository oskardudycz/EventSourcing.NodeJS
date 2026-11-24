import {
  setETag,
  toWeakETag,
  WeakETagRegex,
} from '@event-driven-io/emmett-honojs';
import type { Context } from 'hono';
import { retryUntil } from './longPolling';

export type Versioned = { version: number };

export const versionSeenBy = (context: Context): number => {
  const version = WeakETagRegex.exec(
    context.req.header('if-none-match') ?? '',
  )?.[1];

  return version === undefined ? Number.NEGATIVE_INFINITY : Number(version);
};

export const newerThan = async <Document extends Versioned>(
  context: Context,
  find: () => Promise<Document | null | undefined>,
  options: { whenMissing: () => Error; deadlineInMs?: number },
): Promise<Response> => {
  const seen = versionSeenBy(context);
  const document = await retryUntil(
    find,
    (found) => found.version > seen,
    options.deadlineInMs,
  );

  if (!document) throw options.whenMissing();

  setETag(context, toWeakETag(document.version));

  if (document.version <= seen) return context.body(null, 304);

  return context.json(document);
};
