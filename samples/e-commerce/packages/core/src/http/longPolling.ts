import { asyncRetry } from '@event-driven-io/emmett';

export const longPollingDeadlineInMs = 1000;

export const retryUntil = async <Document>(
  find: () => Promise<Document | null | undefined>,
  isReady: (document: Document) => boolean,
  deadlineInMs: number = longPollingDeadlineInMs,
): Promise<Document | null | undefined> => {
  let lastFound: Document | null | undefined;
  let failure: Error | undefined;

  try {
    return await asyncRetry(
      async () => {
        try {
          lastFound = await find();
        } catch (error) {
          failure = error instanceof Error ? error : new Error(String(error));
          throw error;
        }
        return lastFound;
      },
      {
        forever: true,
        minTimeout: 100,
        factor: 2,
        randomize: true,
        maxRetryTime: deadlineInMs,
        shouldRetryResult: (found) => !found || !isReady(found),
        shouldRetryError: () => failure === undefined,
      },
    );
  } catch {
    if (failure) throw failure;
    return lastFound;
  }
};

export const retryIfNotFound = <Document>(
  find: () => Promise<Document | null | undefined>,
  deadlineInMs?: number,
) => retryUntil(find, () => true, deadlineInMs);
