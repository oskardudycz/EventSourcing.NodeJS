# Plan: E-commerce sample on Emmett

Revision: 6. Built from spec r8.

Spec: `spec.md`. Q&A: `qa.md`.

## Terms

- **Node.js repository**: `~/repos/EventSourcing.NodeJS`; the sample lives in `samples/e-commerce` (Q1).
- **Emmett repository**: `~/repos/emmett`; work on the named branch, normal checkout, no worktrees. Emmett steps run in parallel with the sample; the sample doesn't wait for them (Q49).
- **Core package**: the workspace package with the business-agnostic code Emmett lacks (Q16).
- **Forwarder**: an Emmett reactor on the event store consumer, registered with `consumer.reactor({ processorId, canHandle, eachMessage })`, whose handler sends what a module recorded to Kafka, RabbitMQ or a channel stream; the reactor then saves its checkpoint (Q22, Q57). The core supplies only the handler (`forwardToChannels` for channel streams).
- **Broker-to-workflow forwarder**: a reactor on a queue or channel stream whose handler (`toWorkflowInbox`) stores the message in a workflow's inbox with `WorkflowHandler`'s store-only path (Q45).
- **Workflows decide** (Q65): each process is a workflow with state that decides its events itself (here one per module; more when a module has more flows), as Emmett's group checkout does; no handler next to it, no command passed on or doubled, no output that is also an input. Forwarders send its outputs to other modules; its `outputHandler` only calls external tools. Rework of steps 3 and 4 for this comes before step 5 continues.
- **Module databases** (Q60): each module has its own event store and read models (a SQLite file each plus `broker.db` for the channels between modules; a PostgreSQL schema each plus a `broker` schema; `{module}_{streamtype}-{id}` stream names in every store). `MESSAGING_BUS=none` appends to a channel stream in the receiving module's own store, which the receiver's channel reactor stores in its workflow inbox (Q62); `in-memory` keeps `-internal` channels in the module's own store and the channels between modules in the broker database. No module reads another module's database.
- **Workflow**: an Emmett `Workflow` with state, in inbox mode: order, payment, shipment, one per module (Q4, Q23, Q44, Q47, Q65). `CloseUnpaidOrder` is an input of the order workflow like any other command for an order.
- **Time step**: an `ApiE2ESpecification` step that moves the clock and runs each worker's `handle(now)` once.
- **Java sample**: `~/repos/EventSourcing.JVM/samples/e-commerce`, the behaviour reference. Paths below are relative to `samples/e-commerce` in the Node.js repository.
- Rules for every step: TDD; Vitest `expect`; forwarders and readers are Emmett reactors with core handlers, and module API tests run on `MESSAGING_BUS=in-memory` and `none` (Q56, Q57); no mocking library, named fakes; tests name behaviour; no code comments unless tricky; never commit, push, branch (except the named Emmett branches) or publish; clean up containers started by the step.

---

## Step 1. Workspace and the extended ApiE2ESpecification in the core package

Criteria groups: none.

```text
Use the `implement-step` skill.

What to build
Create the npm workspace `samples/e-commerce` in the Node.js repository with two packages, the application and the core (Q6, Q16): Node 24.22.1 (`.nvmrc`), Vitest, ESLint and Prettier like the other samples, and root scripts `build:ts`, `fix`, `lint`, `test` that run across both packages. Verify with `npm run build:ts` and `npm test` from the sample root (a command to run, not a test).
In the core package, an `ApiE2ESpecification` built on `emmett-honojs`' Hono test agent gets what the e-commerce sample needs (Q30): steps for HTTP requests, messages from a broker, time passing and attempts (a given request allowed to fail); hooks to start and stop consumers and workers around a test; a catch-up hook that runs after each step and repeats until a round sends nothing new; and the expectations `expectResponse`, `expectError`, `expectPublished`, `expectNothingPublished`, `expectAppended`, `expectNothingAppended`, `htmlContaining`, `htmlNotContaining` and `redirectsTo`. Given requests keep Emmett's behaviour: their status is not checked; tests check failures with `expectError` (status and problem details) (Q50). The options take: a function that sends a message step, the clock and the workers for the time step, a recorder of sent messages (for `expectPublished`), the event store (appended messages are those after the global position read before the `when` step), and a catch-up function that reports whether it sent anything new. The same shape goes to Emmett later (step 8, Q49).

Context
- `../../../emmett/src/packages/emmett-honojs/src/testing/apiE2ESpecification.ts`: a closure; steps are `TestRequest` only, `then` takes `[E2EResponseAssert]` for the `when` response, no hooks.
- `../../../emmett/src/packages/emmett-honojs/src/testing/apiSpecification.ts`: `HonoTestAgent`, `TestRequest`.
- Tests next to it: `apiE2ESpecification.int.spec.ts`.

Similar code
- Java port of the same helper, the reference for behaviour: `../../../EventSourcing.JVM/samples/e-commerce/src/test/java/io/eventdriven/testing/api/ApiE2ESpecification.java` (steps `TestRequest`, `TestAction`, `Publish`, `Attempt`; catch-up loop L452; expectations L210-L440) and its tests `ApiE2ESpecificationTests.java`.
- Emmett's Express `ApiE2ESpecification` in `../../../emmett/src/packages/emmett-expressjs/src/testing/` for naming.

Blocked by
None.

Acceptance criteria
None from the spec; the step serves the Testing Decisions and Q&A named above.

Tests
- extra: aRequestOnlySpecificationWorksAsInEmmett - covers `given(...requests).when(request).then(expectResponse(200))` with a plain Hono app
- extra: aMessageStepIsHandedToTheConfiguredSender - covers the message step calling the hook the test supplies
- extra: aTimeStepMovesTheClockAndRunsTheWorkersOnce - covers the time step
- extra: aFailingAttemptInGivenDoesNotFailTheTest - covers attempts
- extra: expectErrorChecksStatusAndProblemDetails - covers a 404 with its problem details body
- extra: expectResponseChecksStatusBodyAndHeaders / expectNothingAppendedFailsWhenTheWhenStepAppended / htmlNotContainingFailsWhenTheTextIsThere - cover the other expectations
- extra: catchUpRepeatsUntilARoundSendsNothingNew - covers the catch-up loop with a fake that sends once more on the first round
- extra: expectPublishedFailsWhenMessagesDifferOrAreOutOfOrder / expectNothingPublishedFailsWhenSomethingWasSent - cover message expectations
- extra: expectAppendedChecksOnlyWhatTheWhenStepAppended - covers appended expectations
- extra: htmlContainingAndRedirectsToCheckTheResponse - covers page expectations
- extra: hooksStartBeforeTheFirstStepAndStopAfterTheLast - covers start and stop hooks, also when a step fails

Existing tests it breaks
None expected; if a test from an earlier step breaks, update it in this step and say why.
```

---

## Step 2. Shopping carts, forwarding through channel streams, and type names

Criteria groups: 1, 2, 3, 4, 19, 23, 26.

