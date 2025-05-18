import { type Command, type Event } from '../../tools';

export abstract class Aggregate<E extends Event> {
  #uncommitedEvents: E[] = [];

  abstract evolve(event: E): void;

  protected enqueue = (event: E) => {
    this.#uncommitedEvents = [...this.#uncommitedEvents, event];
    this.evolve(event);
  };

  dequeueUncommitedEvents = (): Event[] => {
    const events = this.#uncommitedEvents;

    this.#uncommitedEvents = [];

    return events;
  };
}

export type MessageWrapper =
  | {
      kind: 'Event';
      message: Event;
    }
  | {
      kind: 'Command';
      message: Command;
    };

export abstract class ProcessManager<
  Sends extends Command,
  Records extends Event,
> {
  #uncommitedMessages: MessageWrapper[] = [];

  abstract evolve(event: Records): void;

  protected enqueue = (event: Records) => {
    this.#uncommitedMessages = [
      ...this.#uncommitedMessages,
      { kind: 'Event', message: event },
    ];
    this.evolve(event);
  };

  protected schedule = (command: Sends) => {
    this.#uncommitedMessages = [
      ...this.#uncommitedMessages,
      { kind: 'Command', message: command },
    ];
  };

  dequeueUncommitedMessages = (): MessageWrapper[] => {
    const messages = this.#uncommitedMessages;

    this.#uncommitedMessages = [];

    return messages;
  };
}
