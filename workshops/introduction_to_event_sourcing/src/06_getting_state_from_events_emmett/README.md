# Exercise 06 - Getting the current entity state from events using Emmett

Having a defined structure of events and an entity representing the shopping cart from the [first exercise](../01_events_definition/), fill a `GetShoppingCart` function that will rebuild the current state from events.

If needed you can modify the events or entity structure.

There are two variations, for each of the Emmett storages ([KurrentDB](./kurrentdb/), [PostgreSQL](./postgresql/), [MongoDB](./mongodb/)):

- using mutable entities, e.g. [mongodb/oop/gettingStateFromEvents.exercise.test.ts](./mongodb/oop/gettingStateFromEvents.exercise.test.ts),
- using fully immutable structures, e.g. [mongodb/immutable/gettingStateFromEvents.exercise.test.ts](./mongodb/immutable/gettingStateFromEvents.exercise.test.ts).

Select your preferred approach (or both) to solve this use case. If needed you can modify entities or events.
