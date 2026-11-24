## Step 1. Workspace and the extended ApiE2ESpecification in the core package

Done. `samples/e-commerce` is an npm workspace with `packages/core` and `packages/application` (Node 24.22.1, Vitest, ESLint, Prettier; root scripts `build:ts`, `fix`, `lint`, `test`). `packages/core/src/testing/apiE2ESpecification.ts` has the steps (`send`, `timePasses`, `attempt`), hooks (`start`, `stop`), the catch-up loop and the expectations. 31 unit tests pass.

Deviations and open points:

- The `appended` option is a small port (`lastGlobalPosition`, `readAfter`), not an Emmett `EventStore`: Emmett's `EventStore` has no store-agnostic global read. Steps that use SQLite, PostgreSQL and KurrentDB need an adapter, and the Emmett port (step 20) keeps this shape.
- Catch-up has no timeout: a review asked to remove the unrequested option, a second asked for a bound like Java's. Decision needed.
- No CI workflow `samples_e_commerce.yml` yet; the plan does not name a step for it.
- Root test scripts filter on `.unit.spec`, `.int.spec`, `.api.spec`, `.e2e.spec`, because filtering on `api` or `e2e` also matches `apiE2ESpecification`.

## Step 2. Shopping carts, forwarding through channel streams, and type names

Done after the idiomatic review (`reviews/20261123T230000_idiomatic_review.md`) and its fixes. The cart module (`packages/application/src/shoppingCarts`: decider, facade, API, `Cart`, `CustomerShoppingCart` and `ShoppingCartSummary` inline Pongo projections, pricing, external event and forwarder) runs on the SQLite store. The core has urns, routings as plain functions, `forwardToChannels` and `fromChannel` handlers for Emmett reactors (Q57), `toWorkflowInbox`, `retryInHandler` on Emmett's `asyncRetry`, `conditionalRead` and long polling, and the `ApiE2ESpecification` on Emmett's assertions. The application runs with `MESSAGING_BUS=in-memory` (channel streams) and `none` (pure Emmett, Q56). `npm run lint`, `npm run build:ts` and `npm test` pass.

Changes to step 1: `ApiE2ESpecification.for` now takes `getEventStore` + `getApplication(eventStore)` like Emmett's `ApiSpecification` and records appends with `WrapEventStore`; the `appended` port is gone and `expectAppended` takes `[streamName, events]` like `expectNewEvents`.

Deviations and open points:

- `priceOf` is an `action` step of the core `ApiE2ESpecification` that sets the price of the changeable price calculator.
- `getETagFromIfNotMatch` in `emmett-honojs` reads the header `if-not-match`, not `if-none-match`, so `conditionalRead` reads `If-None-Match` itself and uses the other etag helpers.
- The `theForwarderRetriesWithGrowingBackOff` extra test is not written: `asyncRetry` has no fake clock. The retries are checked with short `minTimeout` values.
- The forwarder retries its whole handler. The summary is an inline projection (Q38), so a retry only reads it again.
- On SQLite a forwarder that retries a down broker keeps the processor transaction, and with it the write lock, open. Step 5 must check this for Kafka and RabbitMQ.
- The event-store forwarder appends through the processor's own session store, so the append and the checkpoint commit together.
- Reads of the cart wait up to 1 s for a missing cart (404 after 1 s), as Java's `ConditionalRead` does.

## Step 8. Emmett pull requests: Hono ApiE2ESpecification, metric series at zero (#433), processor retry policy

Done on three Emmett branches from `main`, committed, not pushed. Build, lint and unit tests pass on each; `emmett-honojs` tests pass.

