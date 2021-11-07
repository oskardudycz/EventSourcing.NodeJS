import { sleep } from '#core/primitives';

export type RetryOptions = Readonly<{
  maxRetries?: number;
  delay?: number;
  isRetryAble?: (error: any) => boolean;
}>;

export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 5,
  delay: 100,
  isRetryAble: () => true,
};

export async function retryPromise<T = never>(
  callback: () => Promise<T>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<T> {
  let retryCount = 0;
  const { maxRetries, delay, isRetryAble } = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  do {
    try {
      return await callback();
    } catch (error) {
      if (!isRetryAble(error) || retryCount == maxRetries) {
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
