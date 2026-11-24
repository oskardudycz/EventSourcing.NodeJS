import { describe, expect, it } from 'vitest';
import { deliveryLedger } from './deliveryLedger';

describe('delivery ledger', () => {
  it('settlesADeliveryOnlyAfterEveryProcessorStoredItsCheckpoint', async () => {
    const settled: string[] = [];
    const ledger = deliveryLedger<string>({
      settle: (deliveries) => {
        settled.push(...deliveries);
        return Promise.resolve();
      },
    });
    ledger.processorStarted('fast');
    ledger.processorStarted('slow');
    const first = ledger.deliver('first');

    await ledger.processed('fast', first);
    expect(settled).toEqual([]);

    await ledger.processed('slow', first);
    expect(settled).toEqual(['first']);
  });

  it('aStoppedProcessorDoesNotHoldBackTheOthers', async () => {
    const settled: string[] = [];
    const ledger = deliveryLedger<string>({
      settle: (deliveries) => {
        settled.push(...deliveries);
        return Promise.resolve();
      },
    });
    let stoppedIsActive = true;
    ledger.track('stopped', () => stoppedIsActive);
    ledger.processorStarted('stopped');
    ledger.processorStarted('running');
    const first = ledger.deliver('first');
    const second = ledger.deliver('second');

    await ledger.processed('running', first);
    stoppedIsActive = false;
    await ledger.processed('running', second);

    expect(settled).toEqual(['first', 'second']);
  });

  it('aFailedSettleDoesNotStopLaterOnesAndIsRetriedWithThem', async () => {
    const settled: string[] = [];
    let failures = 1;
    const ledger = deliveryLedger<string>({
      settle: (deliveries) => {
        if (failures-- > 0) return Promise.reject(new Error('commit failed'));
        settled.push(...deliveries);
        return Promise.resolve();
      },
    });
    ledger.processorStarted('processor');
    const first = ledger.deliver('first');
    const second = ledger.deliver('second');

    await ledger.processed('processor', first);
    expect(settled).toEqual([]);

    await ledger.processed('processor', second);
    expect(settled).toEqual(['first', 'second']);
  });

  it('skippedDeliveriesSettleWithoutAProcessor', async () => {
    const settled: string[] = [];
    const ledger = deliveryLedger<string>({
      settle: (deliveries) => {
        settled.push(...deliveries);
        return Promise.resolve();
      },
    });

    await ledger.skip(ledger.deliver('unreadable'));

    expect(settled).toEqual(['unreadable']);
  });

  it('theCheckpointAfterPendingMessagesFollowsTheDeliveredOnes', () => {
    const ledger = deliveryLedger<string>({ settle: () => Promise.resolve() });
    expect(ledger.checkpointAfter(0n)).toBeNull();

    ledger.deliver('first');

    expect(ledger.checkpointAfter(2n)).toBe(
      ledger.deliver('second') && ledger.checkpointAfter(1n),
    );
  });

  it('theLastHandledCheckpointFollowsOnlyDeliveriesThatWereClassifiedAsHandled', async () => {
    const ledger = deliveryLedger<string>({ settle: () => Promise.resolve() });
    const first = ledger.deliver('first');
    const second = ledger.deliver('second');
    const third = ledger.deliver('third');
    ledger.handled(first);
    ledger.handled(second);

    expect(ledger.lastHandledCheckpoint()).toBe(second);

    await ledger.skip(third);
    expect(ledger.lastHandledCheckpoint()).toBe(second);
  });

  it('aProcessorStartedAtTheEndDoesNotHoldBackEarlierDeliveries', async () => {
    const settled: string[] = [];
    const ledger = deliveryLedger<string>({
      settle: (deliveries) => {
        settled.push(...deliveries);
        return Promise.resolve();
      },
    });
    const end = ledger.checkpointAfter(2n);
    ledger.processorStarted('late', end);

    ledger.deliver('first');
    ledger.deliver('second');
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(settled).toEqual(['first', 'second']);
  });
});
