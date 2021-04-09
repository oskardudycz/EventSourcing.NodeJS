const dateFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function reviver(key: any, value: any): any {
  if (typeof value === 'string' && dateFormat.test(value)) {
    return new Date(value);
  }

  return value;
}

export class EventStore {
  private events: { readonly streamId: string; readonly data: string }[] = [];

  appendToStream(streamId: string, ...events: any[]): void {
    const serialisedEvents = events.map((event) => {
      return { streamId: streamId, data: JSON.stringify(event) };
    });

    this.events.push(...serialisedEvents);
  }

  readFromStream<T = any>(streamId: string): T[] {
    return this.events
      .filter((event) => event.streamId === streamId)
      .map<T>((event) => JSON.parse(event.data, reviver));
  }
}
