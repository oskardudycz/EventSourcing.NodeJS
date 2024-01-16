import { EventStore } from '../../../tools/eventStore';
import { Event } from '../../../tools/events';

export interface Repository<Entity, StreamEvent extends Event> {
  find(id: string): Promise<Entity>;
  store(id: string, ...events: StreamEvent[]): Promise<void>;
}

export class EventStoreRepository<Entity, StreamEvent extends Event>
  implements Repository<Entity, StreamEvent>
{
  constructor(
    private eventStore: EventStore,
    private getInitialState: () => Entity,
    private evolve: (state: Entity, event: StreamEvent) => Entity,
    private mapToStreamId: (id: string) => string,
  ) {}

  find = async (id: string): Promise<Entity> =>
    (await this.eventStore.aggregateStream<Entity, StreamEvent>(
      this.mapToStreamId(id),
      {
        evolve: this.evolve,
        getInitialState: this.getInitialState,
      },
    )) ?? this.getInitialState();

  store = async (id: string, ...events: StreamEvent[]): Promise<void> => {
    await this.eventStore.appendToStream(this.mapToStreamId(id), events);
  };
}
