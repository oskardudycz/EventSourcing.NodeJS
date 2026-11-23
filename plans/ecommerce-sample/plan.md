# Plan: E-commerce sample on Emmett

Revision: 4. Built from spec r6.

Spec: `spec.md`. Q&A: `qa.md`.

## Terms

- **Node.js repository**: `~/repos/EventSourcing.NodeJS`; the sample lives in `samples/e-commerce` (Q1).
- **Emmett repository**: `~/repos/emmett`; work on the named branch, normal checkout, no worktrees. Emmett steps run in parallel with the sample; the sample doesn't wait for them (Q49).
- **Core package**: the workspace package with the business-agnostic code Emmett lacks (Q16).
- **Forwarder**: an Emmett reactor on the event store consumer, registered with `consumer.reactor({ processorId, canHandle, eachMessage })`, whose handler sends what a module recorded to Kafka, RabbitMQ or a channel stream; the reactor then saves its checkpoint (Q22, Q57). The core supplies only the handler (`forwardToChannels` for channel streams).
- **Broker-to-workflow forwarder**: a reactor on a queue or channel stream whose handler (`toWorkflowInbox`) stores the message in a workflow's inbox with `WorkflowHandler`'s store-only path (Q45).
- **Workflow**: an Emmett `Workflow` without state in inbox mode: order, payment, shipment (Q4, Q23, Q44, Q47).
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
The same step builds what checkout needs, because neither part is usable alone: the core's routings (type to channel and routing key, Java `MessageRouter` rules), the forwarder as the `eachMessage` handler of an Emmett reactor on the event store consumer (Q22, Q57), retrying with back-off inside its handler (Q24, Q37), and channels as streams (Q51, Q55): each channel is a stream `channel:<name>`, the forwarder appends to it, and readers are reactors with `canHandle` that handle a message only from the channel stream and with a matching binding key; a reader stores a message in a workflow's inbox through `WorkflowHandler`'s store-only path, or passes a module's own command to its handler. With `MESSAGING_BUS=none` (Q56) there are no channel streams: the cart appends its external event to `shopping_carts:external:<cartId>`. The cart API tests run on both settings. Tests observe what was published through a recording reactor in the test application; like Java's `expectPublished`, it also lists a module's commands to itself. Type names get module prefixes (Q17, Q29); an old name is mapped with Emmett's `upcast` (Q54). The cart module checks out: the facade appends `ShoppingCartCheckedOut`, an inline Pongo projection keeps the `ShoppingCartSummary` (Q38), and the cart forwarder reads it and sends `shopping_carts.external.ShoppingCartCheckedOut` (19.6, cart part). The cart module checks out: the facade appends `ShoppingCartCheckedOut`, and the cart forwarder updates its `ShoppingCartSummary` and sends `shopping_carts.external.ShoppingCartCheckedOut` in one handler (19.6, cart part).

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
- 19.8 GIVEN `MESSAGING_BUS=none` WHEN the cart is checked out THEN `shopping_carts.external.ShoppingCartCheckedOut` is appended to `shopping_carts:external:<cartId>` AND readers take it by `canHandle` (Q56).
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
- 19.8: the cart API tests of checkout run on `in-memory` and `none`; they assert the published event, not yet its stream name
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
The orders module exists: the ported decider and entity (statuses `Opened`, `Confirmed`, `Completed`, `ClosedUnpaid`, `Canceled`), the facade (sets `now`), and the order workflow as an Emmett `Workflow` without state, keyed by the order id, in inbox mode (Q4, Q23, Q25, Q47). The workflow reacts to `ShoppingCartCheckedOut` with `PlaceOrder` (order id derived from the cart id) and to `OrderPlaced` with `AuthorizePayment` (payment id derived from the order id) and `ReserveStock`. Its `outputHandler` sends recorded outputs with the routings, retrying inside the handler. The `OrderStatus` and `CustomerOrder` read models and the endpoints `GET /customers/{customerId}/orders` and `GET /customers/{customerId}/orders/{orderId}` (conditional read, 1 s long polling, 404 after retries) exist.

Part 2. Orders: holding payment and stock, and completing
The order decider records payment authorization, stock reservation, confirmation (in the same append as the second hold), package sent with `OrderPaymentDue`, capture and completion, with Java's rules on payment ids. The workflow reacts to `PaymentAuthorized`, `StockReserved`, `OrderConfirmed`, `PackageWasSent`, `OrderPaymentDue` and `PaymentCaptured` as in the Java `OrderSaga`. Messages from other modules are sent into the module test as broker steps.

