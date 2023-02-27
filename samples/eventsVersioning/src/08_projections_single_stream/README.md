# Exercise 08 - Projections

With the [Database](./tools/database.ts) interface representing the sample database, implement the following projections:

1. Detailed view of the shopping cart:
   - total amount of products in the basket,
   - total number of products
   - list of products (e.g. if someone added the same product twice, then we should have one element with the sum).
2. View with short information about pending shopping carts. It's intended to be used as list view for administration:
   - total amount of products in the basket,
   - total number of products
   - confirmed and canceled shopping carts should not be visible.

Add event handlers registrations in [projections.exercise.test.ts](./projections.exercise.test.ts) calling [eventStore.subscribe](./tools/eventStore.ts) method.

If needed expand existing classes definition.

Read more about projections in my article:

- [Guide to Projections and Read Models in Event-Driven Architecture](https://event-driven.io/en/projections_and_read_models_in_event_driven_architecture/?utm_source=event_sourcing_nodejs&utm_campaign=workshop)
