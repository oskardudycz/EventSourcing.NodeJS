# Exercise 06 - Getting the current entity state from events using Emmett

Having a defined structure of events and an entity representing the shopping cart from the [first exercise](../01_events_definition/), fill a `GetShoppingCart` function that will rebuild the current state from events.

If needed you can modify the events or entity structure.

There are two variations, for each of the Emmett storages ([KurrentDB](./kurrentdb/), [PostgreSQL](./postgresql/), [MongoDB](./mongodb/)):

- using mutable entities, e.g. [mongodb/oop](./mongodb/oop/),
- using fully immutable structures, e.g. [mongodb/immutable](./mongodb/immutable/).

Select your preferred approach (or both) to solve this use case. If needed you can modify entities or events.

## Solution

- only primitive types in events: [kurrentdb/immutable/solution1](./kurrentdb/immutable/solution1/gettingStateFromEvents.solved.test.ts), [kurrentdb/oop/solution1](./kurrentdb/oop/solution1/gettingStateFromEvents.solved.test.ts), [postgresql/immutable/solution1](./postgresql/immutable/solution1/gettingStateFromEvents.solved.test.ts), [postgresql/oop/solution1](./postgresql/oop/solution1/gettingStateFromEvents.solved.test.ts), [mongodb/immutable/solution1](./mongodb/immutable/solution1/gettingStateFromEvents.solved.test.ts), [mongodb/oop/solution1](./mongodb/oop/solution1/gettingStateFromEvents.solved.test.ts)
- additional mapping using types for raw payload: [kurrentdb/immutable/solution2](./kurrentdb/immutable/solution2/gettingStateFromEvents.solved.test.ts), [kurrentdb/oop/solution2](./kurrentdb/oop/solution2/gettingStateFromEvents.solved.test.ts), [postgresql/immutable/solution2](./postgresql/immutable/solution2/gettingStateFromEvents.solved.test.ts), [postgresql/oop/solution2](./postgresql/oop/solution2/gettingStateFromEvents.solved.test.ts), [mongodb/immutable/solution2](./mongodb/immutable/solution2/gettingStateFromEvents.solved.test.ts), [mongodb/oop/solution2](./mongodb/oop/solution2/gettingStateFromEvents.solved.test.ts)

Read also my articles:

- [How to get the current entity state from events?](https://event-driven.io/en/how_to_get_the_current_entity_state_in_event_sourcing/?utm_source=event_sourcing_net_workshop).
- [Should you throw an exception when rebuilding the state from events?](https://event-driven.io/en/should_you_throw_exception_when_rebuilding_state_from_events/=event_sourcing_net_workshop)
- and [KurrentDB documentation on reading events](https://docs.kurrent.io/clients/node/v1.3/reading-events.html#reading-from-a-stream)