Part 3. Orders: compensation, the unpaid-orders worker and the workers' loop
Shipment and payment failures, `dueAt` from the payment terms (7 days), cancellation by the workflow, and the unpaid-orders worker over the `OrderAwaitingPayment` to-do list. The worker stores `CloseUnpaidOrder` as an input of the order's workflow (Q22, Q44), and the workflow passes it on to the orders handler; this step uses the default `broker` delivery through the channel streams' handler reactor from step 2 (22.3 and its `store` variant come in step 5). The core gets the workers' loop (every minute, `node:timers/promises` `setInterval`, stopped by an `AbortSignal`), and tests run the workers through the time step.

Part 4. Orders: retrying payment and canceling
`POST .../retry-payment` and `POST .../cancel` (202, 404 for unknown), with the decider rules from Java (cancel only `Opened`; retried payment id from order id and attempt number) and the workflow reactions to `OrderPaymentRetried` and `OrderCanceled`.

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
- 5.1 GIVEN `ShoppingCartCheckedOut` arrives WHEN the workflow handles it THEN it sends `PlaceOrder` with the order id derived from the cart id AND the order records `OrderPlaced` with status `Opened`.
- 5.2 GIVEN the same `ShoppingCartCheckedOut` arrives twice WHEN the workflow handles both THEN the order is placed once.
- 5.3 GIVEN `OrderPlaced` WHEN the workflow handles it THEN it records `AuthorizePayment` (payment id derived from the order id) and `ReserveStock` in one append to its stream AND both are sent.
- 10.1 GIVEN orders of a customer WHEN they get `/customers/{customerId}/orders` THEN they get the orders, newest first, with placed time, total, progress and whether they shipped.
- 10.2 GIVEN an order WHEN the customer gets its status THEN they get products, total, progress, stage, payment, shipment, carrier, tracking, current payment id and the possible actions (pay now, retry payment, cancel order) AND the `ETag`.
- 10.3 GIVEN a cart was just checked out and the order isn't placed yet WHEN the customer gets the order status THEN the lookup is retried for up to 1 s AND the response is 200 if the order appears, else 404.
- 10.4 GIVEN no order WHEN the customer gets its status THEN the response is 404.
- 10.5 GIVEN `If-None-Match` with the current version AND nothing newer arrives within 1 s WHEN the customer gets the status THEN the response is 304.
- 6.1 GIVEN an `Opened` order WHEN `PaymentAuthorized` and `StockReserved` both arrive, in any order THEN the order records each AND, with the second, `OrderConfirmed` with the payment id and the shipment id in the same append.
- 6.2 GIVEN `OrderConfirmed` WHEN the workflow handles it THEN it sends `RequestFulfillment`.
- 6.3 GIVEN a `Confirmed` order with an authorized payment and reserved stock WHEN `PackageWasSent` arrives THEN the order records `OrderPackageSent` and `OrderPaymentDue` AND the workflow sends `CapturePayment`.
- 6.4 GIVEN a sent order WHEN `PaymentCaptured` arrives THEN the order records `OrderPaymentCaptured` and `OrderCompleted`.
- 6.5 GIVEN an order whose payment is `Retrying` WHEN `PaymentAuthorized` arrives for the old payment id THEN the order records nothing.
- 6.6 GIVEN an `Opened` order with a pending payment WHEN `PaymentAuthorized` arrives with any payment id THEN the order records `OrderPaymentAuthorized`, as in Java.
- 6.7 GIVEN a sent order WHEN `PaymentCaptured` or `PaymentFailed` arrives for a payment id that is not the order's current one THEN the order records nothing.
- 6.8 GIVEN an order that recorded `OrderPaymentAuthorized` WHEN `RecordOrderPaymentAuthorization` arrives again THEN the decider returns no events AND nothing is appended.
- 6.9 GIVEN a `Completed` order WHEN `RecordOrderPackageSent` arrives late THEN nothing is appended.
- 7.1 GIVEN an `Opened` order with a pending payment WHEN `ShipmentFailed` with `ProductsOutOfStock` arrives THEN the order records `OrderShipmentFailed` at once AND stays `Opened`.
- 7.2 GIVEN that order WHEN the payment then answers with `PaymentAuthorized` THEN the order records `OrderPaymentAuthorized` and `OrderCanceled` AND the workflow sends `CancelPayment`.
- 7.3 GIVEN a `Confirmed` order WHEN `ShipmentFailed` with `FulfillmentRejected` arrives THEN the order records `OrderShipmentFailed` and `OrderCanceled` AND the workflow sends `CancelPayment` and `ReleaseStock`.
- 7.4 GIVEN an `Opened` order WHEN `PaymentFailed` arrives THEN the order records `OrderPaymentFailed` with `dueAt` 7 days after the failure AND stays `Opened`.
- 7.5 GIVEN a `Confirmed` order that is not sent WHEN `PaymentFailed` arrives THEN the order records `OrderPaymentFailed` and `OrderCanceled` AND the workflow sends `ReleaseStock`.
- 7.6 GIVEN a sent order whose capture failed WHEN time passes beyond `dueAt` THEN the unpaid-orders worker appends `CloseUnpaidOrder` AND the order records `OrderClosedUnpaid`.
- 7.7 GIVEN an `Opened` order whose payment failed WHEN time passes beyond `dueAt` THEN the order records `OrderCanceled` with reason `PaymentFailed`.
- 7.8 GIVEN an `Opened` order whose payment failed WHEN the worker runs before `dueAt` THEN nothing is appended.
- 24.1 GIVEN workers are on WHEN the application runs THEN each worker's `handle(now)` runs every minute.
- 24.2 GIVEN the application stops WHEN shutdown runs THEN the workers' loop stops through its `AbortSignal`.
- 24.3 GIVEN workers are off (tests) WHEN a test step makes time pass THEN the clock moves AND each worker's `handle(now)` runs once.
- 8.1 GIVEN an order with a failed payment WHEN the customer posts `retry-payment` THEN the response is 202 AND the order records `OrderPaymentRetried` with a new payment id derived from the order id and the attempt number AND the workflow sends `AuthorizePayment` for the new payment.
- 9.1 GIVEN an `Opened` order with a pending payment and reserved stock WHEN the customer posts `cancel` THEN the response is 202 AND the order records `OrderCanceled` with reason `Requested` AND the workflow sends `ReleaseStock` only.
- 9.2 GIVEN a `Completed` order, or a `Confirmed` order that is paid and not sent WHEN the customer posts `cancel` THEN the response is 202 AND nothing is appended.
- 9.3 GIVEN an unknown order WHEN the customer posts `cancel` THEN the response is 404.

