import { TimeoutError } from './timeoutError';

export type TransientFailures = {
  failIfUnavailable: () => void;
};

// Fails at a random call, then again after 2 to 4 calls, so failures land in a different place on every run, but never twice in a row
export const getTransientFailures = (message: string): TransientFailures => {
  let callsUntilFailure = nextGap();

  return {
    failIfUnavailable: () => {
      if (--callsUntilFailure > 0) return;

      callsUntilFailure = nextGap();
      throw new TimeoutError(message);
    },
  };
};

const nextGap = () => 2 + Math.floor(Math.random() * 3);
