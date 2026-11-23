import { asyncRetry, type AsyncRetryOptions } from '@event-driven-io/emmett';

export type HandlerRetryOptions = {
  retry?: AsyncRetryOptions;
  signal?: AbortSignal;
};

export const defaultHandlerRetry: AsyncRetryOptions = {
  forever: true,
  factor: 2,
  minTimeout: 1000,
  maxTimeout: 30_000,
};

export const retryInHandler = <Result>(
  handle: () => Promise<Result>,
  { retry, signal }: HandlerRetryOptions,
): Promise<Result> =>
  asyncRetry(
    () => {
      if (signal?.aborted) throw new Error('The processor was closed');

      return handle();
    },
    {
      ...defaultHandlerRetry,
      ...retry,
      shouldRetryError: (error) =>
        !signal?.aborted && (retry?.shouldRetryError?.(error) ?? true),
    },
  );
