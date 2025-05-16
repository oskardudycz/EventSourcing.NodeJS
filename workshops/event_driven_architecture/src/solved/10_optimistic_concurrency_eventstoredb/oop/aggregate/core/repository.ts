import { type EventStore } from '../../../tools/eventStore';
import { type Event } from '../../../tools/events';
import { Aggregate } from './aggregate';

export interface Repository<Entity> {
  find(id: string, options?: { expectedRevision?: bigint }): Promise<Entity>;
  store(
    id: string,
    entity: Entity,
    options?: { expectedRevision?: bigint },
  ): Promise<bigint>;
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

  find = async (
    id: string,
    options?: { expectedRevision?: bigint },
  ): Promise<Entity> =>
    (await this.eventStore.aggregateStream<Entity, StreamEvent>(
      this.mapToStreamId(id),
      {
        evolve: (state, event) => {
          state.evolve(event);
          return state;
        },
        getInitialState: this.getInitialState,
        expectedRevision: options?.expectedRevision,
      },
    )) ?? this.getInitialState();

  store = (
    id: string,
    entity: Entity,
    options?: { expectedRevision?: bigint },
  ): Promise<bigint> => {
    const events = entity.dequeueUncommitedEvents();

    if (events.length === 0)
      return Promise.resolve(
        options?.expectedRevision !== undefined
          ? options?.expectedRevision
          : -1n,
      );

    return this.eventStore.appendToStream(
      this.mapToStreamId(id),
      events,
      options,
    );
  };
}
