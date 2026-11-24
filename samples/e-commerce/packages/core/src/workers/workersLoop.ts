import { delayOrAbort } from '@event-driven-io/emmett';

export type Worker = {
  handle: (now: Date) => void | Promise<void>;
};

export const oneMinuteInMs = 60_000;

export const workersLoop = async ({
  workers,
  now,
  signal,
  intervalInMs = oneMinuteInMs,
  onError = (error) => console.error('Worker failed', error),
}: {
  workers: readonly Worker[];
  now: () => Date;
  signal: AbortSignal;
  intervalInMs?: number;
  onError?: (error: unknown) => void;
}): Promise<void> => {
  while (!signal.aborted) {
    await delayOrAbort(intervalInMs, signal);

    if (signal.aborted) return;

    for (const worker of workers)
      try {
        await worker.handle(now());
      } catch (error) {
        onError(error);
      }
  }
};
