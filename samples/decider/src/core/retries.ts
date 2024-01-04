//////////////////////////////////////
/// Retries
//////////////////////////////////////

export type RetryOptions = Readonly<{
  maxRetries?: number;
  delay?: number;
  shouldRetry?: (error: unknown) => boolean;
}>;

export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 5,
  delay: 100,
  shouldRetry: () => true,
};

export const sleep = async (timeout: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, timeout));
};

export const retryPromise = async <T = never>(
  callback: () => Promise<T>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS,
): Promise<T> => {
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
        console.error(`[retry] Exceeded max retry count, throwing:`);
        console.error(error);
        throw error;
      }

      const sleepTime = Math.pow(2, retryCount) * delay + Math.random() * delay;

      console.warn(
        `[retry] Retrying (number: ${retryCount + 1}, delay: ${sleepTime})`,
      );
      console.warn(error);

      await sleep(sleepTime);
      retryCount++;
    }
  } while (retryCount != maxRetries);

  throw '[retry] Exceeded max retry count';
};
