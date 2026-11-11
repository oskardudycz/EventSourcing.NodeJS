import { ConcurrencyError } from './concurrencyError';

const maxAttempts = 10;

export const retryOnConflict = async <T>(
  operation: () => Promise<T>,
): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof ConcurrencyError) || attempt >= maxAttempts)
        throw error;
    }
  }
};