Tests
- 5.1: aCheckedOutCartPlacesAnOrderWithTheDerivedId - asserts `PlaceOrder` and `OrderPlaced` with status `Opened`
- 5.2: theSameCheckoutTwicePlacesOneOrder - asserts one `OrderPlaced`
- 5.3: aPlacedOrderAsksForPaymentAndStockInOneAppend - asserts both outputs in one workflow append and both sent, payment id derived
- 10.1: customerOrdersAreListedNewestFirst - asserts order of two orders and their fields
- 10.2: orderStatusShowsProgressActionsAndETag - asserts body fields and `ETag`
- 10.3: orderStatusRightAfterCheckoutWaitsUpTo1s - asserts 200 when the order appears within 1 s, else 404
- 10.4: anUnknownOrderAnswers404 - asserts 404
- 10.5: orderStatusWithTheCurrentVersionAnswers304 - asserts 304 after 1 s
- 6.1: bothHoldsInAnyOrderConfirmTheOrderInTheSameAppend - asserts `OrderConfirmed` with payment and shipment ids, for both orders of arrival
- 6.2: aConfirmedOrderRequestsFulfillment - asserts `RequestFulfillment` sent
- 6.3: aSentPackageMakesThePaymentDueAndCapturesIt - asserts `OrderPackageSent`, `OrderPaymentDue`, `CapturePayment`
- 6.4: aCapturedPaymentCompletesTheOrder - asserts `OrderPaymentCaptured`, `OrderCompleted`
- 6.5: anOldPaymentAuthorizationWhileRetryingIsIgnored - asserts nothing appended
- 6.6: anyPaymentIdIsAcceptedWhileThePaymentIsPending - asserts `OrderPaymentAuthorized`
- 6.7: captureOrFailureForAnotherPaymentIdIsIgnored - asserts nothing appended
- 6.8: aRepeatedAuthorizationRecordsNothing - asserts no events
- 6.9: aLatePackageSentOnACompletedOrderRecordsNothing - asserts nothing appended
- 7.1: outOfStockWhilePaymentPendingRecordsShipmentFailureAtOnce - asserts `OrderShipmentFailed`, status `Opened`
- 7.2: thenAnAuthorizationCancelsAndCancelsThePayment - asserts `OrderPaymentAuthorized`, `OrderCanceled`, `CancelPayment`
- 7.3: aRejectedFulfillmentCancelsAndReleases - asserts `OrderShipmentFailed`, `OrderCanceled`, `CancelPayment` and `ReleaseStock`
- 7.4: aPaymentFailureSetsDueAtIn7DaysAndKeepsTheOrderOpen - asserts `OrderPaymentFailed.dueAt`
- 7.5: aPaymentFailureOnAConfirmedOrderCancelsAndReleasesStock - asserts `OrderCanceled`, `ReleaseStock`
- 7.6: afterDueAtASentUnpaidOrderIsClosedUnpaid - asserts `CloseUnpaidOrder` stored and `OrderClosedUnpaid`
- 7.7: afterDueAtAnOpenedUnpaidOrderIsCanceled - asserts `OrderCanceled` reason `PaymentFailed`
- 7.8: beforeDueAtTheWorkerAppendsNothing - asserts nothing appended
- 24.1: workersRunEveryMinute - asserts `handle(now)` calls; setup: the loop takes its interval as a parameter (production: 1 minute), the test passes 20 ms and waits for three calls; no global timer patching
- 24.2: shutdownStopsTheWorkersLoop - asserts no call after abort
- 24.3: aTimeStepMovesTheClockAndRunsEachWorkerOnce - asserts one call per worker
- 8.1: retryingAFailedPaymentStartsANewPayment - asserts 202, `OrderPaymentRetried` with derived id, `AuthorizePayment`
- 9.1: cancelingAnUnpaidOrderReleasesTheStockOnly - asserts 202, `OrderCanceled` `Requested`, `ReleaseStock` only
- 9.2: cancelingACompletedOrPaidOrderChangesNothing - asserts 202, nothing appended
- 9.3: cancelingAnUnknownOrderAnswers404 - asserts 404
- extra: anotherCustomersOrderAnswers404 - covers the customer filter (Java `findStatus`)
- extra: orderDeciderPlacingAPlacedOrderEmitsNothing - covers DeciderSpecification idempotency
- extra: packageSentBeforeConfirmationRecordsNothing - covers the guard (Confirmed, Authorized, Reserved)
- extra: aWorkerFailureDoesNotStopTheLoop - covers an error in one run
- extra: retryingWithoutAFailedPaymentChangesNothing - covers the decider guard

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
The payments module: ported decider and facade (`timesOutAt` 24 h; checkout session 30 min), the payment workflow without state keyed by the payment id (Q44) that takes commands from the timeout and expiry workers, the provider sandbox port and the capture client, and passes them on to the handler; the capture, authorization clients as reactors; the forwarder with its `PaymentSummary` as an inline Pongo projection (the payment part of 19.6, and 19.2's `referenceId` key, re-checked by the tests below) mapping internal to external events; the `PendingPayment` and `AuthorizedPayment` to-do lists and their workers; the `PaymentProvider` fake. The orders endpoint `POST .../payments/{paymentId}/checkout-session` (303, 404, 409, 502). The authorization client logs failures with plain pino (Q41).

Part 2. Shipments: reserving, fulfilling and releasing stock
The shipments module: ported decider (all or nothing, id derived from `referenceId`), facade with `isProductAvailable`, the shipment workflow without state (Q44) for the warehouse's answers, the fulfillment client (logs failures with pino), the forwarder with `ShipmentSummary` as an inline Pongo projection (the shipment part of 19.6 and 19.2), and the `Warehouse` fake.

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
- 12.1 GIVEN `AuthorizePayment` WHEN payments handles it THEN it records `PaymentAuthorizationRequested` with `timesOutAt` 24 hours later AND sends nothing.
- 12.2 GIVEN the provider confirms WHEN `ConfirmPaymentAuthorization` arrives THEN the payment records `PaymentAuthorized` with `captureBefore` AND the forwarder sends `payments.external.PaymentAuthorized` with the `referenceId`.
- 12.3 GIVEN a pending payment WHEN time passes beyond `timesOutAt` THEN the payment-timeout worker appends `TimeOutPayment` AND the payment records `PaymentTimedOut` AND the forwarder sends `payments.external.PaymentFailed` AND the authorization client expires the provider's checkout session.
- 13.1 GIVEN an authorized payment WHEN `CapturePayment` arrives THEN the payment records `PaymentCaptureRequested` AND the capture client asks the provider AND, on `ConfirmPaymentCapture`, the payment records `PaymentCaptured` AND the forwarder sends `payments.external.PaymentCaptured`.
- 13.2 GIVEN the provider refuses the capture WHEN the capture client asks THEN it appends `FailPaymentCapture` with reason `UnexpectedError` AND the payment records `PaymentCaptureFailed` AND the forwarder sends `payments.external.PaymentFailed`.
- 13.3 GIVEN an authorized payment WHEN time passes beyond `captureBefore` THEN the authorization-expiry worker appends `ExpirePaymentAuthorization` AND the payment records `PaymentAuthorizationExpired` AND the forwarder sends `payments.external.PaymentFailed`.
- 14.1 GIVEN an authorized payment WHEN `CancelPayment` arrives THEN the payment records `PaymentCanceled` AND the authorization client cancels at the provider.
- 14.2 GIVEN a captured payment WHEN `CancelPayment` arrives THEN nothing is appended.
- 14.3 GIVEN a pending payment WHEN `TimeOutPayment` arrives before `timesOutAt` THEN nothing is appended.
- 15.1 GIVEN all products are available WHEN `ReserveStock` arrives THEN the shipment, with an id derived from the `referenceId`, records `StockReserved` AND the forwarder sends `shipments.external.StockReserved`.
- 15.2 GIVEN one product is out of stock WHEN `ReserveStock` arrives THEN the shipment records `ProductWasOutOfStock` AND nothing is reserved AND the forwarder sends `shipments.external.ShipmentFailed` with reason `ProductsOutOfStock`.
- 16.1 GIVEN a reserved shipment WHEN `RequestFulfillment` arrives THEN it records `FulfillmentRequested` AND the fulfillment client asks the warehouse.
- 16.2 GIVEN the warehouse sends the package WHEN `ConfirmPackageSent` arrives THEN the shipment records `PackageWasSent` with carrier and tracking number AND the forwarder sends `shipments.external.PackageWasSent`.
- 16.3 GIVEN the warehouse rejects WHEN `RejectFulfillment` arrives THEN the shipment records `FulfillmentRejected` AND the forwarder sends `shipments.external.ShipmentFailed` with reason `FulfillmentRejected`.
- 16.4 GIVEN a sent package WHEN `DeliverPackage` arrives THEN the shipment records `PackageWasDelivered` AND nothing is sent.
- 16.5 GIVEN a reserved shipment, or a shipment whose fulfillment was rejected WHEN `ReleaseStock` arrives THEN it records `StockReleased`.

Tests
- 11.1: payingNowRedirectsToTheSandboxCheckout - asserts 303 `Location: /sandbox/checkout/{sessionId}`
- 11.2: payingNowAgainReusesTheOpenSession - asserts the same `Location`
- 11.3: payingNowForAnUnknownOrForeignPaymentAnswers404 - asserts 404
- 11.4: payingNowForANonPendingPaymentAnswers409 - asserts 409
- 11.5: payingNowWithAnUnreachableProviderAnswers502 - asserts 502 with `isUnreachableFor`
- 12.1: authorizePaymentRecordsTheRequestWith24hTimeout - asserts `timesOutAt` and nothing sent
- 12.2: aConfirmedAuthorizationSendsPaymentAuthorizedWithReferenceId - asserts the external event
- 12.3: after24hAPendingPaymentTimesOut - asserts `TimeOutPayment` stored, `PaymentTimedOut`, `payments.external.PaymentFailed`, session expired
- 13.1: captureAsksTheProviderAndSendsPaymentCaptured - asserts the event sequence and the external event
- 13.2: aRefusedCaptureFailsWithUnexpectedError - asserts `FailPaymentCapture`, `PaymentCaptureFailed`, `PaymentFailed` (with `refusesTheFirstCaptureOf`)
- 13.3: afterCaptureBeforeTheAuthorizationExpires - asserts `PaymentAuthorizationExpired` and `PaymentFailed`
- 14.1: cancelingAnAuthorizedPaymentCancelsAtTheProvider - asserts `PaymentCanceled` and the provider call
- 14.2: cancelingACapturedPaymentRecordsNothing - asserts nothing appended
- 14.3: aTimeoutBeforeTimesOutAtRecordsNothing - asserts nothing appended
- 15.1: allProductsAvailableReservesStock - asserts `StockReserved` and the external event, derived id
- 15.2: oneProductOutOfStockReservesNothing - asserts `ProductWasOutOfStock` and `ShipmentFailed` `ProductsOutOfStock`
- 16.1: aReservedShipmentRequestsFulfillment - asserts `FulfillmentRequested` and the warehouse call
- 16.2: aSentPackageIsForwarded - asserts `PackageWasSent` with carrier and tracking
- 16.3: aRejectedFulfillmentSendsShipmentFailed - asserts `FulfillmentRejected` and `ShipmentFailed` `FulfillmentRejected`
- 16.4: aDeliveredPackageSendsNothing - asserts `PackageWasDelivered`, nothing sent
- 16.5: releasingReservedOrRejectedStock - asserts `StockReleased` for both states
- extra: paymentForwarderSendsFromItsSummaryAndKeysByReferenceId - covers the payment part of 19.6 and 19.2
- extra: aSecondCheckoutSessionIsNotRecordedWhileOneIsOpen - covers the decider rule
- extra: authorizationClientLogsAndRecordsNothingOnProviderError - covers the logged failure
- extra: shipmentForwarderSendsFromItsSummaryAndKeysByReferenceId - covers the shipment part of 19.6 and 19.2
- extra: fulfillmentClientLogsAndRecordsNothingWhenUnreachable - covers `isUnreachableFor`

Existing tests it breaks
None expected; if a test from an earlier step breaks, update it in this step and say why.
```

---

## Step 5. Kafka, RabbitMQ with PostgreSQL, KurrentDB, workflow delivery and settings

Criteria groups: 20, 21, 31, 22, 25.

```text
Use the `implement-step` skill.

What to build
Part 1. Kafka: forwarders, broker-to-workflow forwarders and consumers
The core's Kafka forwarder handler and Kafka consumer (Emmett's `consumer` with a `subscriptionMessageSource`, Q57) on `@platformatic/kafka` (Q5) with the Java topology, headers, retries, dead letters, restart and catch-up, and the application on Kafka with the SQLite store (any pair works, Q42). Headers include the trace context through `@opentelemetry/api` `propagation.inject/extract`; the `messaging.dead_lettered` counter uses the Almanac meter, and tests read it with an in-memory metric reader. The shared forwarder and consumer suite from step 2 runs on Kafka too, which re-checks 19.1, 19.3, 19.4 and 19.5 for this target (protection for group 19, listed in step 2). Failure setups: stop and start the Kafka Testcontainer for 20.4 and 20.9; a 500 ms publish timeout in tests and a paused container for 20.3; an event store wrapper `FailingInboxWriteEventStore` for 20.5.