- `hono_api_e2e_specification_steps` (460cfdf7): `ApiE2ESpecification` takes message, time, attempt and action steps, start/stop hooks, a catch-up loop, given requests or event streams (#436), `expectNewEvents` for the when step only, `expectNoNewEvents`, `expectPublished`, page expectations. Step builder is `sendMessages` because `send` clashes with the responses export. `HonoResponse.text()` is cached so several page expectations can read one body.
- `metrics_series_registered_at_zero` (3ac9bf7d): new counter `emmett.command.handling.count`; known command types (`commandType` or `name` option) and event types (new `observability.eventTypes` store option) are added at 0 at setup. `DeciderCommandHandler` registers at setup and its inner per-command call repeats the zero adds.
- `processor_retry_policy` (d3d0a004): optional `retry` (Emmett `AsyncRetryOptions`, exponential back-off) on processors, applied per message and to custom batch handlers; the checkpoint is stored only after success; no option keeps today's stop.

Step 8 review fixes (Emmett branches): `processor_retry_policy` 16d451d4 (workflow `retry` stays apart, sentence test names); `metrics_series_registered_at_zero` c02b9dd4 (command side: one type series per command type, registered once at setup, event side unchanged and open); `hono_api_e2e_specification_steps` acf703f0 (exact new-event check, fetch-option failures, class-based stores via `WrapEventStore` keeping the prototype, step builder `messagesArrive`, docs).

## Step 5 (core part: Kafka and RabbitMQ)

Done for the core package, with one open blocker (below); the application wiring and Parts 3-5 are not started. `forwardToKafka` sends with the Platformatic `Producer` (the whole send is bound by `publishTimeoutInMs`) and `forwardToRabbitMQ` with a confirm channel (`rabbitMQConfirmChannel` holds the connection and reconnects); each has its own sending code. Shared are only pure helpers: `brokerHeadersOf`, `brokerBodyOf`, `decodeBrokerMessage`, `messageRouter`, `retryInHandler`. Kafka and RabbitMQ consumers are Emmett consumers (`consumer` with a `subscriptionMessageSource`). A received message is Emmett's `RecordedMessage` with `key` and `headers` added to its metadata; `traceId` and `spanId` travel in the `trace-id` and `span-id` headers and arrive as Emmett's own metadata. Readers use `fromBrokerQueue`. Kafka dead letters are produced to `<queue>-dlt` by `kafkaDeadLetters`; RabbitMQ dead letters are rejected without requeue so the declared DLX does it (`rabbitMQConsumer` returns `{ consumer, deadLetters }`). Tests: shared suites `forwardingSuite` (also runs on channel streams) and `broker/queueSuite`, run by `kafkaForwarding`, `rabbitMQForwarding`, `kafkaQueues` and `rabbitMQQueues`; `deliveryLedger.unit.spec.ts`.

Blocker: `aModuleCanStillAppendWhileAForwarderRetriesADownBroker` fails on both brokers. While a Kafka or RabbitMQ forwarder retries a down broker inside its processor, a second SQLite store on the same file cannot append: Kafka failed with `SQLITE_BUSY: database is locked` after about 5 s, RabbitMQ was still blocked after 3 s. The test is left failing and marked `it.fails`. Decision: Emmett runs each processor retry attempt in a new transaction (branch `processor_retry_policy`); the sample switches to it when Emmett releases it, and the `it.fails` turns red then.

Deviations and open points:

- `deliveryLedger` stays. The checkpoint of a message is its delivery sequence, assigned on arrival. Settling commits or acks only up to the lowest position of every active processor; a processor that is not active no longer holds it back; a failed commit or ack puts the deliveries back and the next settle retries them.
- A projector, a `'DISABLED'` processor or a processor with its own checkpointer is rejected on registration with an `EmmettError`.
- Superseded by the next two entries on catch-up: before the consumer reads, `readLastMessageCheckpoint` returns without waiting (used for `startFrom: 'END'`). `readLastMessageCheckpoint` returns the last delivered sequence plus the messages still to come (Kafka: end offsets minus delivered or committed offsets; RabbitMQ: `messageCount` of the queue). `startFrom: 'END'` therefore does not hang. Across Kafka partitions the sequence follows arrival order, not send order, so `END` skips the earlier messages exactly only for messages of one key (one partition). A trailing unreadable message has no processor checkpoint, so `whenCaughtUp` would wait for it; the tests wait on the dead letters instead.
- A message without a `message-id` header gets a stable id: Kafka `topic-partition-offset`, RabbitMQ the AMQP `messageId`; with none it is unreadable.
- A message type no registered processor handles (`canHandle`) goes to dead letters.
- `KafkaOnAFixedPort` stays: `KafkaContainer.beforeContainerCreated` exposes port 9093 on a random host port again, so only a subclass can pin it across a container restart.
- Container control (stop, start, pause) uses the Testcontainers runtime client (`getContainerRuntimeClient`), so `testcontainers` is a dev dependency of core.
- 19.4 on channel streams: a handler that throws after the append does not roll the append back in this setup, so the suite checks that every resent message has the same id and, on the brokers, that it arrived twice.
- The timed-out send that the broker still takes later arrives twice; the tests expect at-least-once.
- `@opentelemetry/instrumentation` is a dependency only because Almanac's `otel` entry imports it.
- Lint still fails in files of other steps (`testApplication.ts`, `workersLoop.ts`, `ordersApi.api.spec.ts`).

Step 8 decisions applied (Emmett branches): `metrics_series_registered_at_zero` 23ab01ef (event types registered at 0 from `canHandle` when a processor starts; store option and reading series removed; decider registers only `commandType`); `processor_retry_policy` 0a09ce3c (each attempt in a new processing scope, one scope per message when a retry policy is set, workflow option `processorRetry`).

## Step 5 (application part: settings, PostgreSQL, brokers, own commands)

Not finished; see the open list. Built and passing: the application on PostgreSQL (`emmett-postgresql`, one schema per module and a `broker` schema), on Kafka and on RabbitMQ, the settings, and the delivery of a module's own commands.

- `eventStore.ts` builds each module's `Database` for SQLite (a file) or PostgreSQL (a schema): store, consumer, Pongo client and a message source for the in-memory bus. The ten read models are now `singleStreamReadModel(...)` options (`readModelProjection.ts`) that become a SQLite or a PostgreSQL Pongo projection in the store, so the projection code exists once.
- `moduleConsumer.ts` is the one consumer type the registration code uses: it is structural and holds for the SQLite, PostgreSQL and broker consumers.
- Forwarding: `ForwardTo` (core) has three implementations, `forwardingToChannels`, `forwardingToKafka` and `forwardingToRabbitMQ`; the four forwarders take `forward` instead of `storeOfChannel`. Reading: `ChannelReading` registers a queue's reactor on the right consumer (`fromChannel` on channel streams, `fromBrokerQueue` with a Kafka or RabbitMQ queue consumer, plus the routing consumer for a binding key other than `#`).
- `messaging.ts` picks all of this from the bus, declares the topology on start, and closes the producer and channel.
- Own commands (Q40): `orders-internal` and `payments-internal` channels with their routes, readers and subscriptions; `MESSAGING_INTERNAL_DELIVERY=broker` sends a worker's command to the channel with `SendToChannel` (`sendingToChannelStreams`, `sendingToKafka`, `sendingToRabbitMQ` in core) and a reader stores it in the workflow inbox; `store` stores it straight in the inbox. On `none` it is always `store`. `createApplication` defaults to `store`; `buildApplication` takes the setting (default `broker`).
- Settings: `settings.ts` reads and checks the environment (25.2: the message names the setting and the allowed values; durations are `500ms`, `10s`, `1m`). `buildApplication.ts` builds the application from them: no `SQLITE_FOLDER` makes a temporary folder that `stop` removes; a given folder is kept.
- Tests added: `settings.unit.spec.ts`, `settings.int.spec.ts` (25.1, 25.3, 25.4), `infrastructure.int.spec.ts` (PostgreSQL inline read models; a checked-out cart becomes an order through Kafka + PostgreSQL, RabbitMQ + PostgreSQL, Kafka + SQLite and RabbitMQ + SQLite, with the correlation and causation of 22.4; a Kafka that is down while the cart checks out, 22.1 and 20.4 in the application), `internalDelivery.api.spec.ts` (22.3, both settings, `failsOnEmmett('#432')` because the workers read what processors appended).
- Found on the way: Pongo's `countDocuments` returns a `bigint` on PostgreSQL, so `customerShoppingCarts.countOf` converts it with `Number`.

Later in the same step: `correlation.int.spec.ts` (22.5, payment answer only), `workflowTransaction.int.spec.ts` (22.2: in Emmett the outputHandler runs as its own message after the decision commits, so the test checks that outputs stay, the handler runs again after a restart and the input is decided once; the plan wording does not hold), the extras `aSendIsPreparedForAllMessagesBeforeAnyIsSent` (core) and `aRestartContinuesAfterTheCheckpoint`. Full run of `npm test` in samples/e-commerce passes (unit 164, int 83 with 4 expected fail, api 88 with 141 expected fail). Review: reviews/20261124T202500_step5_application_review.md, blocked. Open: findings of that review, the application runs of 20.x and 21.x beyond the core suites, and the `aModuleCanStillAppendWhileAForwarderRetriesADownBroker` failure (waits for Emmett's retry policy, #438).

## Step 3. Orders: workflow, read models, API, workers

The order process is one Emmett `Workflow` with state (`orders/orderWorkflow.ts`, Q65, Q66). `decide` holds the ported Java rules, keyed on the real inputs (the carts', payments' and shipments' external events and the commands `CancelOrder`, `RetryOrderPayment`, `CloseUnpaidOrder`), and stamps its events with its injected clock; `evolve` only builds the `Order` from the events. Outputs are the order events and the requests to payments and shipments (`AuthorizePayment`, `ReserveStock`, `RequestFulfillment`, `CapturePayment`, `CancelPayment`, `ReleaseStock`), all in the stream `orders_workflow-<orderId>`. There is no separate decider, no `Record...` or `PlaceOrder` command, no facade and no `orders-internal` channel.

Delivery: readers (`fromChannel` + `toWorkflowInbox`) store external events in the inbox; the unpaid-orders worker stores `CloseUnpaidOrder` there too. Customer commands (cancel, retry) go through a `WorkflowHandler` without inbox mode (retry of version conflicts: `onVersionConflict: 2`), so the response follows the decision. The forwarder `orders-requests` (`orders/external/orderRequestForwarder.ts`, registered with the other forwarders in `forwarders.ts`) sends the requests from the workflow stream. Read models read the order events from the workflow stream; the status `version` counts the order events. The workflow skips messages in channel streams (`getWorkflowId` returns `null`): dead letters and channel copies are not inputs (the module's own decision).

Tests: `orderWorkflow.unit.spec.ts` uses `WorkflowSpecification` (including the request mapping, the due date, the cancellation reasons, the clock and the ids). `ordersApi.api.spec.ts` checks the black box: responses, the status read model and `expectPublished` with the routing keys of the requests.

Open points:

- Events that the workflow decides from a broker message or a worker input are appended by Emmett's processor store, which skips the inline projections (Emmett #432). So the read models do not follow them, and the tests that read them are `failsOnEmmett('#432')`. Nothing in the sample works around it.
- A customer command stored by the synchronous handler is handled again by the inbox processor (Emmett #434); the rules are idempotent, so the second decision is empty and no test can show it. Each `outputHandler` result is stored twice (#443); nothing marked.
- Stream names are plain `{module}_workflow-{id}`.

## Step 4. Payments and shipments

Both modules are one Emmett `Workflow` with state each, like orders: `PaymentWorkflow` (keyed by payment id) and `ShipmentWorkflow` (keyed by shipment id). `decide` holds the ported Java rules and stamps its events with its injected clock `evolve` builds the state from the events. Inputs are the commands from orders (through `payments-requests` and `shipments-requests` and a reader), from workers, and from outside (the provider's and the warehouse's answers). Outputs are the module's events in `payments_workflow-<id>` and `shipments_workflow-<id>`. `TimeOutPayment` and `ExpirePaymentAuthorization` carry only the payment id; the workflow compares its clock with the deadline.

The stock check is one of them (Q67): `ReserveStock` records `StockCheckRequested` (the shipment's state keeps the reference and the items); the shipment `outputHandler` asks `warehouse.isProductAvailable` for each item and returns `ConfirmStockAvailability`, from which `decide` records `StockReserved` or `ProductWasOutOfStock`; a redelivered `ReserveStock` or answer decides nothing, and the warehouse is not asked again. `decide` uses only its input and state, and the inbox writer in `testApplication` needs no warehouse. Outside calls are the workflows' `outputHandler`s (Q64): the capture client reacts to `PaymentCaptureRequested` and returns `FailPaymentCapture` when the provider refuses; the authorization client reacts to `PaymentCanceled` and `PaymentTimedOut`; the fulfillment client reacts to `FulfillmentRequested`. The gateways are called directly, failures are logged with pino. Confirmations come later from outside as messages; the fakes only give test steps (`paymentProvider.confirmsTheCapture`, `warehouse.sendsThePackage`).

Forwarders of all modules live in `forwarders.ts` and read events from the workflow streams; summaries and to-do lists are inline projections of the same events. `paymentCheckoutSessions` reads the payment with the store's `aggregateStream` and the workflow's `evolve`, calls the gateway and records the session through a `WorkflowHandler` (version conflicts retried twice).

Shape: one `external/<module>...Forwarder.ts` per module with its forwarder id and types, `PaymentGateway`/`paymentProvider` and `WarehouseGateway`/`warehouse` (port and fake), one options function per workflow (`...WorkflowOptions`) with `getWorkflowId`, the inbox flag only in the inbox handler.

Tests: `paymentWorkflow.unit.spec.ts` and `shipmentWorkflow.unit.spec.ts` (`WorkflowSpecification`); the API specs check responses, `expectPublished` with the routing key (`published` now carries `metadata.key`; `expectPublished` compares `type` and `data`, and `metadata` only when given), provider and warehouse calls and the pino log. Because a workflow's events can't be seen from outside, these plan assertions need restating: 5.1 (the order is `OrderPlaced` with status `Opened`: read through the order status), 7.6 and 7.7 (read through the status after the time step), 12.1 (the `timesOutAt` is only visible through the timeout 24 h later), 12.3 (`TimeOutPayment` stored: visible as `PaymentFailed` and the provider's `expire-checkout-session`), 13.2 (`FailPaymentCapture` appended: visible as `PaymentFailed` and the log), 13.3 (`ExpirePaymentAuthorization`: visible as `PaymentFailed`), 15.1 and 16.x (the events: visible as the external events and the warehouse calls), 16.5 (`StockReleased`: only that a released shipment is not fulfilled).

Expected failures (`failsOnEmmett`, one helper in `knownFailures.ts`; the timeout stops the application): everything that needs a read model or a summary of an event that a processor appended, and the load test `ordersAndPaymentsWritingIntoEachOtherUnderLoadAllGetAuthorized` (#432 only). Checked against a copy of the sample whose Emmett runs the inline projections in the processor store (#432 only): all 313 application tests pass as plain tests on both buses.

- Emmett #434 can also re-decide `RecordCheckoutSession` after the session expired: the handler runs again and records a second `CheckoutSessionCreated` with the old session. No workaround.
- `expectPublished` keeps the order of messages with the same routing key and ignores the order between different keys (Q70); unit tests in `apiE2ESpecification.unit.spec.ts`.
- `SQLITE_BUSY: database is locked` printed as unhandled errors on the `none` bus after expected-fail tests: to recheck after the Emmett upgrade with #432. Not investigated further.
