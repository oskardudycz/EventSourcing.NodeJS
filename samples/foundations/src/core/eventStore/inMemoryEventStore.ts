import { serializeToJSON, deserializeFromJSON } from '../parsing/json';

export class InMemoryEventStore {
  private events: { readonly streamId: string; readonly data: string }[] = [];

  appendToStream(streamId: string, ...events: any[]): void {
    const serialisedEvents = events.map((event) => {
      return { streamId: streamId, data: serializeToJSON(event) };
    });

    this.events.push(...serialisedEvents);
  }

  readFromStream<T = any>(streamId: string): T[] {
    return this.events
      .filter((event) => event.streamId === streamId)
      .map<T>((event) => deserializeFromJSON<T>(event.data));
  }
}
