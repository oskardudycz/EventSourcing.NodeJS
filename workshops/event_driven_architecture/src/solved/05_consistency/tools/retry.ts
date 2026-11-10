import { TimeoutError } from './timeoutError';

const maxAttempts = 10;

export const retryUntilSucceeds = (operation: () => void): void => {
  for (let attempt = 1; ; attempt++) {
    try {
      operation();
      return;
    } catch (error) {
      if (!(error instanceof TimeoutError) || attempt >= maxAttempts)
        throw error;
    }
  }
};
