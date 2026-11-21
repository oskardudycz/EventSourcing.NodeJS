import { beforeEach, describe, expect, it } from 'vitest';
import { v4 as uuid } from 'uuid';
import { ConcurrencyError, getDatabase, type Event } from '../../../tools';
import { Aggregate } from '../solution1_aggregates/core';
import { AggregateStore } from './aggregateStore';

describe('Aggregate store', () => {
  let id: string;
  let counters: ReturnType<typeof getCounters>;

  beforeEach(() => {
    id = uuid();
    counters = getCounters();
  });

  it('function returning a new aggregate stores it with version 1 and returns its events', async () => {
    const store = AggregateStore(counters);
    const events = await store.handle(id, () => Counter.create());

    expect(events).toStrictEqual([incremented(1)]);
    expect((await counters.get(id))?.version).toBe(1);
  });

  it('function receives the loaded aggregate and its changes are stored', async () => {
    const store = AggregateStore(counters);
    await store.handle(id, () => Counter.create());

    const events = await store.handle(id, (counter) => counter!.increment());

    expect(events).toStrictEqual([incremented(2)]);
    expect((await counters.get(id))?.document.value).toBe(2);
    expect((await counters.get(id))?.version).toBe(2);
  });

  it('nothing stored: function receives null', async () => {
    const store = AggregateStore(counters);
    let received: Counter | null | undefined;

    await store.handle(id, (counter) => {
      received = counter;
      return null;
    });

    expect(received).toBeNull();
  });

  it('function returning nothing stores nothing and returns no events', async () => {
    const store = AggregateStore(counters);
    const events = await store.handle(id, () => null);

    expect(events).toStrictEqual([]);
    expect(await counters.get(id)).toBeNull();
  });

  it('aggregate without events is not stored', async () => {
    const store = AggregateStore(counters);
    await store.handle(id, () => Counter.create());

    const events = await store.handle(id, (counter) => counter);

    expect(events).toStrictEqual([]);
    expect((await counters.get(id))?.version).toBe(1);
  });

  it('conflict runs the function again on the freshly loaded aggregate and returns only the last attempt events', async () => {
    await AggregateStore(counters).handle(id, () => Counter.create());
    const store = AggregateStore(conflictingOnStore(counters, 1));
    let attempts = 0;

    const events = await store.handle(id, (counter) => {
      attempts++;
      return counter!.increment();
    });

    expect(attempts).toBe(2);
    expect(events).toStrictEqual([incremented(3)]);
    expect((await counters.get(id))?.document.value).toBe(3);
  });

  it('conflict on every attempt throws after ten attempts', async () => {
    await AggregateStore(counters).handle(id, () => Counter.create());
    const store = AggregateStore(conflictingOnStore(counters, 10));
    let attempts = 0;

    await expect(
      store.handle(id, (counter) => {
        attempts++;
        return counter!.increment();
      }),
    ).rejects.toThrow(ConcurrencyError);

    expect(attempts).toBe(10);
  });

  const conflictingOnStore = (
    collection: ReturnType<typeof getCounters>,
    conflicts: number,
  ): ReturnType<typeof getCounters> => {
    let remaining = conflicts;

    return {
      ...collection,
      store: async (storedId, document, options) => {
        if (remaining-- > 0) {
          const loaded = (await collection.get(storedId))!;
          loaded.document.increment();
          await collection.store(storedId, loaded.document, {
            expectedVersion: loaded.version,
          });
        }
        await collection.store(storedId, document, options);
      },
    };
  };
});

const getCounters = () => getDatabase().collection('counters', Counter);

const incremented = (value: number): Event => ({
  type: 'Incremented',
  data: { value },
});

class Counter extends Aggregate<Event> {
  value = 0;

  static create(): Counter {
    return new Counter().increment();
  }

  increment(): Counter {
    this.enqueue(incremented(this.value + 1));
    return this;
  }

  evolve(event: Event): void {
    this.value = event.data.value as number;
  }
}
