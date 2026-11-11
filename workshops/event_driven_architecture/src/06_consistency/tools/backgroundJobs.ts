import type { MessageCatcher } from './messageCatcher';
import { TimeoutError } from './timeoutError';

export type BackgroundJob = () => Promise<void>;

export interface BackgroundJobs {
  register: (job: BackgroundJob) => void;
  run: () => Promise<void>;
}

export const getBackgroundJobs = (): BackgroundJobs => {
  const jobs: BackgroundJob[] = [];

  return {
    register: (job: BackgroundJob): void => {
      jobs.push(job);
    },
    run: async (): Promise<void> => {
      for (const job of jobs) await job();
    },
  };
};

// Applications run background jobs all the time. Tests run them until they succeed and stop publishing new messages
export const runBackgroundJobsUntilIdle = async (
  backgroundJobs: BackgroundJobs,
  publishedMessages: MessageCatcher,
): Promise<void> => {
  for (let run = 0; run < 100; run++) {
    const publishedBefore = publishedMessages.count();

    try {
      await backgroundJobs.run();
    } catch (error) {
      if (error instanceof TimeoutError) continue;
      throw error;
    }

    if (publishedMessages.count() === publishedBefore) return;
  }

  throw new Error('Background jobs keep failing or publishing messages');
};
