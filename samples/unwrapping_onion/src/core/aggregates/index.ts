import { Event } from '../events';
export abstract class Aggregate {
  protected uncomittedEvents: Event[] = [];

  public get id() {
    return this._id;
  }

  public get revision() {
    return this._revision;
  }

  constructor(protected _id: string, protected _revision: number) {}

  public dequeueUncomittedEvents(): Event[] {
    const events = this.uncomittedEvents;
    this.uncomittedEvents = [];
    return events;
  }

  protected enqueue(event: Event) {
    this.uncomittedEvents = [...this.uncomittedEvents, event];
    this._revision++;
  }
}