Part 2. RabbitMQ: forwarders, broker-to-workflow forwarders and consumers, on PostgreSQL
The core's RabbitMQ forwarder handler and RabbitMQ consumer (Emmett's `consumer` with a `subscriptionMessageSource`, Q57) on `amqplib` with the Java topology (quorum queues, DLX/DLQ, publisher confirms, mandatory sends on `-requests` and `-internal`), and the application on RabbitMQ with the PostgreSQL store and Pongo on PostgreSQL inline (Q38). Headers with trace context and the dead-letter counter as for Kafka. The shared suite runs on RabbitMQ too (re-checks 19.1, 19.3-19.5, protection). Failure setups: stop and start the RabbitMQ Testcontainer for 21.4 and 21.9; a 500 ms publish timeout and a paused container for 21.3; `FailingInboxWriteEventStore` for 21.5.

Part 3. KurrentDB store with read models checkpointed in PostgreSQL
The application on `emmett-esdb` against a current KurrentDB image (Q13), with the core's read-model processor that runs the Pongo projections on PostgreSQL and keeps its checkpoint in the same PostgreSQL transaction (Q26); forwarders on KurrentDB keep summaries and checkpoints the same way.

Part 4. Workflow delivery: retries, transactional checkpoints, delivery of own commands and causation
The workflows' `outputHandler` retries inside the handler; the delivery of a module's own commands is chosen by `MESSAGING_INTERNAL_DELIVERY` (`store` or `broker`, Q40); correlation and causation follow Emmett and Almanac across brokers (Q31).

