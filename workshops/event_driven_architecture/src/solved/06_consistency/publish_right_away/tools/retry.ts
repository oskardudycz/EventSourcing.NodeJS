import { ConcurrencyError } from './concurrencyError';
import { TimeoutError } from './timeoutError';

const maxAttempts = 10;

const retry =
  (shouldRetry: (error: unknown) => boolean) =>
  async <T>(operation: () => Promise<T>): Promise<T> => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (!shouldRetry(error) || attempt >= maxAttempts) throw error;
      }
    }
  };

export const retryOnConflict = retry(
  (error) => error instanceof ConcurrencyError,
);

export const retryUntilSucceeds = retry(
  (error) => error instanceof TimeoutError,
);
