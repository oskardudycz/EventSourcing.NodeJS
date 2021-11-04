import { StreamEvent } from '../events';

export function aggregateStream<Aggregate, StreamEvents extends StreamEvent>(
  events: StreamEvents[],
  when: (
    currentState: Aggregate,
    event: StreamEvents,
    currentIndex: number,
    allEvents: StreamEvents[]
  ) => Aggregate
): Aggregate {
  const state = events.reduce(when, <Aggregate>{});

  return state;
}
