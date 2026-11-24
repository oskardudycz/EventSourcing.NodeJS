import { describe, expect, it } from 'vitest';
import { workersLoop, type Worker } from './workersLoop';

const untilCalled = async (calls: Date[], count: number) => {
  while (calls.length < count)
    await new Promise((resolve) => setTimeout(resolve, 5));
};

describe('workers loop', () => {
  it('workersRunEveryInterval', async () => {
    const calls: Date[] = [];
    const worker: Worker = { handle: (now) => void calls.push(now) };
    const shutdown = new AbortController();
    const now = new Date('2026-01-01T10:00:00.000Z');

    const running = workersLoop({
      workers: [worker],
      now: () => now,
      intervalInMs: 20,
      signal: shutdown.signal,
    });
    await untilCalled(calls, 3);
    shutdown.abort();
    await running;

    expect(calls.slice(0, 3)).toEqual([now, now, now]);
  });

  it('shutdownStopsTheWorkersLoop', async () => {
    const calls: Date[] = [];
    const shutdown = new AbortController();

    const running = workersLoop({
      workers: [{ handle: (now) => void calls.push(now) }],
      now: () => new Date(),
      intervalInMs: 10,
      signal: shutdown.signal,
    });
    await untilCalled(calls, 1);
    shutdown.abort();
    await running;
    const callsAfterStop = calls.length;
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(calls.length).toBe(callsAfterStop);
  });

  it('aWorkerFailureDoesNotStopTheLoop', async () => {
    const calls: Date[] = [];
    const failures: unknown[] = [];
    const shutdown = new AbortController();
    const failing: Worker = {
      handle: () => {
        throw new Error('worker failed');
      },
    };

    const running = workersLoop({
      workers: [failing, { handle: (now) => void calls.push(now) }],
      now: () => new Date(),
      intervalInMs: 10,
      signal: shutdown.signal,
      onError: (error) => failures.push(error),
    });
    await untilCalled(calls, 2);
    shutdown.abort();
    await running;

    expect(failures.length).toBeGreaterThanOrEqual(calls.length);
    expect(failures[0]).toEqual(new Error('worker failed'));
  });
});
