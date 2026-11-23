import type { TestClock } from './apiE2ESpecification';

export const manualClock = (start: Date): TestClock => {
  let current = start;

  return {
    now: () => current,
    advanceBy: (milliseconds) => {
      current = new Date(current.getTime() + milliseconds);
    },
  };
};
