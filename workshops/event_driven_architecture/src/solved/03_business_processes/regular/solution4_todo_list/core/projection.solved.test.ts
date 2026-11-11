import { v4 as uuid } from 'uuid';
import { getDatabase, type Event } from '../../../tools';
import { Projection } from './projection';

type Counter = { id: string; count: number };

type Started = Event<'Started', { counterId: string }>;
type Incremented = Event<'Incremented', { counterId?: string }>;
type Finished = Event<'Finished', { counterId: string }>;
type CounterEvent = Started | Incremented | Finished;

describe('Projection', () => {
  const collection = getDatabase().collection<Counter>('counter');
  const projection = Projection<Counter, CounterEvent>(collection, {
    canHandle: ['Started', 'Incremented', 'Finished'],
    getDocumentId: (event) => event.data.counterId,
    evolve: (current, event) => {
      switch (event.type) {
        case 'Started':
          return { id: event.data.counterId, count: 0 };
        case 'Incremented':
          return current ? { ...current, count: current.count + 1 } : null;
        case 'Finished':
          return null;
      }
    },
  });

  it('first event stores and returns the document', () => {
    const id = uuid();

    const result = projection.handle({
      type: 'Started',
      data: { counterId: id },
    });

    expect(result).toEqual({ id, count: 0 });
    expect(collection.get(id)).toEqual({ id, count: 0 });
  });

  it('next event evolves the stored document', () => {
    const id = uuid();
    projection.handle({ type: 'Started', data: { counterId: id } });

    const result = projection.handle({
      type: 'Incremented',
      data: { counterId: id },
    });

    expect(result).toEqual({ id, count: 1 });
    expect(collection.get(id)).toEqual({ id, count: 1 });
  });

  it('event without document id is skipped', () => {
    const result = projection.handle({ type: 'Incremented', data: {} });

    expect(result).toBeNull();
  });

  it('no document from evolve deletes the document', () => {
    const id = uuid();
    projection.handle({ type: 'Started', data: { counterId: id } });

    const result = projection.handle({
      type: 'Finished',
      data: { counterId: id },
    });

    expect(result).toBeNull();
    expect(collection.get(id)).toBeNull();
  });

  it('can handle lists the projected events', () => {
    expect(projection.canHandle).toEqual([
      'Started',
      'Incremented',
      'Finished',
    ]);
  });
});
