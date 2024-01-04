import { StreamEvent } from '../events';

export function aggregateStream<Aggregate, StreamEvents extends StreamEvent>(
  events: StreamEvents[],
  when: (
    currentState: Partial<Aggregate>,
    event: StreamEvents,
    currentIndex: number,
    allEvents: StreamEvents[],
  ) => Partial<Aggregate>,
  check?: (state: Partial<Aggregate>) => state is Aggregate,
): Aggregate {
  const state = events.reduce<Partial<Aggregate>>(when, {});

  if (!check) {
    console.warn('No type check method was provided in the aggregate method');
    return <Aggregate>state;
  }

  if (!check(state)) throw 'Aggregate state is not valid';

  return state;
}
