# Exercise 05 - Getting the current entity state from events using EventStoreDB

Having a defined structure of events and an entity representing the shopping cart from the [first exercise](../01_events_definition/), fill a `GetShoppingCart` function that will rebuild the current state from events.

If needed you can modify the events or entity structure.

There are two variations:

- using mutable entities: [oop/gettingStateFromEvents.exercise.test.ts](./oop/gettingStateFromEvents.exercise.test.ts),
- using fully immutable structures: [immutable/gettingStateFromEvents.exercise.test.ts](./immutable/gettingStateFromEvents.exercise.test.ts).

Select your preferred approach (or both) to solve this use case. If needed you can modify entities or events.

## Solution

1. Immtuable:

- only primitive types in events: [immutable/solution1/gettingStateFromEvents.solved.test.ts](./immutable/solution1/gettingStateFromEvents.solved.test.ts).
- additional mapping using types for raw payload: [immutable/solution2/gettingStateFromEvents.solved.test.ts](./immutable/solution2/gettingStateFromEvents.solved.test.ts).
- generalised stream aggregation: [immutable/solution3/gettingStateFromEvents.solved.test.ts](./immutable/solution3/gettingStateFromEvents.solved.test.ts).

2. Object-Oriented:

- only primitive types in events: [oop/solution1/gettingStateFromEvents.solved.test.ts](./oop/solution1/gettingStateFromEvents.solved.test.ts).
- additional mapping using types for raw payload: [oop/solution2/gettingStateFromEvents.solved.test.ts](./oop/solution2/gettingStateFromEvents.solved.test.ts).
- generalised handling with repository: [oop/solution3/gettingStateFromEvents.solved.test.ts](./oop/solution3/gettingStateFromEvents.solved.test.ts).

Read also my articles:

- [How to get the current entity state from events?](https://event-driven.io/en/how_to_get_the_current_entity_state_in_event_sourcing/?utm_source=event_sourcing_net_workshop).
- [Should you throw an exception when rebuilding the state from events?](https://event-driven.io/en/should_you_throw_exception_when_rebuilding_state_from_events/=event_sourcing_net_workshop)
- and [EventStoreDB documentation on reading events](https://developers.eventstore.com/clients/grpc/reading-events.html#reading-from-a-stream)
