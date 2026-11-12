# Exercise 10 - Application Logic with Optimistic Concurrency

Having the following shopping cart process:

1. The customer may add a product to the shopping cart only after opening it.
2. When selecting and adding a product to the basket customer needs to provide the quantity chosen. The product price is calculated by the system based on the current price list.
3. The customer may remove a product with a given price from the cart.
4. The customer can confirm the shopping cart and start the order fulfilment process.
5. The customer may also cancel the shopping cart and reject all selected products.
6. After shopping cart confirmation or cancellation, the product can no longer be added or removed from the cart.

![events](./assets/events.jpg)

And business logic and application code implemented in the [previous exercise](../09_application_logic_kurrentdb/) update the application code to handle correctly optimistic concurrency. You need to map ETag conditional headers into expected stream revision correctly. Read more:

- [Optimistic concurrency for pessimistic times](https://event-driven.io/en/optimistic_concurrency_for_pessimistic_times/)
- [MDN - HTTP conditional requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Conditional_requests)
- [KurrentDB Documentation - Handling concurrency](https://docs.kurrent.io/clients/node/v1.3/appending-events.html#handling-concurrency)

This time you'll use KurrentDB instead of the mocked one. Run `docker compose up` (or for Mac `docker compose -f docker-compose.arm.yml up`) before running test code to have database set up.

There are four variations:

1. Classical, mutable aggregates (rich domain model): [./oop/aggregate/applicationLogicWithOC.solved.test.ts](./oop/aggregate/applicationLogicWithOC.solved.test.ts),
2. Mixed approach, mutable aggregates (rich domain model), returning events from methods: [./oop/aggregate_returning_events/applicationLogicWithOC.solved.test.ts](./oop/aggregate_returning_events/applicationLogicWithOC.solved.test.ts),
3. Immutable, with functional command handlers composition and entities as anemic data model: [./immutable/functions/applicationLogicWithOC.solved.test.ts](./immutable/functions/applicationLogicWithOC.solved.test.ts),
4. Immutable with composition using [the Decider](https://thinkbeforecoding.com/post/2021/12/17/functional-event-sourcing-decider) pattern and entities as anemic data model: [./immutable/decide/applicationLogicWithOC.solved.test.ts](./immutable/decide/applicationLogicWithOC.solved.test.ts),

## Solution

Read more about recommended solution in [How to use ETag header for optimistic concurrency](https://event-driven.io/en/how_to_use_etag_header_for_optimistic_concurrency/)