```text
Use the `implement-step` skill.

What to build
The application runs on Hono with `emmett-honojs`, on Emmett's SQLite event store with Pongo projections inline in the append (Q19, Q20, Q38). This step uses a SQLite file that the test or the start script passes in; the temporary-file default and the settings come in step 5.
The shopping carts module works for adding, removing and reading the current cart, with the ported decider, the `Cart` and `CustomerShoppingCart` read models, the price calculator port with a random-price implementation and a `ChangeablePrices` fake, URN ids, money rounded to cents, problem details and the error mapping (409, 412, 404, 400).
Tests use the core's `ApiE2ESpecification` from step 1.
Add the CI workflow `.github/workflows/samples_e_commerce.yml`, like the other samples' workflows (Node from `.nvmrc`, `npm ci`, `npm run build:ts`, `npm run lint`, `npm test`), running only when `samples/e-commerce` changes (Q53).
The same step builds what checkout needs, because neither part is usable alone: the core's routings (type to channel and routing key, Java `MessageRouter` rules), the forwarder as the `eachMessage` handler of an Emmett reactor on the event store consumer (Q22, Q57), retrying with back-off inside its handler (Q24, Q37), and channels as streams (Q51, Q55): each channel is a stream `channel:<name>`, the forwarder appends to it, and readers are reactors with `canHandle` that handle a message only from the channel stream and with a matching binding key; a reader stores a message in a workflow's inbox through `WorkflowHandler`'s store-only path, or passes a module's own command to its handler. The cart API tests run on both settings. Tests observe what was published through a recording reactor in the test application; like Java's `expectPublished`, it also lists a module's commands to itself. Rewire for Q60 (after the first run of this step): the cart gets its own store and read models, its stream is `shopping_carts_cart-<id>`, and channel streams between modules move to the broker database; with `MESSAGING_BUS=none` the cart forwarder stores its external event in the receiving workflow's inbox in that module's store (19.8). Type names get module prefixes (Q17, Q29); an old name is mapped with Emmett's `upcast` (Q54). The cart module checks out: the facade appends `ShoppingCartCheckedOut`, an inline Pongo projection keeps the `ShoppingCartSummary` (Q38), and the cart forwarder reads it and sends `shopping_carts.external.ShoppingCartCheckedOut` (19.6, cart part).

Context
- No `samples/e-commerce` exists in the Node.js repository yet.
- Java module: `../../../EventSourcing.JVM/samples/e-commerce/src/main/java/io/eventdriven/ecommerce/shoppingcarts/` (`ShoppingCart.java`, `ShoppingCartDecider.java`, `ShoppingCartFacade.java`, `ShoppingCartsController.java`, `getcart/`, `currentcart/`, `pricing/`, `productitems/`).
- Java money rounding: `PricedProductItem.java` L19, `ProductItems.java` L67.
- Java conditional reads: `core/http/ConditionalRead.java`, `LongPolling.java` (1 s).

Similar code
- Node sample layout and scripts: `samples/from_crud_to_eventsourcing` (Emmett, `DeciderCommandHandler`, `ApiSpecification`).
- Emmett SQLite + Pongo: `../../../emmett/src/packages/emmett-sqlite/src/eventStore/projections/pongo/`.
- Java tests: `../../../EventSourcing.JVM/samples/e-commerce/src/test/java/io/eventdriven/ecommerce/shoppingcarts/ShoppingCartsApiTests.java`, `ShoppingCartTests.java`.

Blocked by
Step 1.

Acceptance criteria
- 1.1 GIVEN a customer with no open cart WHEN they add a product THEN a new cart opens with that product at the current price AND the response is 200 with the `ETag` of the new version.
- 1.2 GIVEN an open cart that has the product WHEN the customer adds it again THEN the quantity grows AND the line keeps its first price.
- 1.3 GIVEN the customer's cart was checked out WHEN they add a product THEN a new cart opens (cart number n+1).
- 1.4 GIVEN two adds for one customer at the same time WHEN both append THEN the version conflict is retried (3 attempts in all) AND both products end up in the cart.
- 2.1 GIVEN an open cart with the product WHEN the customer removes it with `If-Match` of the current version THEN the line shrinks or goes away AND the response is 200 with the new `ETag`.
- 2.2 GIVEN `If-Match` with an old version WHEN the customer removes a product THEN the response is 412 as problem details AND nothing is appended.
- 2.3 GIVEN the product is not in the cart WHEN the customer removes it THEN the response is 409 as problem details.
- 3.1 GIVEN an open cart WHEN the customer reads it THEN they get the lines, the total and the `ETag`.
- 3.2 GIVEN no open cart WHEN the customer reads it THEN the response is 404.
- 3.3 GIVEN `If-None-Match` with an older version AND the read model reaches a newer version within 1 s WHEN the customer reads the cart THEN the response is 200 with the newer cart.
- 3.4 GIVEN `If-None-Match` with the current version AND nothing newer arrives within 1 s WHEN the customer reads the cart THEN the response is 304 after the 1 s wait.
- 4.1 GIVEN an open cart with current prices WHEN the customer checks out with `If-Match` THEN the response is 202 with `Location: /customers/{customerId}/orders/{orderId}` AND the cart module sends `shopping_carts.external.ShoppingCartCheckedOut` with the cart id, customer id, product items, total price and time.
- 4.2 GIVEN a price changed since the product was added WHEN the customer checks out THEN the response is 409 with the new `ETag` AND the cart records `ProductItemPriceChanged` AND stays open AND nothing is sent.
- 4.3 GIVEN a checked-out cart WHEN the customer checks it out again THEN the response is 404 AND nothing is appended or sent.
- 4.4 GIVEN `If-Match` with an old version WHEN the customer checks out THEN the response is 412.
- 19.1 GIVEN a routing for the message type WHEN the forwarder reads the message from the event store THEN it sends it to the routing's channel with the routing's key AND then saves its checkpoint.
- 19.2 GIVEN routing keys from URNs WHEN a command is sent THEN its key is its entity id's URN; WHEN an external event is sent THEN its key is its `referenceId`'s URN.
- 19.3 GIVEN no routing for a type, or a routing to an undeclared channel WHEN the forwarder reads it THEN it fails with an error naming the type or the channel AND sends nothing for that message AND retries with back-off.
- 19.4 GIVEN a Kafka or RabbitMQ forwarder fails after sending and before saving the checkpoint WHEN it restarts THEN it sends the same messages again with the same message ids. On channel streams the append and the checkpoint commit together.
- 19.5 GIVEN an internal event WHEN the forwarder maps it to an external event THEN the external event's message id is derived from the internal event's id and the external type name, so a resend has the same id.
- 19.6 GIVEN a forwarder that needs a summary (the cart's customer id, items and total; the `referenceId` of a payment or shipment) WHEN it handles an event THEN it reads its Pongo summary, which an inline projection updates in the module's own append, so it never lags behind (Q24, Q38, Q46).
- 19.7 GIVEN channel streams WHEN a forwarder sends a message THEN it appends it to the stream `channel:<name>` with the routing key AND a reactor that reads that channel stores it in the receiving workflow's inbox (Q51, Q55) AND skips the copy of the same type in the source stream; nothing calls the receiving module's handlers inside the forwarder's processing.
- 19.8 GIVEN `MESSAGING_BUS=none` WHEN the cart is checked out THEN the cart forwarder appends `shopping_carts.external.ShoppingCartCheckedOut` to a channel stream in the orders store AND the orders channel reactor stores it in the order workflow's inbox AND no module reads another module's store (Q60).
- 23.1 GIVEN any command or internal event WHEN it is stored or sent THEN its type name is `<module>.<Name>`, with the modules `shopping_carts`, `orders`, `payments` and `shipments`.
- 23.2 GIVEN an external event WHEN it is sent THEN its type name is `<module>.external.<Name>`, for example `payments.external.PaymentAuthorized` next to the internal `payments.PaymentAuthorized`.
- 23.3 GIVEN an event of an old type name WHEN a processor reads it THEN Emmett's `upcast` in the processor's `messageOptions` gives the current handler the current event (Q54).
- 26.1 GIVEN a cart with 3 of a product at 19.99 WHEN it totals them THEN the total is 59.97, not 59.97000000000001.

Tests
- 1.1: addingAProductWithNoOpenCartOpensACartAtTheCurrentPrice - asserts 200, `ETag` W/"1", one line at the current price
- 1.2: addingTheSameProductAgainGrowsTheQuantityAndKeepsTheFirstPrice - asserts quantity sum and the first price after a price change
- 1.3: addingAfterCheckoutOpensTheNextCart - asserts a new cart number n+1; setup: add, then check out through the request
- 1.4: twoConcurrentAddsBothEndUpInTheCart - asserts both lines with two adds sent at once; addingRetriesAVersionConflictUpTo3AttemptsInAll and addingAnswers412WhenAll3AttemptsConflict - setup: the event store fake `conflictingEventStore` with the `appendsConflict(count)` step, which makes the next appends throw a version conflict (Emmett issue #435 proposes this for `WrapEventStore`)
- extra: removingDoesNotRetryAVersionConflict and checkingOutDoesNotRetryAVersionConflict - a conflict on an If-Match request answers 412 at once
- extra: aChannelReactorDeadLettersAMessageWhenItsRetriesRunOut and aChannelReactorRetriesAFailedHandlerAndDeadLettersNothingWhenItSucceeds - channel readers retry, then dead-letter to `channel:<queue>-dlq`
- 2.1: removingWithTheCurrentVersionShrinksTheLine - asserts 200, new `ETag`, quantity
- 2.2: removingWithAnOldVersionAnswers412 - asserts 412 problem details and nothing appended
- 2.3: removingAProductNotInTheCartAnswers409 - asserts 409 problem details
- 3.1: readingTheCurrentCartReturnsLinesTotalAndETag - asserts body and `ETag`
- 3.2: readingWithNoOpenCartAnswers404 - asserts 404
- 3.3: readingWithAnOlderVersionReturnsTheNewerCartWithin1s - asserts 200 with the newer cart; setup: the read starts with `If-None-Match` of version 1 while an add request is sent 200 ms later in parallel
- 3.4: readingWithTheCurrentVersionAnswers304After1s - asserts 304 and a wait of about 1 s
- 4.1: checkingOutSendsShoppingCartCheckedOutWithCustomerItemsAndTotal - asserts 202, `Location`, and the published external event body
- 4.2: checkingOutWithAChangedPriceAnswers409AndKeepsTheCartOpen - asserts 409, new `ETag`, `ProductItemPriceChanged`, nothing published
- 4.3: checkingOutACheckedOutCartAnswers404 - asserts 404, nothing appended or published
- 4.4: checkingOutWithAnOldVersionAnswers412 - asserts 412
- 19.1: aForwarderAppendsToTheRoutedChannelWithTheKeyAndSavesItsCheckpoint - asserts the channel stream entry with its key and the checkpoint
- 19.2: routingKeysComeFromURNs - asserts the command key = entity URN (cart id here), external event key = referenceId URN (with a test external event carrying a referenceId; payments and shipments re-check it in step 4)
- 19.3: anUnroutedTypeFailsNamingTheTypeAndRetriesWithoutForwarding - asserts the error message, nothing appended, the retries
- 19.4: on channel streams the append and the checkpoint commit together; the Kafka and RabbitMQ tests are in step 5
- 19.5: anExternalEventIdIsDerivedFromTheInternalIdAndType - asserts the same id for the same input twice; aForwardedMessageKeepsItsIdCorrelationAndCausation - asserts the derived id and the causation id in the channel stream
- 19.6: checkingOutSendsTheItemsAndTotalOfAllCartChanges - asserts the published event built from the inline summary after adds and a removal
- 19.7: aChannelReactorStoresTheMessageInTheWorkflowInbox - asserts the prefixed inbox entry of a test workflow and that the workflow did not decide; aChannelReactorSkipsTheSameTypeOutsideTheChannel; aChannelReactorGetsOnlyTheMessagesItsBindingKeyMatches
- 19.8: the cart API tests of checkout run on `in-memory` and `none`; the orders tests show the order is placed from the inbox in the orders store
- 23.1: commandsAndInternalEventsArePrefixedWithTheModule - asserts `shopping_carts.ShoppingCartCheckedOut` in the stream
- 23.2: externalEventsArePrefixedWithModuleExternal - asserts `shopping_carts.external.ShoppingCartCheckedOut`
- 23.3: no test of its own: it is Emmett's `upcast`, and no module has an old name yet
- 26.1: threeAt19_99TotalTo59_97 - asserts total 59.97
- extra: addingWithZeroOrNegativeQuantityAnswers400 - covers bad input
- extra: anUndeclaredChannelFailsNamingTheChannel - covers the second branch of 19.3
- extra: firstMatchingRuleGivesTheChannelAndAnotherTheKey - covers the MessageRouter merge rule
- extra: cartDeciderThrowsIllegalStateErrorOnARemovedProduct - covers DeciderSpecification for the throwing cases (Java `ShoppingCartTests`)

Existing tests it breaks
None expected; if a test from an earlier step breaks, update it in this step and say why.
```