Part 5. Settings and the temporary SQLite file
All settings from the spec as environment variables, independent bus and store choice (Q42), the temporary SQLite file default removed on shutdown, a given file kept (Q21), the connection settings.

Context
- Java: `../../../EventSourcing.JVM/samples/e-commerce/src/main/java/io/eventdriven/core/messaging/kafka/KafkaMessageBus.java`, `KafkaVersionedMessageConverter`.
- Java: `../../../EventSourcing.JVM/samples/e-commerce/src/main/java/io/eventdriven/core/messaging/rabbitmq/RabbitMQMessageBus.java`.
- Emmett: `../../../emmett/src/packages/emmett-esdb/src/eventStore/consumers/eventStoreDBProcessor.ts` (checkpointers), `processors.ts` `reactor` with `processingScope` L1024-1110.
- Steps 6-12. Emmett `handleWorkflow.ts` L272-285 (correlation, causation).
- Steps 2-13 wire each setup; this step makes the settings the single way to choose.

Similar code
- Java tests: `MessageBusTests.java`, `KafkaMessageBusTests.java`, `KafkaMessageBusFailureTests.java`, `testing/messaging/kafka/FailingFirstSendKafkaTemplate.java`. Testcontainers: `@testcontainers/kafka`.
- Java tests: `RabbitMQMessageBusTests.java`, `RabbitMQMessageBusFailureTests.java`, `RabbitMQMessageBusRestartTests.java`. Testcontainers: `@testcontainers/rabbitmq`, PostgreSQL through `emmett-testcontainers`.
- Java: `core/eventstore/kurrentdb/`, `core/subscriptions/` (`processor_checkpoints`), `SubscriptionCheckpointsTests.java`. Testcontainers: a `GenericContainer` for KurrentDB.
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
- 31.1 GIVEN the KurrentDB store WHEN the read-model processor projects an event THEN the Pongo write and the processor's checkpoint commit in one PostgreSQL transaction.
- 31.2 GIVEN the Pongo write fails WHEN the processor handles the event THEN neither the read model nor the checkpoint changes AND the processor retries with back-off inside its handler without stopping (Q37).
- 22.1 GIVEN the broker is down WHEN a workflow's `outputHandler` sends a command THEN it retries with back-off inside the handler AND the workflow processor doesn't stop (Q37).
- 22.2 GIVEN the workflow processor stops after appending outputs and before saving its checkpoint on PostgreSQL or SQLite WHEN it restarts THEN neither the outputs nor the checkpoint were saved AND it decides the input once (the checkpoint and the outputs commit together).
- 22.3 GIVEN the setting that delivers a module's own commands through the event store WHEN a worker stores `TimeOutPayment` in the payment workflow THEN a regular consumer on the event store passes it to the payments handler without the broker; GIVEN the setting for the broker THEN it goes through `payments-internal` (Q40).
- 22.4 GIVEN a module handles a message WHEN its handler appends events THEN their correlation id is the handled message's correlation id AND their causation id is the handled message's id, as Emmett and Almanac set them.
- 22.5 GIVEN an outside command (provider answer, warehouse answer, worker command) WHEN it is appended THEN its correlation and causation follow Emmett's and Almanac's rules for the current scope.
- 25.1 GIVEN `MESSAGING_BUS=rabbitmq` and `EVENTSTORE_TYPE=postgresql` WHEN the application is built THEN it has the RabbitMQ forwarders and consumers and the PostgreSQL event store; the same holds for `kafka` with `kurrentdb`, for `in-memory` with `sqlite`, and for `none` with `sqlite`.
- 25.2 GIVEN an unknown value, for example `MESSAGING_BUS=sqs` WHEN the application starts THEN it stops with a message naming the setting and the allowed values.
- 25.3 GIVEN the SQLite setup and no SQLite file in the settings WHEN the application starts THEN it creates a new file in the operating system's temporary folder AND needs no Docker AND removes the file on shutdown.
- 25.4 GIVEN a SQLite file in the settings WHEN the application stops and starts again THEN the carts and orders are still there AND the file is not removed.

