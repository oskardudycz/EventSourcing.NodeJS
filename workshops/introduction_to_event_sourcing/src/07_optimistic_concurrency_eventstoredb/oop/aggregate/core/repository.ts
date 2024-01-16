import { EventStore } from '../../../tools/eventStore';
import { Event } from '../../../tools/events';
import { Aggregate } from './aggregate';

export interface Repository<Entity> {
  find(id: string): Promise<Entity>;
  store(id: string, entity: Entity): Promise<void>;
}

export class EventStoreRepository<
  Entity extends Aggregate<StreamEvent>,
  StreamEvent extends Event,
> implements Repository<Entity>
{
  constructor(
    private eventStore: EventStore,
    private getInitialState: () => Entity,
    private mapToStreamId: (id: string) => string,
  ) {}

  find = async (id: string): Promise<Entity> =>
    (await this.eventStore.aggregateStream<Entity, StreamEvent>(
      this.mapToStreamId(id),
      {
        evolve: (state, event) => {
          state.evolve(event);
          return state;
        },
        getInitialState: this.getInitialState,
      },
    )) ?? this.getInitialState();

  store = async (id: string, entity: Entity): Promise<void> => {
    const events = entity.dequeueUncommitedEvents();

    if (events.length === 0) return;

    await this.eventStore.appendToStream(this.mapToStreamId(id), events);
  };
}
