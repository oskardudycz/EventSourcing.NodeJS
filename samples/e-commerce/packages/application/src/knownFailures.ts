import { it } from 'vitest';

const timeoutInMs = 10_000;

type KnownFailureRun = (signal: AbortSignal) => unknown;

export const failsOnEmmett =
  (...issues: [`#${number}`, ...`#${number}`[]]) =>
  (name: string, run: KnownFailureRun) =>
    it.concurrent.fails(
      `${name} [Emmett ${issues.join(', ')}]`,
      ({ signal }) => run(signal),
      timeoutInMs,
    );