Tests
- 20.1: topicPatternsDeliverToEachMatchingQueue - asserts deliveries for `*` and `#`
- 20.2: aNonHashPatternGetsItsOwnTopicFilledByARoutingConsumer - asserts the topic and the copied records
- 20.3: aSendWithoutAcknowledgementWithinTheTimeoutFailsAndIsRetried - asserts the failure and the retry
- 20.4: withTheBrokerDownTheForwarderRetriesAndSendsWhenItIsBack - asserts delivery after restart
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
- 21.10: catchUpWaitsForAProbePerQueue - asserts the wait ends after handling
- 21.11: headersCarryTypeIdsAndTraceContext - asserts the five headers
- 31.1: aProjectedEventAndItsCheckpointCommitTogether - asserts both rows after success
- 31.2: aFailingWriteChangesNeitherAndIsRetried - asserts no row, same checkpoint, a retry, processor still active; setup: a projection that throws on its first call
- 22.1: anOutputHandlerRetriesWhileTheBrokerIsDown - asserts the processor stays active and sends later (protects behaviour built in step 3; setup: a stopped broker container)
- 22.2: aStopBeforeTheCheckpointSavesNeitherOutputsNorCheckpoint - asserts one decision after restart on PostgreSQL and SQLite (protects Emmett's transaction; setup: an `outputHandler` that throws once after the append, then a consumer restart)
- 22.3: ownCommandsGoThroughTheStoreOrPaymentsInternal - asserts both settings
- 22.4: appendedEventsCarryTheHandledMessagesCorrelationAndCausation - asserts metadata across Kafka and RabbitMQ (protects Emmett's rules with the Kafka and RabbitMQ headers of step 5)
- 22.5: outsideCommandsFollowTheScopesCorrelation - asserts metadata (protects Emmett's rules)
- 25.1: settingsBuildTheChosenForwardersConsumersAndStore - asserts the built implementations for the three pairs
- 25.2: anUnknownValueStopsTheStartNamingTheSetting - asserts the message
- 25.3: withoutSqliteFileATemporaryFileIsCreatedAndRemoved - asserts the file exists while running and not after shutdown
- 25.4: aGivenSqliteFileKeepsDataAcrossRestarts - asserts the cart after a restart and the file still there
- extra: aSendIsPreparedForAllMessagesBeforeAnyIsSent - covers batch routing before sending
- extra: postgreSQLInlineProjectionsAreConsistentWithTheAppend - covers Q38 on PostgreSQL
- extra: aRestartContinuesAfterTheCheckpoint - covers resume
- extra: aForwarderOnKurrentDBCommitsItsSummaryAndCheckpointTogether - covers forwarders on KurrentDB
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
One set of purchase scenarios that runs on SQLite without a broker, Kafka + KurrentDB, and RabbitMQ + PostgreSQL.

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
- 18.6 GIVEN the payment sandbox page WHEN the customer pays with card `4242424242424242` THEN the sandbox appends `ConfirmPaymentAuthorization` with `captureBefore` 7 days later AND redirects (303) to the success URL.
- 18.7 GIVEN the payment sandbox page WHEN the customer pays with card `4000000000000002` THEN the payment is declined AND the page stays.
- 18.8 GIVEN the warehouse sandbox page WHEN a person sends a package THEN the warehouse appends `ConfirmPackageSent` with carrier "Sandbox Express"; WHEN they reject THEN it appends `RejectFulfillment`; WHEN they deliver THEN it appends `DeliverPackage`.
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
- 30.7 GIVEN a command from the broker WHEN the facade handles it THEN the facade sets `now` from the clock, not the sender (Java behaviour).

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
- 30.7: aFacadeSetsNowFromItsClock - asserts the recorded time equals the fake clock, not the sender's
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
In the Emmett repository, on the branch `hono_api_e2e_specification_steps` (already created from `main`), `emmett-honojs`' `ApiE2ESpecification` gets the shape the sample's core built in step 1 (Q30, Q49): message, time and attempt steps, start and stop hooks, the catch-up loop, and the expectations, including the check of events the `when` step appended, as [emmett#436](https://github.com/event-driven-io/emmett/issues/436) proposes (given requests or event streams in one specification). Given requests keep today's behaviour (Q50). It runs in parallel with the sample; when Oskar releases it, the sample switches to it. Do not commit, push or publish; leave the branch for Oskar.

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
