import { type Event } from '@event-driven-io/emmett';

export abstract class Aggregate<EventType extends Event> {
  #uncommitedEvents: EventType[] = [];

  abstract evolve(event: EventType): void;

  protected enqueue = (event: EventType) => {
    this.#uncommitedEvents = [...this.#uncommitedEvents, event];
    this.evolve(event);
  };

  dequeueUncommitedEvents = (): EventType[] => {
    const events = this.#uncommitedEvents;

    this.#uncommitedEvents = [];

    return events;
  };
}
