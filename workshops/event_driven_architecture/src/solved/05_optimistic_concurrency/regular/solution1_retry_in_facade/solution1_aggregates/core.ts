import type { Event } from '../../../tools';

export abstract class Aggregate<E extends Event> {
  // Not stored, so it's empty after loading
  #uncommitedEvents: E[] = [];

  abstract evolve(event: E): void;

  protected enqueue(event: E): void {
    this.#uncommitedEvents = [...this.#uncommitedEvents, event];
    this.evolve(event);
  }

  dequeueUncommittedEvents(): E[] {
    const events = this.#uncommitedEvents;

    this.#uncommitedEvents = [];

    return events;
  }
}
