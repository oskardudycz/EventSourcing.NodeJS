import { beforeEach, describe, expect, it } from 'vitest';
import { v4 as uuid } from 'uuid';
import { ConcurrencyError, getDatabase, type Event } from '../../../tools';
import { CommandHandler } from './commandHandler';

describe('Command handler', () => {
  let id: string;
  let counters: ReturnType<typeof getCounters>;

  beforeEach(() => {
    id = uuid();
    counters = getCounters();
  });

  it('nothing stored: function receives the initial state and the result is stored with version 1', async () => {
    const handler = getHandler(counters);
    let received: Counter | undefined;

    const events = await handler.handle(id, (state) => {
      received = state;
      return [incremented(1)];
    });

    expect(received).toStrictEqual(initial);
    expect(events).toStrictEqual([incremented(1)]);
    expect(await counters.get(id)).toStrictEqual({
      document: { value: 1 },
      version: 1,
    });
  });

  it('stored state: function receives it and the evolved state is stored', async () => {
    const handler = getHandler(counters);
    await handler.handle(id, () => [incremented(1)]);

    const events = await handler.handle(id, (state) => [
      incremented(state.value + 1),
    ]);

    expect(events).toStrictEqual([incremented(2)]);
    expect(await counters.get(id)).toStrictEqual({
      document: { value: 2 },
      version: 2,
    });
  });

  it('function returning no events stores nothing', async () => {
    const handler = getHandler(counters);
    const events = await handler.handle(id, () => []);

    expect(events).toStrictEqual([]);
    expect(await counters.get(id)).toBeNull();
  });

  it('function returning no events keeps the stored version', async () => {
    const handler = getHandler(counters);
    await handler.handle(id, () => [incremented(1)]);

    const events = await handler.handle(id, () => []);

    expect(events).toStrictEqual([]);
    expect((await counters.get(id))?.version).toBe(1);
  });

  it('conflict runs the function again on the freshly loaded state and returns only the last attempt events', async () => {
    await getHandler(counters).handle(id, () => [incremented(1)]);
    const handler = getHandler(conflictingOnStore(counters, 1));
    let attempts = 0;

    const events = await handler.handle(id, (state) => {
      attempts++;
      return [incremented(state.value + 1)];
    });

    expect(attempts).toBe(2);
    expect(events).toStrictEqual([incremented(3)]);
    expect((await counters.get(id))?.document).toStrictEqual({ value: 3 });
  });

  it('conflict on every attempt throws after ten attempts', async () => {
    await getHandler(counters).handle(id, () => [incremented(1)]);
    const handler = getHandler(conflictingOnStore(counters, 10));
    let attempts = 0;

    await expect(
      handler.handle(id, (state) => {
        attempts++;
        return [incremented(state.value + 1)];
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
          await collection.store(
            storedId,
            { value: loaded.document.value + 1 },
            { expectedVersion: loaded.version },
          );
        }
        await collection.store(storedId, document, options);
      },
    };
  };
});

type Counter = { value: number };

const initial: Counter = { value: 0 };

const getCounters = () => getDatabase().collection<Counter>('counters');

const getHandler = (counters: ReturnType<typeof getCounters>) =>
  CommandHandler<Counter, Event>({
    collection: counters,
    initial,
    evolve: (_, event) => ({ value: event.data.value as number }),
  });

const incremented = (value: number): Event => ({
  type: 'Incremented',
  data: { value },
});