---

## Step 3. Orders: placing, holding, compensating, retrying and canceling, with the workers' loop

Criteria groups: 5, 10, 6, 7, 24, 8, 9.

```text
Use the `implement-step` skill.

What to build
Part 1. Orders: placing an order and reading orders
Rewire for Q60 (after the first run of this step): orders gets its own store and read models, with `orders_order-<id>` and `orders_workflow-<orderId>` streams; messages between modules go through the broker database (`in-memory`) or straight into the receiving module's store (`none`). The orders module exists: the order entity (statuses `Opened`, `Confirmed`, `Completed`, `ClosedUnpaid`, `Canceled`) and the order workflow as an Emmett `Workflow` with the order as state, keyed by the order id, in inbox mode (Q4, Q23, Q25, Q47, Q65). Its `decide` holds the ported `OrderDecider` rules and its `evolve` only builds the order from the events; its clock stamps every decision (Q66). On `ShoppingCartCheckedOut` it decides `OrderPlaced` (order id derived from the cart id) and the output commands `AuthorizePayment` (payment id derived from the order id) and `ReserveStock`. A forwarder sends the workflow's output commands with the routings, retrying inside the handler (Q65). Customer commands go through `WorkflowHandler`. The `OrderStatus` and `CustomerOrder` read models and the endpoints `GET /customers/{customerId}/orders` and `GET /customers/{customerId}/orders/{orderId}` (conditional read, 1 s long polling, 404 after retries) exist.

Part 2. Orders: holding payment and stock, and completing
The order workflow decides payment authorization, stock reservation, confirmation (with the second hold), package sent with `OrderPaymentDue`, capture and completion, with Java's rules on payment ids, and outputs `RequestFulfillment` and `CapturePayment` as the Java `OrderSaga` does (Q65). Messages from other modules are sent into the module test as broker steps.

Part 3. Orders: compensation, the unpaid-orders worker and the workers' loop
Shipment and payment failures, `dueAt` from the payment terms (7 days), cancellation by the workflow, and the unpaid-orders worker over the `OrderAwaitingPayment` to-do list. The worker sends `CloseUnpaidOrder` as an input of the order workflow, which decides `OrderClosedUnpaid` itself (Q65); this step stores workers' and sandboxes' commands straight in the workflow inbox (the `store` variant of Q40); the `-internal` channel path (the `broker` variant, 22.3) comes in step 5. The core gets the workers' loop (every minute, Emmett's `delayOrAbort` between runs, stopped by an `AbortSignal`), and tests run the workers through the time step.

Part 4. Orders: retrying payment and canceling
`POST .../retry-payment` and `POST .../cancel` (202, 404 for unknown), with the order workflow's ported rules from Java (cancel only `Opened`; retried payment id from order id and attempt number); the API gives the commands to the workflow through `WorkflowHandler` (Q65).

Context
- Java: `../../../EventSourcing.JVM/samples/e-commerce/src/main/java/io/eventdriven/ecommerce/orders/` (`Order.java`, `OrderDecider.java`, `OrderSaga.java`, `OrderFacade.java`, `OrdersController.java`, `getorderstatus/`, `getcustomerorders/`).
- Emmett workflows: `../../../emmett/src/packages/emmett/src/workflows/workflowProcessor.ts` (inbox mode, `outputHandler` L268-283), `workflow.testHelpers.ts`.
- Step 4's orders module. Java `OrderDecider.java` (`progress`, `recordPaymentAuthorization` L50-51), `OrderSaga.java`.
- Step 5. Java `OrderDecider.java` L108-116 (shipment failure recorded at once, cancel held), `orders/unpaid/UnpaidOrdersWorker.java`, `ScheduledUnpaidOrdersWorker.java`, `PaymentTerms`, `ecommerce/Time.java`.
- Step 6. Java `OrdersController.java`, `OrderDecider.java` (`retryPayment`, `cancel`).

Similar code
- Java tests: `OrdersApiTests.java` (starts from `ShoppingCartCheckedOut`), `OrderTests.java`, `OrderSagaTests.java`.
- Emmett workflow tests: `../../../emmett/src/packages/emmett-postgresql/src/eventStore/consumers/postgreSQLEventStoreConsumer.workflow.int.spec.ts` (inbox and `outputHandler`).
- Java tests: `OrdersApiTests.ReceivingMessages`, `OrderTests.java`.
- Java tests: `OrdersApiTests`, `PurchaseTests` L233, L289, L390, L404; `UnpaidOrdersWorker` tests.
- Java tests: `OrdersApiTests.Cancelling` L90-L111, `RetryingOrderPayment`.

Blocked by
Step 2.

Acceptance criteria
- 5.1 GIVEN `ShoppingCartCheckedOut` arrives WHEN the order workflow handles it THEN the order, with the id derived from the cart id, has status `Opened` and stage `AwaitingPayment` AND `AuthorizePayment` (payment id derived from the order id) and `ReserveStock` are published. That `OrderPlaced` is the decided event is checked in the workflow's unit tests.
- 5.2 GIVEN the same `ShoppingCartCheckedOut` arrives twice WHEN the workflow handles both THEN one order exists AND `AuthorizePayment` and `ReserveStock` are published once each.
- 5.3 GIVEN the order was placed WHEN the order workflow's output is forwarded THEN `AuthorizePayment` (payment id derived from the order id) and `ReserveStock` are both published, each with its routing key.
- 10.1 GIVEN orders of a customer WHEN they get `/customers/{customerId}/orders` THEN they get the orders, newest first, with placed time, total, progress and whether they shipped.
- 10.2 GIVEN an order WHEN the customer gets its status THEN they get products, total, progress, stage, payment, shipment, carrier, tracking, current payment id and the possible actions (pay now, retry payment, cancel order) AND the `ETag`.
- 10.3 GIVEN a cart was just checked out and the order isn't placed yet WHEN the customer gets the order status THEN the lookup is retried for up to 1 s AND the response is 200 if the order appears, else 404.
- 10.4 GIVEN no order WHEN the customer gets its status THEN the response is 404.
- 10.5 GIVEN `If-None-Match` with the current version AND nothing newer arrives within 1 s WHEN the customer gets the status THEN the response is 304.
- 6.1 GIVEN an `Opened` order WHEN `PaymentAuthorized` and `StockReserved` both arrive, in any order THEN the order status is `Confirmed` with the payment id and the shipment id after the second one, and `RequestFulfillment` is published then.
- 6.2 GIVEN an order is confirmed WHEN the workflow's output is forwarded THEN `RequestFulfillment` is published.
- 6.3 GIVEN a `Confirmed` order with an authorized payment and reserved stock WHEN `PackageWasSent` arrives THEN the order shows the package as sent AND `CapturePayment` is published.
- 6.4 GIVEN a sent order WHEN `PaymentCaptured` arrives THEN the order status is `Completed`. The recorded events `OrderPaymentCaptured` and `OrderCompleted` are checked in the workflow's unit tests.
- 6.5 GIVEN an order whose payment is `Retrying` WHEN `PaymentAuthorized` arrives for the old payment id THEN the order does not change. Nothing recorded is checked in the workflow's unit tests.
- 6.6 GIVEN an `Opened` order with a pending payment WHEN `PaymentAuthorized` arrives with any payment id THEN the order shows the payment as authorized, as in Java.
- 6.7 GIVEN a sent order WHEN `PaymentCaptured` or `PaymentFailed` arrives for a payment id that is not the order's current one THEN the order does not change AND nothing is published.
- 6.8 GIVEN an order whose payment is authorized WHEN `payments.external.PaymentAuthorized` arrives again THEN the order does not change AND nothing is published. That the workflow decides no events is checked in its unit tests.
- 6.9 GIVEN a `Completed` order WHEN `shipments.external.PackageWasSent` arrives late THEN the order stays `Completed` AND nothing is published.
- 7.1 GIVEN an `Opened` order with a pending payment WHEN `ShipmentFailed` with `ProductsOutOfStock` arrives THEN the order shows the shipment failure at once AND stays `Opened`.
- 7.2 GIVEN that order WHEN the payment then answers with `PaymentAuthorized` THEN the order status is `Canceled` AND `CancelPayment` is published.
- 7.3 GIVEN a `Confirmed` order WHEN `ShipmentFailed` with `FulfillmentRejected` arrives THEN the order status is `Canceled` AND `CancelPayment` and `ReleaseStock` are published.
- 7.4 GIVEN an `Opened` order WHEN `PaymentFailed` arrives THEN the order stays `Opened` with `dueAt` 7 days after the failure.
- 7.5 GIVEN a `Confirmed` order that is not sent WHEN `PaymentFailed` arrives THEN the order status is `Canceled` AND `ReleaseStock` is published.
- 7.6 GIVEN a sent order whose capture failed WHEN time passes beyond `dueAt` THEN the unpaid-orders worker stores `CloseUnpaidOrder` as an input of the order workflow AND the order status is `ClosedUnpaid`.
- 7.7 GIVEN an `Opened` order whose payment failed WHEN time passes beyond `dueAt` THEN the order status is `Canceled`. The reason `PaymentFailed` is checked in the workflow's unit tests.
- 7.8 GIVEN an `Opened` order whose payment failed WHEN the worker runs before `dueAt` THEN the order stays `Opened`.
- 24.1 GIVEN workers are on WHEN the application runs THEN each worker's `handle(now)` runs every minute.
- 24.2 GIVEN the application stops WHEN shutdown runs THEN the workers' loop stops through its `AbortSignal`.
- 24.3 GIVEN workers are off (tests) WHEN a test step makes time pass THEN the clock moves AND each worker's `handle(now)` runs once.
- 8.1 GIVEN an order with a failed payment WHEN the customer posts `retry-payment` THEN the response is 202 AND the order shows a new current payment id derived from the order id and the attempt number AND `AuthorizePayment` is published for the new payment.
- 9.1 GIVEN an `Opened` order with a pending payment and reserved stock WHEN the customer posts `cancel` THEN the response is 202 AND the order status is `Canceled` AND only `ReleaseStock` is published (reason `Requested` is checked in the workflow's unit tests).
- 9.2 GIVEN a `Completed` order, or a `Confirmed` order that is paid and not sent WHEN the customer posts `cancel` THEN the response is 202 AND the order status does not change AND nothing is published.
- 9.3 GIVEN an unknown order WHEN the customer posts `cancel` THEN the response is 404.

Tests
- 5.1: aCheckedOutCartPlacesAnOrderWithTheDerivedId - asserts status `Opened`, stage `AwaitingPayment` and published `AuthorizePayment` and `ReserveStock` with derived ids
- 5.2: theSameCheckoutTwicePlacesOneOrder - asserts one order and one `AuthorizePayment` and `ReserveStock`
- 5.3: covered by 5.1's published `AuthorizePayment` and `ReserveStock` (Emmett appends one decision's outputs together, Q61), payment id derived
- 10.1: customerOrdersAreListedNewestFirst - asserts order of two orders and their fields
- 10.2: orderStatusShowsProgressActionsAndETag - asserts body fields and `ETag`
- 10.3: orderStatusRightAfterCheckoutWaitsUpTo1s - asserts 200 when the order appears within 1 s, else 404
- 10.4: anUnknownOrderAnswers404 - asserts 404
- 10.5: orderStatusWithTheCurrentVersionAnswers304 - asserts 304 after 1 s
- 6.1: bothHoldsInAnyOrderConfirmTheOrder - asserts status `Confirmed` with payment and shipment ids and published `RequestFulfillment`, for both orders of arrival
- 6.2: aConfirmedOrderRequestsFulfillment - asserts `RequestFulfillment` published
- 6.3: aSentPackageMakesThePaymentDueAndCapturesIt - asserts the sent package in the order and published `CapturePayment`
- 6.4: aCapturedPaymentCompletesTheOrder - asserts status `Completed`; the workflow's unit test asserts `OrderPaymentCaptured`, `OrderCompleted`
- 6.5: anOldPaymentAuthorizationWhileRetryingIsIgnored - asserts the order is unchanged; the unit test asserts no events
- 6.6: anyPaymentIdIsAcceptedWhileThePaymentIsPending - asserts the order shows the payment as authorized
- 6.7: captureOrFailureForAnotherPaymentIdIsIgnored - asserts the order is unchanged and nothing published
- 6.8: aRepeatedAuthorizationChangesNothing - asserts the order is unchanged and nothing published; the unit test asserts no events
- 6.9: aLatePackageSentOnACompletedOrderChangesNothing - asserts status `Completed` and nothing published
- 7.1: outOfStockWhilePaymentPendingShowsShipmentFailureAtOnce - asserts the shipment failure in the order, status `Opened`
- 7.2: thenAnAuthorizationCancelsTheOrderAndThePayment - asserts status `Canceled`, published `CancelPayment`
- 7.3: aRejectedFulfillmentCancelsAndReleases - asserts status `Canceled`, published `CancelPayment` and `ReleaseStock`
- 7.4: aPaymentFailureSetsDueAtIn7DaysAndKeepsTheOrderOpen - asserts status `Opened` and `dueAt`
- 7.5: aPaymentFailureOnAConfirmedOrderCancelsAndReleasesStock - asserts status `Canceled`, published `ReleaseStock`
- 7.6: afterDueAtASentUnpaidOrderIsClosedUnpaid - asserts `CloseUnpaidOrder` stored and status `ClosedUnpaid`
- 7.7: afterDueAtAnOpenedUnpaidOrderIsCanceled - asserts status `Canceled`; the unit test asserts reason `PaymentFailed`
- 7.8: beforeDueAtTheWorkerChangesNothing - asserts the order stays `Opened`
- 24.1: workersRunEveryMinute - asserts `handle(now)` calls; setup: the loop takes its interval as a parameter (production: 1 minute), the test passes 20 ms and waits for three calls; no global timer patching
- 24.2: shutdownStopsTheWorkersLoop - asserts no call after abort
- 24.3: aTimeStepMovesTheClockAndRunsEachWorkerOnce - asserts one call per worker
- 8.1: retryingAFailedPaymentStartsANewPayment - asserts 202, the new derived current payment id, published `AuthorizePayment`
- 9.1: cancelingAnUnpaidOrderReleasesTheStockOnly - asserts 202, status `Canceled`, published `ReleaseStock` only; the unit test asserts reason `Requested`
- 9.2: cancelingACompletedOrPaidOrderChangesNothing - asserts 202, unchanged status, nothing published
- 9.3: cancelingAnUnknownOrderAnswers404 - asserts 404
- extra: anotherCustomersOrderAnswers404 - covers the customer filter (Java `findStatus`)
- extra: packageSentBeforeConfirmationRecordsNothing - covers the guard (Confirmed, Authorized, Reserved) in the workflow's unit tests
- extra: aWorkerFailureDoesNotStopTheLoop - covers an error in one run
- extra: retryingWithoutAFailedPaymentChangesNothing - covers the workflow's guard (`WorkflowSpecification`)

Existing tests it breaks
None expected; if a test from an earlier step breaks, update it in this step and say why.
```

