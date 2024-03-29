# Exercise 02 - Getting the current entity state from events

Having a defined structure of events and an entity representing the shopping cart from the [previous exercise](../01-EventsDefinition), fill a `GetShoppingCart` function that will rebuild the current state from events.

If needed you can modify the events or entity structure.

There are two variations:

- using fully immutable structures: [immutable/gettingStateFromEvents.exercise.test.ts](./immutable/gettingStateFromEvents.exercise.test.ts),
- using mutable entities: [oop/gettingStateFromEvents.exercise.test.ts](./oop/gettingStateFromEvents.exercise.test.ts).

Select your preferred approach (or both) to solve this use case.

_**Reminder**: In Event Sourcing, we're rebuilding the current state by applying on it events data in order of appearance_
