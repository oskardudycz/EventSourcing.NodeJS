import { sleep } from '#core/primitives';

export type RetryOptions = Readonly<{
  maxRetries?: number;
  delay?: number;
  shouldRetry?: (error: any) => boolean;
}>;

export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 5,
  delay: 100,
  shouldRetry: () => true,
};

export async function retryPromise<T = never>(
  callback: () => Promise<T>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<T> {
  let retryCount = 0;
  const { maxRetries, delay, shouldRetry } = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  do {
    try {
      return await callback();
    } catch (error) {
      if (!shouldRetry(error) || retryCount == maxRetries) {
        console.error(`[retry] Exceeded max retry count, throwing: ${error}`);
        throw error;
      }

      const sleepTime = Math.pow(2, retryCount) * delay + Math.random() * delay;

      console.warn(
        `[retry] Retrying (number: ${
          retryCount + 1
        }, delay: ${sleepTime}): ${error}`
      );

      await sleep(sleepTime);
      retryCount++;
    }
  } while (true);
}

declare global {
  interface Promise<T> {
    withTimeout(timeout: number): Promise<T>;
  }
}

export type TIMEOUT_ERROR = 'TIMEOUT_ERROR';

Promise.prototype.withTimeout = function <T>(timeout: number) {
  return Promise.race<T>([
    this,
    new Promise(function (_resolve, reject) {
      setTimeout(function () {
        reject('TIMEOUT_ERROR');
      }, timeout);
    }),
  ]);
};