---

## Step 4. Payments and shipments

Criteria groups: 11, 12, 13, 14, 15, 16.

```text
Use the `implement-step` skill.

What to build
Part 1. Payments: authorize, capture, cancel, timeouts, the payment workflow and paying now
The payments module: the payment workflow keyed by the payment id, with the payment as state (Q44, Q65): its `decide` holds the ported `PaymentDecider` rules (`timesOutAt` 24 h; checkout session 30 min) and its `evolve` builds the payment from its events; its inputs are orders' commands, the timeout and expiry workers' commands and the provider sandbox's answers; the capture and authorization clients are its `outputHandler` (Q64); the forwarder with its `PaymentSummary` as an inline Pongo projection (the payment part of 19.6, and 19.2's `referenceId` key, re-checked by the tests below) mapping internal to external events; the `PendingPayment` and `AuthorizedPayment` to-do lists and their workers; the `PaymentProvider` fake. The orders endpoint `POST .../payments/{paymentId}/checkout-session` (303, 404, 409, 502). The authorization client logs failures with plain pino (Q41).

Part 2. Shipments: reserving, fulfilling and releasing stock
The shipments module: the shipment workflow keyed by the shipment id, with the shipment as state (Q44, Q65): its `decide` holds the ported `ShipmentDecider` rules (all or nothing, id derived from `referenceId`); the stock check goes through its `outputHandler`, whose answer comes back as the next input (Q67), and the call retries with back-off until the warehouse answers (Q37); its `evolve` builds the shipment from its events; its inputs are orders' commands and the warehouse's answers; the fulfillment client (logs failures with pino) is its `outputHandler` (Q64); the forwarder with `ShipmentSummary` as an inline Pongo projection (the shipment part of 19.6 and 19.2), and the `Warehouse` fake.

Context
- Java: `../../../EventSourcing.JVM/samples/e-commerce/src/main/java/io/eventdriven/ecommerce/payments/` (`PaymentDecider`, `PaymentFacade`, `authorization/`, `capture/CaptureGatewayClient.java`, `external/`, `sandbox/SandboxPaymentGateway.java`), `OrdersController.java` checkout session.
- Java: `../../../EventSourcing.JVM/samples/e-commerce/src/main/java/io/eventdriven/ecommerce/shipments/` (`ShipmentDecider`, `Shipment.java` `isStockHeld` L27-31, `fulfillment/`, `external/`, `sandbox/SandboxWarehouse.java`).

Similar code
- Java tests: `PaymentsApiTests.java`, `PaymentTests.java`, `PaymentExternalEventForwarderTests.java`, `payments/PaymentProvider.java` (fake).
- Java tests: `ShipmentsApiTests.java`, `ShipmentTests.java`, `shipments/Warehouse.java` (fake).

Blocked by
Step 3.

Acceptance criteria
- 11.1 GIVEN an order with a pending payment WHEN the customer posts `payments/{paymentId}/checkout-session` THEN the response is 303 to `/sandbox/checkout/{sessionId}`, with the order status page as success and cancel URL.
- 11.2 GIVEN an open checkout session WHEN the customer posts again THEN the response is 303 to the same session.
- 11.3 GIVEN an unknown payment or a payment of another reference WHEN the customer posts THEN the response is 404.
- 11.4 GIVEN a payment that is not pending WHEN the customer posts THEN the response is 409.
- 11.5 GIVEN the provider is unreachable WHEN the customer posts THEN the response is 502.
- 12.1 GIVEN `AuthorizePayment` WHEN the payment workflow handles it THEN nothing is published AND the payment-timeout worker times the payment out when time moves 24 hours, and not when it moves 24 hours minus 1 minute (the recorded `PaymentAuthorizationRequested` with `timesOutAt` is checked in the workflow's unit tests).
- 12.2 GIVEN the provider confirms WHEN `ConfirmPaymentAuthorization` arrives THEN the forwarder sends `payments.external.PaymentAuthorized` with the `referenceId`.
- 12.3 GIVEN a pending payment WHEN time passes beyond `timesOutAt` THEN the payment-timeout worker stores `TimeOutPayment` as an input of the payment workflow AND the forwarder publishes `payments.external.PaymentFailed` AND the provider's checkout session is expired (`expire-checkout-session`).
- 13.1 GIVEN an authorized payment WHEN `CapturePayment` arrives THEN the capture client asks the provider AND, on `ConfirmPaymentCapture`, the forwarder sends `payments.external.PaymentCaptured`.
- 13.2 GIVEN the provider refuses the capture WHEN the capture client asks THEN the capture client's answer `FailPaymentCapture` becomes the payment workflow's next input AND the forwarder publishes `payments.external.PaymentFailed` (the reason `UnexpectedError` is checked in the workflow's unit tests).
- 13.3 GIVEN an authorized payment WHEN time passes beyond `captureBefore` THEN the authorization-expiry worker stores `ExpirePaymentAuthorization` as an input of the payment workflow AND the forwarder publishes `payments.external.PaymentFailed`.
- 14.1 GIVEN an authorized payment WHEN `CancelPayment` arrives THEN the authorization client cancels at the provider.
- 14.2 GIVEN a captured payment WHEN `CancelPayment` arrives THEN the provider is not called AND nothing is published.
- 14.3 GIVEN a pending payment WHEN `TimeOutPayment` arrives before `timesOutAt` THEN the payment stays pending AND nothing is published.
- 15.1 GIVEN all products are available WHEN `ReserveStock` arrives THEN the warehouse is asked about the products AND `shipments.external.StockReserved` is published with the shipment id derived from the `referenceId`.
- 15.2 GIVEN one product is out of stock WHEN `ReserveStock` arrives THEN nothing is reserved AND the forwarder publishes `shipments.external.ShipmentFailed` with reason `ProductsOutOfStock`.
- 16.1 GIVEN a reserved shipment WHEN `RequestFulfillment` arrives THEN the fulfillment client asks the warehouse.
- 16.2 GIVEN the warehouse sends the package WHEN `ConfirmPackageSent` arrives THEN the forwarder publishes `shipments.external.PackageWasSent`.
- 16.3 GIVEN the warehouse rejects WHEN `RejectFulfillment` arrives THEN the forwarder publishes `shipments.external.ShipmentFailed` with reason `FulfillmentRejected`.
- 16.4 GIVEN a sent package WHEN `DeliverPackage` arrives THEN nothing is published. That `PackageWasDelivered` is recorded is checked in the workflow's unit tests.
- 16.5 GIVEN a reserved shipment WHEN `ReleaseStock` arrives THEN the stock is released and nothing is published. That the rejected-fulfillment branch also records `StockReleased` is checked in the workflow's unit tests.

Tests
- 11.1: payingNowRedirectsToTheProvidersCheckout - asserts 303 to the checkout URL the provider returns (the `PaymentProvider` fake's URL, as in Java); the sandbox's `/sandbox/checkout/{sessionId}` is checked in step 6
- 11.2: payingNowAgainReusesTheOpenSession - asserts the same `Location`
- 11.3: payingNowForAnUnknownOrForeignPaymentAnswers404 - asserts 404
- 11.4: payingNowForANonPendingPaymentAnswers409 - asserts 409
- 11.5: payingNowWithAnUnreachableProviderAnswers502 - asserts 502 with `isUnreachableFor`
- 12.1: authorizePaymentTimesOutAfter24hNotBefore - asserts nothing published, no timeout at 24 h minus 1 min and a timeout at 24 h; the unit test asserts `timesOutAt`
- 12.2: aConfirmedAuthorizationSendsPaymentAuthorizedWithReferenceId - asserts the external event
- 12.3: after24hAPendingPaymentTimesOut - asserts `TimeOutPayment` stored, published `payments.external.PaymentFailed`, `expire-checkout-session` called
- 13.1: captureAsksTheProviderAndSendsPaymentCaptured - asserts the provider call and the external event
- 13.2: aRefusedCaptureSendsPaymentFailed - asserts published `PaymentFailed` (with `refusesTheFirstCaptureOf`); the unit test asserts reason `UnexpectedError`
- 13.3: afterCaptureBeforeTheAuthorizationExpires - asserts `ExpirePaymentAuthorization` stored and published `PaymentFailed`
- 14.1: cancelingAnAuthorizedPaymentCancelsAtTheProvider - asserts the provider call
- 14.2: cancelingACapturedPaymentChangesNothing - asserts no provider call and nothing published
- 14.3: aTimeoutBeforeTimesOutAtChangesNothing - asserts the payment stays pending and nothing published
- 15.1: allProductsAvailableReservesStock - asserts the warehouse stock check and published external `StockReserved` with the derived id
- 15.2: oneProductOutOfStockReservesNothing - asserts published `ShipmentFailed` `ProductsOutOfStock`
- 16.1: aReservedShipmentRequestsFulfillment - asserts the warehouse call
- 16.2: aSentPackageIsForwarded - asserts published `PackageWasSent` with carrier and tracking
- 16.3: aRejectedFulfillmentSendsShipmentFailed - asserts published `ShipmentFailed` `FulfillmentRejected`
- 16.4: aDeliveredPackageSendsNothing - asserts nothing published; the unit test asserts `PackageWasDelivered`
- 16.5: releasingReservedStock - asserts the release and nothing published; the unit test asserts `StockReleased` for reserved and rejected states
- extra: aSecondCheckoutSessionIsNotRecordedWhileOneIsOpen - covers the payment workflow's rule (`WorkflowSpecification`)
- extra: authorizationClientLogsAndRecordsNothingOnProviderError - covers the logged failure
- extra: fulfillmentClientLogsAndRecordsNothingWhenUnreachable - covers `isUnreachableFor`
- extra: theStockCheckRetriesUntilTheWarehouseAnswers - covers `isUnreachableFor` for the stock check, then `StockReserved` is published (Q37, Q67)

Existing tests it breaks
None expected; if a test from an earlier step breaks, update it in this step and say why.
```

