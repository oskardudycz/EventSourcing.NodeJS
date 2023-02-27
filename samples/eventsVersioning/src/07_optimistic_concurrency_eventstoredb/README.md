# Exercise 7 - Optimistic Concurrency with EventStoreDB

Having the following shopping cart process:

1. The customer may add a product to the shopping cart only after opening it.
2. When selecting and adding a product to the basket customer needs to provide the quantity chosen. The product price is calculated by the system based on the current price list.
3. The customer may remove a product with a given price from the cart.
4. The customer can confirm the shopping cart and start the order fulfilment process.
5. The customer may also cancel the shopping cart and reject all selected products.
6. After shopping cart confirmation or cancellation, the product can no longer be added or removed from the cart.

![events](./assets/events.jpg)

Update the code with business logic to handle correctly [Optimistic Concurrency](https://event-driven.io/en/optimistic_concurrency_for_pessimistic_times/?utm_source=eventsourcing_nodejs?utm_campaign=workshop).

When you finish, try to rewrite the solution not to have to pass the expected revision explicitly but use it from the loaded stream.

There are four variations:

1. Classical, mutable aggregates (rich domain model): [oop/solution1/businessLogic.solved.test.ts](./oop/solution1/businessLogic.solved.test.ts).
2. Mixed approach, mutable aggregates (rich domain model), returning events from methods: [oop/solution2/businessLogic.solved.test.ts](./oop/solution2/businessLogic.solved.test.ts).
3. Immutable, with functional command handlers composition and entities as anemic data model: [./immutable/solution1/businessLogic.solved.test.ts](./immutable/solution1/businessLogic.solved.test.ts).
4. Immutable with composition using [the Decider](https://thinkbeforecoding.com/post/2021/12/17/functional-event-sourcing-decider) pattern and entities as anemic data model: [./immutable/solution2/businessLogic.solved.test.ts](./immutable/solution2/businessLogic.solved.test.ts).

Select your preferred approach (or all) to solve this use case using EventStoreDB.

_**Note**: If needed update entities, events or test setup structure_
