# Exercise 02 - Getting the current entity state from events

Having a defined structure of events and an entity representing the shopping cart from the [previous exercise](../01-EventsDefinition), fill a `GetShoppingCart` function that will rebuild the current state from events.

If needed you can modify the events or entity structure.

There are two variations:

- using fully immutable structures: [immutable/gettingStateFromEvents.exercise.test.ts](./immutable/gettingStateFromEvents.exercise.test.ts),
- using mutable entities: [oop/gettingStateFromEvents.exercise.test.ts](./oop/gettingStateFromEvents.exercise.test.ts).

Select your preferred approach (or both) to solve this use case.

_**Reminder**: In Event Sourcing, we're rebuilding the current state by applying on it events data in order of appearance_

## Solution

Read also my articles:

- [How to get the current entity state from events?](https://event-driven.io/en/how_to_get_the_current_entity_state_in_event_sourcing/?utm_source=event_sourcing_net_workshop).
- [Should you throw an exception when rebuilding the state from events?](https://event-driven.io/en/should_you_throw_exception_when_rebuilding_state_from_events/=event_sourcing_net_workshop)

1. Mutable: [oop/gettingStateFromEvents.solved.test.ts](./oop/gettingStateFromEvents.solved.test.ts).
2. Immutable

- with an explicit product items collection management [immutable/solution1/gettingStateFromEvents.solved.test.ts](./immutable/solution1/gettingStateFromEvents.solved.test.ts).
- with a generic merge method for managing immutable collections [immutable/solution2gettingStateFromEvents.solved.test.ts](./immutable/solution2/gettingStateFromEvents.solved.test.ts).
- using [Immutable.js](https://immutable-js.com/) for managing immutable collections [immutable/solution2gettingStateFromEvents.solved.test.ts](./immutable/solution2/gettingStateFromEvents.solved.test.ts).