---

## Step 5. Kafka, RabbitMQ with PostgreSQL, workflow delivery and settings

Criteria groups: 20, 21, 22, 25.

```text
Use the `implement-step` skill.

What to build
Part 1. Kafka: forwarders, broker-to-workflow forwarders and consumers
The core's Kafka forwarder handler and Kafka consumer (Emmett's `consumer` with a `subscriptionMessageSource`, Q57) on `@platformatic/kafka` (Q5) with the Java topology, headers, retries, dead letters, restart and catch-up, and the application on Kafka with the PostgreSQL store (the Kafka + PostgreSQL setup, built after Part 2 adds the PostgreSQL store) and with the SQLite store (any pair works, Q42) (any pair works, Q42). Headers include the trace context through `@opentelemetry/api` `propagation.inject/extract`; the `messaging.dead_lettered` counter uses the Almanac meter, and tests read it with an in-memory metric reader. The shared forwarder and consumer suite from step 2 runs on Kafka too, which re-checks 19.1, 19.3, 19.4 and 19.5 for this target (protection for group 19, listed in step 2). Failure setups: stop and start the Kafka Testcontainer for 20.4 and 20.9; a 500 ms publish timeout in tests and a paused container for 20.3; an event store wrapper `FailingInboxWriteEventStore` for 20.5.

Part 2. RabbitMQ: forwarders, broker-to-workflow forwarders and consumers, on PostgreSQL
The core's RabbitMQ forwarder handler and RabbitMQ consumer (Emmett's `consumer` with a `subscriptionMessageSource`, Q57) on `amqplib` with the Java topology (quorum queues, DLX/DLQ, publisher confirms, mandatory sends on `-requests` and `-internal`), and the application on RabbitMQ with the PostgreSQL store and Pongo on PostgreSQL inline (Q38). Headers with trace context and the dead-letter counter as for Kafka. The shared suite runs on RabbitMQ too (re-checks 19.1, 19.3-19.5, protection). Failure setups: stop and start the RabbitMQ Testcontainer for 21.4 and 21.9; a 500 ms publish timeout and a paused container for 21.3; `FailingInboxWriteEventStore` for 21.5.

Part 3. Workflow delivery: retries, transactional checkpoints, delivery of own commands and causation
The workflows' forwarders and `outputHandler`s retry inside their handlers; the delivery of a module's own commands is chosen by `MESSAGING_INTERNAL_DELIVERY` (`store` or `broker`, Q40); correlation and causation follow Emmett and Almanac across brokers (Q31).

Part 4. Settings and the temporary SQLite file
All settings from the spec as environment variables, independent bus and store choice (Q42), the temporary SQLite file default removed on shutdown, a given file kept (Q21), the connection settings.

Context
- Java: `../../../EventSourcing.JVM/samples/e-commerce/src/main/java/io/eventdriven/core/messaging/kafka/KafkaMessageBus.java`, `KafkaVersionedMessageConverter`.
- Java: `../../../EventSourcing.JVM/samples/e-commerce/src/main/java/io/eventdriven/core/messaging/rabbitmq/RabbitMQMessageBus.java`.
- Emmett: `processors.ts` `reactor` with `processingScope` L1024-1110.
- Steps 6-12. Emmett `handleWorkflow.ts` L272-285 (correlation, causation).
- Steps 2-13 wire each setup; this step makes the settings the single way to choose.

Similar code
- Java tests: `MessageBusTests.java`, `KafkaMessageBusTests.java`, `KafkaMessageBusFailureTests.java`, `testing/messaging/kafka/FailingFirstSendKafkaTemplate.java`. Testcontainers: `@testcontainers/kafka`.
- Java tests: `RabbitMQMessageBusTests.java`, `RabbitMQMessageBusFailureTests.java`, `RabbitMQMessageBusRestartTests.java`. Testcontainers: `@testcontainers/rabbitmq`, PostgreSQL through `emmett-testcontainers`.
- Java: `core/messaging/MessageContext.java`, `ApiE2ESpecification` `expectCausation` as a reference for what to check.
- Java: `ECommerceSettingsTests.java`, `application.properties`.

Blocked by
Step 4.

Acceptance criteria
- 20.1 GIVEN queues bound with topic patterns (`*` one word, `#` zero or more) WHEN a message is sent THEN each queue whose pattern matches receives it.
- 20.2 GIVEN a queue bound with a pattern other than `#` THEN it gets its own topic, filled by a routing consumer that copies the matching records.
- 20.3 GIVEN the broker doesn't acknowledge a send within the publish timeout (10 s by default) THEN the send fails AND the forwarder retries with back-off.
- 20.4 GIVEN the broker is down WHEN the forwarder sends THEN the send fails AND the forwarder retries with back-off, without a limit, AND sends once the broker is back.
- 20.5 GIVEN a message from a Kafka queue for a workflow WHEN the broker-to-workflow forwarder takes it THEN it stores it in the workflow's inbox with `WorkflowHandler`'s store-only path AND commits the offset only after the store write (Q45).
- 20.6 GIVEN a handler that fails once WHEN the message arrives THEN the consumer retries with exponential back-off from the initial interval (1 s by default) AND the second attempt succeeds.
- 20.7 GIVEN a handler that keeps failing WHEN 2 retries run out THEN the message goes to `<queue>-dlt` AND the `messaging.dead_lettered` counter grows by 1 with the message type and the queue name.
- 20.8 GIVEN a message with an unknown type name, no type header, or bad JSON WHEN it arrives THEN it goes to `<queue>-dlt` without retries.
- 20.9 GIVEN the broker restarts WHEN the consumer reconnects THEN messages sent after the restart are handled.
- 20.10 GIVEN messages in flight WHEN a test waits for catch-up THEN the wait ends when every consumer group has committed the offsets that were the end offsets when the wait started.
- 20.11 GIVEN a sent message WHEN a consumer receives it THEN the headers have its type name, message id, correlation id, causation id and trace context.
- 21.1 GIVEN queues bound with topic patterns (`*` one word, `#` zero or more) WHEN a message is sent THEN each queue whose pattern matches receives it.
- 21.2 GIVEN a message on a `-requests` or `-internal` channel with no queue WHEN it is sent THEN the send fails. Responses and external events may have no queue.
- 21.3 GIVEN the broker doesn't confirm a send within the publish timeout (10 s by default) THEN the send fails AND the forwarder retries with back-off.
- 21.4 GIVEN the broker is down WHEN the forwarder sends THEN the send fails AND the forwarder retries with back-off, without a limit, AND sends once the broker is back.
- 21.5 GIVEN a message from a RabbitMQ queue for a workflow WHEN the broker-to-workflow forwarder takes it THEN it stores it in the workflow's inbox with `WorkflowHandler`'s store-only path AND acknowledges it only after the store write (Q45).
- 21.6 GIVEN a handler that fails once WHEN the message arrives THEN the consumer retries with exponential back-off from the initial interval (1 s by default) AND the second attempt succeeds.
- 21.7 GIVEN a handler that keeps failing WHEN 2 retries run out THEN the message goes to `<queue>-dlq` AND the `messaging.dead_lettered` counter grows by 1 with the message type and the queue name.
- 21.8 GIVEN a message with an unknown type name, no type header, or bad JSON WHEN it arrives THEN it goes to `<queue>-dlq` without retries.
- 21.9 GIVEN the broker restarts WHEN the consumer reconnects THEN messages sent after the restart are handled.
- 21.10 GIVEN messages in flight WHEN a test waits for catch-up THEN the wait ends when a probe message sent to each queue at the start of the wait has been seen by its consumer.
- 21.11 GIVEN a sent message WHEN a consumer receives it THEN the headers have its type name, message id, correlation id, causation id and trace context.
- 22.1 GIVEN the broker is down WHEN a forwarder sends a workflow's output command THEN it retries with back-off inside the handler AND the workflow processor doesn't stop (Q37).
- 22.2 GIVEN the workflow's `outputHandler` fails after the workflow appended its decision, on PostgreSQL or SQLite, WHEN the application restarts THEN the input is decided once AND the `outputHandler` runs again for the same output (Emmett runs the `outputHandler` as its own step after the decision commits, so its call is at least once) (Q72).
- 22.3 GIVEN the setting that delivers a module's own commands through the event store WHEN a worker sends `TimeOutPayment` THEN it is stored straight in the payment workflow's inbox in the payments store; GIVEN the setting for the broker THEN it goes through `payments-internal` and a reader stores it in that inbox (Q40, Q65).
- 22.4 GIVEN a module handles a message WHEN its handler appends events THEN their correlation id is the handled message's correlation id AND their causation id is the handled message's id, as Emmett and Almanac set them.
- 22.5 GIVEN an outside command (provider answer, warehouse answer, worker command) WHEN it is appended THEN its correlation and causation follow Emmett's and Almanac's rules for the current scope.
- 25.1 GIVEN `MESSAGING_BUS=rabbitmq` and `EVENTSTORE_TYPE=postgresql` WHEN the application is built THEN it has the RabbitMQ forwarders and consumers and the PostgreSQL event store; the same holds for `kafka` with `postgresql`, for `in-memory` with `sqlite`, and for `none` with `sqlite`.
- 25.2 GIVEN an unknown value, for example `MESSAGING_BUS=sqs` WHEN the application starts THEN it stops with a message naming the setting and the allowed values.
- 25.3 GIVEN the SQLite setup and no SQLite folder in the settings WHEN the application starts THEN it creates a new folder in the operating system's temporary folder with one file per module and `broker.db` (Q60) AND needs no Docker AND removes the folder on shutdown.
- 25.4 GIVEN a SQLite folder in the settings (`SQLITE_FOLDER`) WHEN the application stops and starts again THEN the carts and orders are still there AND the folder is not removed. A given folder that does not exist is created (Q72).

Tests
- 20.1: topicPatternsDeliverToEachMatchingQueue - asserts deliveries for `*` and `#`
- 20.2: aNonHashPatternGetsItsOwnTopicFilledByARoutingConsumer - asserts the topic and the copied records
- 20.3: aSendWithoutAcknowledgementWithinTheTimeoutFailsAndIsRetried - asserts the failure and the retry
- 20.4: withTheBrokerDownTheForwarderRetriesAndSendsWhenItIsBack - asserts delivery after restart
- extra: aModuleCanStillAppendWhileAForwarderRetriesADownBroker - on SQLite, appends to the store succeeds while a Kafka or RabbitMQ forwarder retries inside its processor transaction (the open point from step 2)
- 20.5: theOffsetIsCommittedOnlyAfterTheInboxWrite - asserts redelivery when the write fails
- 20.6: aHandlerFailingOnceSucceedsOnRetry - asserts two attempts
- 20.7: aHandlerFailingThreeTimesGoesToDltAndIsCounted - asserts `<queue>-dlt` and `messaging.dead_lettered` +1
- 20.8: anUnreadableMessageGoesToDltWithoutRetries - asserts one attempt
- 20.9: afterABrokerRestartNewMessagesAreHandled - asserts handling
- 20.10: catchUpWaitsForCommittedEndOffsets - asserts the wait ends after handling
- 20.11: headersCarryTypeIdsAndTraceContext - asserts the five headers
- 21.1: topicPatternsDeliverToEachMatchingQueue - asserts deliveries
- 21.2: anUnroutableRequestsOrInternalSendFails - asserts the failure, and no failure for a response channel
- 21.3: aSendWithoutConfirmWithinTheTimeoutFailsAndIsRetried - asserts the failure and the retry
- 21.4: withTheBrokerDownTheForwarderRetriesAndSendsWhenItIsBack - asserts delivery
- 21.5: theAckComesOnlyAfterTheInboxWrite - asserts redelivery when the write fails
- 21.6: aHandlerFailingOnceSucceedsOnRetry - asserts two attempts
- 21.7: aHandlerFailingThreeTimesGoesToDlqAndIsCounted - asserts `<queue>-dlq` and the counter
- 21.8: anUnreadableMessageGoesToDlqWithoutRetries - asserts one attempt
- 21.9: afterABrokerRestartNewMessagesAreHandled - asserts handling
- 21.10: catchUpEndsWhenEveryMessageSentBeforeTheWaitIsHandled - asserts the wait ends after handling
- 21.11: headersCarryTypeIdsAndTraceContext - asserts the five headers
- 22.1: aForwarderRetriesWhileTheBrokerIsDown - asserts the processor stays active and sends later (protects behaviour built in step 3; setup: a stopped broker container)
- 22.2: aFailedOutputHandlerRunsAgainAfterRestartAndTheInputIsDecidedOnce - asserts one decision and a second `outputHandler` call after restart on PostgreSQL and SQLite (setup: an `outputHandler` that throws once, then a consumer restart)
- 22.3: ownCommandsGoThroughTheStoreOrPaymentsInternal - asserts both settings
- 22.4: appendedEventsCarryTheHandledMessagesCorrelationAndCausation - asserts metadata across Kafka and RabbitMQ (protects Emmett's rules with the Kafka and RabbitMQ headers of step 5)
- 22.5: outsideCommandsFollowTheScopesCorrelation - asserts metadata (protects Emmett's rules)
- 25.1: settingsBuildTheChosenForwardersConsumersAndStore - asserts the built implementations for the three pairs
- 25.2: anUnknownValueStopsTheStartNamingTheSetting - asserts the message
- 25.3: withoutSqliteFolderATemporaryFolderIsCreatedAndRemoved - asserts the folder and its files exist while running and not after shutdown
- 25.4: aGivenSqliteFolderKeepsDataAcrossRestarts - asserts the cart after a restart and the folder still there
- extra: aSendIsPreparedForAllMessagesBeforeAnyIsSent - covers batch routing before sending
- extra: postgreSQLInlineProjectionsAreConsistentWithTheAppend - covers Q38 on PostgreSQL
- extra: aRestartContinuesAfterTheCheckpoint - covers resume
- extra: aMixedPairWorks - covers `kafka` + `sqlite`

Existing tests it breaks
None expected; if a test from an earlier step breaks, update it in this step and say why.
```

---

## Step 6. Purchases on the three setups, pages, sandboxes and browser tests

Criteria groups: 17, 18, 29.

```text
Use the `implement-step` skill.

What to build
Part 1. Purchases across modules on the three setups
One set of purchase scenarios that runs on SQLite without a broker, Kafka + PostgreSQL, and RabbitMQ + PostgreSQL.

Part 2. Pages and sandboxes
The shop pages with `hono/jsx` and htmx 4 (login, products, cart, orders, order status with polling and morphing, the being-placed page), the payment and warehouse sandbox pages, and links to Grafana and EventCatalog from the settings.

Part 3. Browser tests
A browser specification on top of the black box with the Playwright library inside Vitest, and the purchase through the pages.

Context
- Steps 2-14.
- Java: `ShopPages.java`, `ShoppingCartPages.java`, `OrderPages.java`, `SandboxCheckoutPage.java`, `SandboxWarehousePage.java`, `src/main/resources/templates/**`, `DemoProducts.java`.
- Step 16's pages.

Similar code
- Java: `PurchaseTests.java`, `PurchaseInMemoryTests.java`, `PurchaseOnKafkaTests.java`, `PurchaseOnRabbitMQTests.java`.
- Java page tests in `ShoppingCartsApiTests`/`OrdersApiTests` (`htmlContaining`, `redirectsTo`).
- Java: `testing/browser/BrowserE2ESpecification.java`, `shop/Customer.java`.

Blocked by
Step 5.

Acceptance criteria
- 17.1 GIVEN a checked-out cart WHEN the purchase starts THEN the order is `Opened` AND the stock is reserved.
- 17.2 GIVEN a placed order WHEN the customer pays at the provider sandbox, the warehouse sends the package and the capture succeeds THEN the order is `Completed`.
- 17.3 GIVEN a placed order WHEN the customer posts `checkout-session` THEN the response is 303 to the sandbox checkout page AND no `payments.external.PaymentAuthorized` is sent until the customer pays there.
- 17.4 GIVEN a product out of stock WHEN the customer checks out and pays THEN the order is `Canceled` AND the payment is canceled.
- 17.5 GIVEN a `Confirmed` order WHEN the warehouse rejects the request THEN the order is `Canceled` AND the payment is canceled AND the stock is released.
- 17.6 GIVEN a placed order WHEN the customer never pays and 24 hours pass THEN the payment times out AND the order stays `Opened` until `dueAt` AND then is `Canceled`.
- 17.7 GIVEN a sent order WHEN the capture fails THEN the order waits for payment AND the customer retries the payment AND the order is `Completed`.
- 17.8 GIVEN a sent order whose capture failed WHEN time passes beyond `dueAt` THEN the order is `ClosedUnpaid`.
- 17.9 GIVEN an `Opened` order with a pending payment WHEN the customer cancels THEN the stock is released.
- 18.1 GIVEN a visitor WHEN they open `/shop` THEN they log in with a name only (an HttpOnly `customer` cookie) AND see the five demo products, the last one sold out.
- 18.2 GIVEN a logged-in customer WHEN they add and remove products THEN the cart page shows the change, waiting up to 1 s for the read model.
- 18.3 GIVEN a cart WHEN the customer checks out THEN they are redirected to the order page, which shows "being placed" until the order exists, with a `<meta refresh>` fallback without JavaScript.
- 18.4 GIVEN an order page WHEN the order changes THEN htmx polls every second while the order is not final AND the order part updates in place (304 when nothing changed within 1 s).
- 18.5 GIVEN an order page WHEN the customer cancels or retries payment through the forms THEN the page shows the new state.
- 18.6 GIVEN the payment sandbox page WHEN the customer pays with card `4242424242424242` THEN the sandbox stores `ConfirmPaymentAuthorization` with `captureBefore` 7 days later as an input of the payment workflow AND redirects (303) to the success URL.
- 18.7 GIVEN the payment sandbox page WHEN the customer pays with card `4000000000000002` THEN the payment is declined AND the page stays.
- 18.8 GIVEN the warehouse sandbox page WHEN a person sends a package THEN the warehouse stores `ConfirmPackageSent` with carrier "Sandbox Express" as an input of the shipment workflow; WHEN they reject THEN it stores `RejectFulfillment`; WHEN they deliver THEN it stores `DeliverPackage`.
- 18.9 GIVEN the warehouse sandbox page WHEN a person marks a product out of stock THEN later `ReserveStock` for that product fails with `ProductsOutOfStock` AND no command is appended.
- 18.10 GIVEN any page WHEN it renders THEN it links to the Grafana and EventCatalog URLs from the settings.
- 29.1 GIVEN the SQLite setup WHEN a test buys through the pages with Playwright THEN the order page shows the completed order AND no response failed.
- 29.2 GIVEN two tabs WHEN the order changes in one THEN the other shows the change in place.

Tests
- 17.1: aCheckoutPlacesTheOrderAndReservesStock - asserts `Opened` and reserved
- 17.2: aPaidSentAndCapturedOrderCompletes - asserts `Completed`
- 17.3: payingNowSendsNothingUntilTheCustomerPays - asserts 303 and no `PaymentAuthorized`
- 17.4: anOutOfStockProductCancelsTheOrderAndThePayment - asserts `Canceled` and canceled payment
- 17.5: aRejectedFulfillmentCancelsReleasesAndCancelsThePayment - asserts all three
- 17.6: aNeverPaidOrderIsCanceledAfterDueAt - asserts the timeout, `Opened` until `dueAt`, then `Canceled`
- 17.7: aFailedCaptureCanBePaidAgain - asserts `Completed` after the retry
- 17.8: aFailedCapturePastDueAtIsClosedUnpaid - asserts `ClosedUnpaid`
- 17.9: cancelingAnUnpaidOrderReleasesTheStock - asserts released
- 18.1: loggingInShowsFiveProductsWithTheLastSoldOut - asserts the HttpOnly cookie and the products
- 18.2: theCartPageShowsAddsAndRemoves - asserts the lines
- 18.3: checkoutRedirectsToTheBeingPlacedPage - asserts the redirect and `<meta refresh>`
- 18.4: theOrderPartPollsAndAnswers304WhenUnchanged - asserts `hx-trigger every 1s` while not final and 304
- 18.5: cancelAndRetryFormsShowTheNewState - asserts the page after each
- 18.6: card4242ConfirmsAndRedirects - asserts `ConfirmPaymentAuthorization` with `captureBefore` +7 days and 303
- 18.7: card0002IsDeclined - asserts the page stays and nothing stored
- 18.8: warehouseButtonsStoreTheirCommands - asserts each command and carrier "Sandbox Express"
- 18.9: markingOutOfStockFailsLaterReservations - asserts `ProductsOutOfStock` and no command
- 18.10: pagesLinkToGrafanaAndEventCatalog - asserts the URLs
- 29.1: aCustomerBuysThroughThePages - asserts the completed order page and no failed response
- 29.2: aSecondTabShowsTheChangeInPlace - asserts the update without reload
- extra: pagesWithoutTheCustomerCookieRedirectToLogin - covers logged-out access

Existing tests it breaks
None expected; if a test from an earlier step breaks, update it in this step and say why.
```

---

## Step 7. API documentation, EventCatalog, contract snapshots and telemetry

Criteria groups: 27, 28, 30.

```text
Use the `implement-step` skill.

What to build
Part 1. OpenAPI, AsyncAPI, their UIs and EventCatalog
OpenAPI from Zod schemas with `@hono/zod-openapi`, AsyncAPI built from the routings and Zod schemas and checked with `@asyncapi/parser`, Swagger UI and the AsyncAPI React page with a publish page (Q39), and the EventCatalog generation with its Playwright test.

Part 2. Contract snapshots
Vitest `toMatchFileSnapshot` for every stored event, sent message and HTTP body, all-fields and required-only variants, a backward-compatibility test, and CI failing on missing snapshots.

Part 3. Telemetry
Almanac with the OpenTelemetry provider exporting traces, metrics and logs over OTLP to otel-lgtm (Docker Compose with `GF_PLUGINS_PREINSTALL_AUTO_UPDATE=false`), trace context in broker headers, the business metrics, counters at 0 (the sample registers them itself until the Emmett fix of step 8 is released, then switches, Q49), Grafana dashboards and alerts on Emmett's metric names, and `now` set by the facades. Automated tests here cover 30.3, 30.6 and 30.7; 30.1, 30.2, 30.4 and 30.5 get tests in the telemetry follow-up spec (Out of Scope), so this step checks them by running the app against otel-lgtm once and reporting what it saw.

Context
- Java: `ECommerceDocumentationConfig`, `EventCatalogMessageTypes.java`, `../../../EventSourcing.JVM/samples/e-commerce/eventcatalog/`.
- All message and body types from steps 2-6.
- Java: `../../../EventSourcing.JVM/samples/e-commerce/observability/`, `OrderMetrics.java`, `docker-compose.yml`, `NoOtlpEndpointTests.java`.

Similar code
- Java: `ECommerceDocumentationTests.java`, the EventCatalog Playwright tests in `../../../EventSourcing.JVM/samples/e-commerce/eventcatalog`.
- Java: `*ContractTests.java`, `testing/contracts/Contracts.java`.
- Java: `OtlpExportTests.java`, `testing/grafana/GrafanaApi.java` (follow-up reference).

Blocked by
Step 6.

Acceptance criteria
- 27.1 GIVEN the running application WHEN a developer opens the OpenAPI document THEN it has the shopping-cart and order endpoints in two groups, with `x-eventcatalog-message-type` `query` for `GET` and `command` for the rest.
- 27.2 GIVEN the running application WHEN a developer opens the AsyncAPI document THEN it has one group per module, with each module's channels, the messages it sends and receives, their descriptions and schemas, servers for Kafka, RabbitMQ and in memory, and `x-eventcatalog-message-type` `command` for commands and `event` for events.
- 27.3 GIVEN the OpenAPI and AsyncAPI documents WHEN EventCatalog is generated THEN the site shows the four modules as services, their commands as commands and their events as events, and the channels, AND its Playwright test passes.
- 28.1 GIVEN a stored event, a sent message or an HTTP body WHEN its serialized form changes THEN its snapshot test fails.
- 28.2 GIVEN a message with optional fields WHEN it is serialized with all fields and with only the required ones THEN each form has its own snapshot.
- 28.3 GIVEN a snapshot of an `OrderCanceled` without a shipment id WHEN it is read with the current code THEN `shipmentId` is `undefined`.
- 28.4 GIVEN a missing snapshot on CI WHEN the tests run THEN they fail.
- 30.1 GIVEN the application exports to otel-lgtm WHEN a customer buys THEN one trace shows the purchase across the modules and the brokers.
- 30.2 GIVEN the running application WHEN an order is paid, sent and completed THEN `ecommerce.order.revenue` records the total, `ecommerce.order.lead.time` records the time per stage (`paid`, `sent`, `completed`), and the gauges `ecommerce.orders.in.progress` and `ecommerce.orders.awaiting.payment` show the counts.
- 30.3 GIVEN the application started WHEN no command ran yet THEN Emmett's command and event counters exist at 0 for every command and event type of each module, through the Emmett fix of #433 (Q35).
- 30.4 GIVEN the Grafana dashboards WHEN they load THEN every panel query is valid against Emmett's metric names.
- 30.5 GIVEN a capture fails for the first time after a start WHEN the alert rule evaluates THEN the "Capture failed" alert fires.
- 30.6 GIVEN no OTLP endpoint is reachable WHEN the application runs THEN it logs no connection errors.
- 30.7 GIVEN a command from the broker WHEN the workflow decides it THEN the workflow stamps the decision with its own clock, not the sender's (Java behaviour, Q66).

Tests
- 27.1: openApiHasTwoGroupsWithMessageTypes - asserts groups and `x-eventcatalog-message-type`
- 27.2: asyncApiHasOneGroupPerModuleWithServersAndMessageTypes - asserts groups, channels, servers, markers
- 27.3: eventCatalogShowsServicesCommandsEventsAndChannels - asserts the generated site through Playwright
- 28.1: aChangedSerializedFormFailsItsSnapshot - asserts the snapshot test fails; setup: run Vitest in a subprocess on a copy of one snapshot with a renamed field
- 28.2: optionalFieldsHaveAllFieldsAndRequiredOnlySnapshots - asserts two files
- 28.3: anOldOrderCanceledWithoutShipmentIdReadsUndefined - asserts `shipmentId` is `undefined`
- 28.4: aMissingSnapshotFailsOnCI - asserts failure; setup: run Vitest in a subprocess with `CI=true` and one snapshot file removed
- 30.1: (follow-up spec) - checked by hand in this step: one trace in Tempo across modules and brokers
- 30.2: (follow-up spec) - checked by hand: the four business metrics in Prometheus
- 30.3: emmettCountersStartAtZeroForEveryModuleType - asserts 0-valued series at startup with an in-memory metric reader
- 30.4: (follow-up spec) - checked by hand: every panel query valid
- 30.5: (follow-up spec) - checked by hand: the alert fires on the first capture failure
- 30.6: noOtlpEndpointLogsNoConnectionErrors - asserts the captured logs
- 30.7: aWorkflowStampsItsDecisionsWithItsClock - asserts the decision's time equals the fake clock, not the sender's
- extra: asyncApiDocumentIsValid - covers `@asyncapi/parser`
- extra: thePublishPageSendsAMessageToTheApplication - covers the Springwolf-like publish

Existing tests it breaks
None expected; if a test from an earlier step breaks, update it in this step and say why.
```

---

## Step 8. Emmett pull requests: Hono ApiE2ESpecification, metric series at zero (#433), processor retry policy

Criteria groups: none.

```text
Use the `implement-step` skill.

What to build
Part 1. Emmett: Hono ApiE2ESpecification takes steps and hooks
In the Emmett repository, on the branch `hono_api_e2e_specification_steps` (already created from `main`), `emmett-honojs`' `ApiE2ESpecification` gets the shape the sample's core built in step 1 (Q30, Q49): message, time and attempt steps, start and stop hooks, the catch-up loop, and the expectations, including the check of events the `when` step appended, named `expectNewEvents` and `expectNoNewEvents` with the core's strictness (exact streams and counts, stream order free, Q58), and the Hono docs updated on the same branch, as [emmett#436](https://github.com/event-driven-io/emmett/issues/436) proposes (given requests or event streams in one specification). Given requests keep today's behaviour (Q50). It runs in parallel with the sample; when Oskar releases it, the sample switches to it. Do not commit, push or publish; leave the branch for Oskar.

Part 2. Emmett: metric series registered at zero (#433)
In the Emmett repository, on a new branch from `main` (independent of other branches, Q36, Q49), command and event counters are registered at 0 for every known type when a handler or store is set up, so Prometheus `increase()` sees the first failure (Q35). It runs in parallel with the sample; the sample doesn't wait (Q49). Do not commit, push or publish; leave the branch for Oskar.

Part 3. Emmett: processor retry policy
In the Emmett repository, on a new branch from `main` (Q36, Q37), processors get an optional retry policy with exponential back-off, so a failing handler is retried instead of stopping the processor. The sample keeps its handler retries until Oskar merges and releases it (Q49). Do not commit, push or publish; leave the branch for Oskar.

Context
- `../../../emmett/src/packages/emmett-honojs/src/testing/apiE2ESpecification.ts`, `apiSpecification.ts`, `apiE2ESpecification.int.spec.ts`; the sample's core `ApiE2ESpecification` from step 1.
- `../../../emmett/src/packages/emmett/src/observability/attributes.ts` (metric names), `commandHandling/observability/commandHandlerCollector.ts`, `eventStore/observability/eventStoreCollector.ts`. Issue #433.
- `../../../emmett/src/packages/emmett/src/processors/processors.ts` L662-690, L1150-1155 (error to `STOP`), `consumers/consumers.ts` L455.

Similar code
- The sample core's tests from step 1; Java `ApiE2ESpecificationTests.java`.
- Java: `core/commands/CommandHandler.java` `countAtZero`, `CommandHandlerTests.everyCommandTypeIsCountedAtZeroBeforeItsFirstCommand`.
- Java: `core/processing/RetryBackOff.java`, `RetryBackOffTests.java`.

Blocked by
Step 1 (ports the shape built there); independent of steps 2-7, runs in parallel with them (Q49).

Acceptance criteria
None from the spec; the step serves the Testing Decisions and Q&A named above.

Tests
- extra: aRequestOnlySpecificationWorksAsToday - covers existing usage unchanged
- extra: the step-1 helper tests, ported - cover steps, hooks, catch-up and expectations
- extra: everyCommandTypeIsCountedAtZeroBeforeItsFirstCommand - covers success and failure series at 0
- extra: everyEventTypeIsCountedAtZeroBeforeItsFirstAppend - covers event series
- extra: aFailingHandlerIsRetriedWithBackOffAndThenSucceeds - covers retry
- extra: withoutAPolicyAnErrorStillStopsTheProcessor - covers today's default
- extra: theCheckpointDoesNotMoveWhileRetrying - covers checkpoint safety

Existing tests it breaks
None expected; if a test from an earlier step breaks, update it in this step and say why.
```

---
