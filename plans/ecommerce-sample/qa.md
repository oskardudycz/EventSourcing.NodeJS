# Q&A: e-commerce sample port

Answers from Oskar on 2026-11-23. The research behind each question is in [README.md](README.md) and [research](research).

## Q1 (spec r1)

Where does the sample live?

`samples/e-commerce`, like in the Java repository.

## Q2 (spec r1)

Which web framework?

Hono, also for the htmx pages.

## Q3 (spec r1)

Which setups?

The same three as in Java: in memory; Kafka + KurrentDB; RabbitMQ + PostgreSQL.

## Q4 (spec r1)

Emmett `Workflow` or a stateless reactor for the order process?

Emmett `Workflow`.

## Q5 (spec r1)

Which Kafka client?

`@platformatic/kafka`. Asked "why not the official Confluent one?". The answer was that Confluent's 1.11.0 ships prebuilt binaries only up to Node 24, so Node 26 compiles librdkafka from source. Oskar then chose Platformatic.

## Q6 (spec r1)

Where does the core code live until it moves to Emmett?

Start with our own consumers in the Node.js sample, and add those packages to Emmett afterwards. Use npm workspaces for the packages.

## Q7 (spec r1)

How do we test message formats?

Start with Vitest. Strictland gets a Node.js port later.

## Q8 (spec r1)

What is in the first pass?

Everything: the modules, the process, the pages, OpenAPI, AsyncAPI and EventCatalog.

## Q9 (spec r1)

When do the telemetry tests come?

After the rest. They need `ApiE2ESpecification` extended with trace, causation and metric expectations. The message and time steps come first.

## Q10 (spec r1)

Do we split a distributed-processes sample first, as in Java?

No. Node.js has no combined sample, so there is nothing to split.

## Q11 (spec r1)

Which test seams?

All four proposed: the application black box through the extended `ApiE2ESpecification` (with a browser variant), the core packages through their public contract, the deciders through `DeciderSpecification`, and contract snapshots of stored events, bus messages and HTTP bodies.

## Q12 (spec r2)

Emmett's in-memory store on `main` has no `consumer()` ([#427](https://github.com/event-driven-io/emmett/issues/427)). What does the in-memory setup use?

An in-memory consumer written in the sample's core.

## Q13 (spec r2)

Which event store for the Kafka + KurrentDB setup?

`emmett-esdb` as it is, against a current KurrentDB image.

## Q14 (spec r2)

Where do read models live in the in-memory setup?

In PostgreSQL, as in every setup. The in-memory setup then needs Docker for PostgreSQL.

## Q15 (spec r2)

How do inputs reach the order workflow?

The order's own events through a `workflowProcessor` on the event store consumer, and the other modules' external events through a bus consumer that passes them to Emmett's `WorkflowHandler`.

## Q16 (spec r2)

How is the core split into workspace packages?

One core package. It is split when its parts move to Emmett.

## Q17 (spec r2)

Which message type names?

Names with a module prefix, for example `payments.PaymentAuthorized` for the internal event and `payments.external.PaymentAuthorized` for the external one.

## Q18 (spec r2)

Is telemetry itself in the first pass?

Yes: OTLP export, business metrics, Grafana dashboards and alerts, and otel-lgtm in Docker Compose, on Emmett's metric names. Its tests come later (Q9).

## Q19 (spec r3)

Can the in-memory setup use SQLite?

Yes. SQLite replaces the in-memory setup: Emmett's SQLite event store with its consumer, read models as SQLite projections, and the in-memory bus. It needs no Docker. This replaces Q12 (own in-memory consumer) and, for this setup, Q14 (read models in PostgreSQL).

## Q20 (spec r3)

What are the read models built with?

Pongo, in every setup: Pongo on SQLite in the SQLite setup, Pongo on PostgreSQL in the other two.

## Q21 (spec r3)

Is the SQLite database in memory or in a file?

Oskar: "We can use :memory: but also file depending what's easiest and better", then: "Let's default to temporary file". So one setting holds the SQLite database file. By default the application creates a new file in the operating system's temporary folder each time it starts. A plain `:memory:` doesn't work, because the event store, its consumer and Pongo open more than one connection, and each would get its own empty database ([emmett-sqlite README](https://github.com/event-driven-io/emmett/blob/0b9b5c7b/src/packages/emmett-sqlite/README.md#L356)). A file path in the setting keeps the data across restarts. Asked whether to delete the temporary file when the application stops, Oskar answered: "best if we remove it on shutdown". So the application removes its default temporary file on shutdown, and never removes a file given in the setting.

## Q22 (spec r3)

How do the workflow's output commands and the modules' external events get to the bus?

Oskar pointed to the workflow processor's `outputHandler`, which can forward to the bus, and asked for a Kafka and RabbitMQ forwarder processor type. Two shapes were offered: (1) one forwarder processor type that publishes through the message bus (with its Kafka, RabbitMQ and in-memory implementations), or (2) one processor type per broker. In both, a forwarder is a processor on the event store consumer that publishes what it reads and then saves its checkpoint, and the workflow's `outputHandler` publishes its recorded outputs the same way. Oskar asked "1. processor forwarding from event store, right?" and then "what's the benefit of 1?". Claude found no real benefit of the bus over a forwarder with defined routings, and dropped the recommendation. So forwarders are one processor type per broker (Kafka, RabbitMQ, and an in-memory one for the SQLite setup), each with defined routings (type to channel and routing key). Workers and sandboxes don't read from the store, so they were asked about: (a) append their commands to the event store, and a forwarder sends them on; (b) publish straight to the broker with the same routings. Answer: "a)". This adds one store write per worker or sandbox command.

## Q23 (spec r3)

What are the order workflow's id and state? (review r2, Q&A-1)

"Order id, no state": the workflow id is the order id (derived from the cart id for `ShoppingCartCheckedOut`, the `referenceId` for the other modules' external events). The state stays empty, and each reaction decides from its input alone, as the Java `OrderSaga` does.

## Q24 (spec r3)

How does a forwarder get the summary data and handle failures? (review r2, Quality-3)

"Same handler + back-off": the forwarder updates its Pongo summary and then publishes, in one handler, so the summary never lags behind it. On any failure, such as a broker that is down, the processor retries the batch with back-off, without a limit.

## Q25 (spec r3)

Q15 said a bus consumer passes external events to Emmett's `WorkflowHandler`. Claude was told that `WorkflowHandler` is the synchronous path, and that the workflow processor handles inputs one after another. Change Q15 so that the bus consumer only appends each external event as an input to the workflow's stream (Emmett's `separateInputInboxFromProcessing` mode, appended with `NO_CONCURRENCY_CHECK`), and only the workflow processor handles them?

"i think so". So Q15 changes: the bus consumer appends external events to the order workflow's inbox, and only the workflow processor handles inputs.

## Q26 (spec r3)

How do read models run in the Kafka + KurrentDB setup? (review r2, Q&A-2 and Quality-4)

"Checkpoint in PostgreSQL": like Java, a processor on the KurrentDB consumer runs the Pongo projection and saves its checkpoint in PostgreSQL in the same transaction as the read model write.

## Q27 (spec r3)

Emmett creates metric series on the first value ([#433](https://github.com/event-driven-io/emmett/issues/433)), so the "Capture failed" alert misses the first failure. What does the sample do? (review r2, Q&A-3)

"Register at 0 in sample": at startup the sample registers Emmett's command and event counters at 0 for each module's types, like Java. It moves to Emmett with #433.

## Q28 (spec r3)

Which stream do workers and sandboxes append their commands to? (Q22 a)

"Stream per target entity", for example `payments:outbox:<paymentId>`.

## Q29 (spec r3)

Which module prefix do type names use, for example for shopping carts? (review r2, Q&A-11)

`shopping_carts`, the same as the Java channel names: `shopping_carts.ShoppingCartCheckedOut`, `orders.OrderPlaced`, `payments.external.PaymentAuthorized`.

## Q30 (spec r3)

Emmett's Hono `ApiE2ESpecification` has HTTP steps only and no hooks, so it can't be extended in place. What do we build? (review r2, Quality-5)

"Change Emmett's first": add the steps and hooks to Emmett's `emmett-honojs` `ApiE2ESpecification`, and the sample uses an Emmett rc with them.

## Q31 (spec r3)

Where does a correlation id start, and what is the causation id? (review r2, Quality-7)

"just like emmett and almanac handles". On Emmett `origin/main`, the correlation id comes from the observability scope or from the handled message's metadata, and the causation id is the id of the handled message (`handleWorkflow.ts` L272-285, `workflowProcessor.ts` L342-349, `processorCollector.ts` L204-205). The sample carries both across the brokers in the message headers and follows the same rules.

## Q32 (spec r3)

Do the forwarders' and consumers' id, correlation and causation headers and the dead-letter count get tests in this spec? (review r2, Q&A-10)

"Forwarders and consumers need to be fully implemented and tested". So both are implemented and tested in this spec. The telemetry follow-up (Q9) keeps only the trace, causation and metric expectations of `ApiE2ESpecification` and the Grafana tests.

## Q33 (spec r3)

Which tools for the parts no answer chose? (review r2, Q&A-9)

The research picks are accepted: `amqplib`, `@hono/zod-openapi`, the Playwright library inside Vitest, `emmett-testcontainers` for PostgreSQL with `@testcontainers/kafka`, `@testcontainers/rabbitmq` and a `GenericContainer` for KurrentDB and otel-lgtm. On pino: "I don't care about pino unless we really have some logs, but we can use it". Assertions: Vitest `expect`.

## Q34 (spec r3)

Which spec findings of review r2 are fixed as the review proposed?

All three groups: match the Java behaviour (Q&A-4 to Q&A-8, Quality-8), precise criteria (Quality-9, 12, 13, 14), and missing criteria and names (Quality-10, Quality-15, Q&A-12).

## Q35 (spec r4)

Who fixes the counters starting at 0 ([#433](https://github.com/event-driven-io/emmett/issues/433))?

"You can also fix this issue about metrics, but just regular branch". So the fix goes into Emmett on its own branch from `main`, not into the sample. This replaces Q27. The Emmett change to the Hono `ApiE2ESpecification` (Q30) is on the branch `hono_api_e2e_specification_steps`, created from `main`.

## Q36 (spec r4)

How do the two Emmett branches (#433 and the Hono `ApiE2ESpecification` steps) relate while the sample needs both?

"Independent, merge first": two branches from `main`, two pull requests. The run stops after each Emmett change so Oskar can merge it, or publish an rc, before the sample uses it.

## Q37 (spec r4)

A processor that throws stops for good in Emmett, so a broker outage stops forwarders, the order workflow's `outputHandler` and the KurrentDB read-model processor. What do we do? (review r3, Q&A-5, Quality-1, Quality-2)

"Both, do it in handlers, but also do a change in Emmett". So the sample retries with back-off inside the handlers (forwarders, `outputHandler`, read-model processor), and Emmett gets a processor retry policy on its own branch from `main`, independent like Q36.

## Q38 (spec r4)

Are the read models on SQLite and PostgreSQL inline or async? (review r3, Q&A-6, Quality-5)

"Inline, but eventual consistency may happen in the integration through bus". So the Pongo projections run inline in the append on SQLite and PostgreSQL. A module's own read models are consistent with its writes; lag happens only between modules, through the broker.

## Q39 (spec r4)

Which UIs for the OpenAPI and AsyncAPI documents?

OpenAPI: Swagger UI (`@hono/swagger-ui`), like Java's springdoc. AsyncAPI: the AsyncAPI React component (`@asyncapi/react-component`) on a page, plus a small page that sends a message in the in-memory setup, like Springwolf's Publish button.

## Q40 (spec r4)

Commands a module sends to itself (worker timeouts, provider and warehouse answers, `FailPaymentCapture`) are appended to a stream, as Q22 (a) says. How do they reach the module's handler? Options: (1) a regular consumer on the event store, (2) a forwarder through the broker's `-internal` channel and a broker consumer, like Java, (3) no stream, a direct call.

"at least 1 and 2 for switching based on config like java". So both (1) and (2), chosen by a setting. On streams, Oskar said they should be per payment, per shipment (and per order), not per process ("It should be per feature or per payment (best) or per shipment(best)"). This replaces the stream names of Q28.

## Q41 (spec r4)

How do the two clients that log failures (fulfillment client, authorization client) log? (review r3, Q&A-4)

"Plain pino". The logs go to stdout and don't reach Grafana.

## Q42 (spec r4)

The bus and event store settings make nine pairs, while three setups are tested. What about other pairs? (review r3, Q&A-8, Quality-7)

"Any pair works": the settings are independent, like Java. The read models follow the event store: Pongo on SQLite with the SQLite store, Pongo on PostgreSQL otherwise. Tests cover the three setups.

## Q43 (spec r4)

The workflow inbox mode doesn't skip an input it already handled (review r3, Quality-4). What do we do?

Oskar: "Add github issue with potential fixes" and "move on". Filed as [emmett#434](https://github.com/event-driven-io/emmett/issues/434). The sample relies on idempotent handlers, so a duplicate does no harm; on PostgreSQL and SQLite the checkpoint and the outputs commit together.

## Q44 (spec r4)

Commands from workers, sandboxes and the capture client go to a workflow stream. Which workflows?

"Payment + shipment workflows": one Emmett `Workflow` per payment and one per shipment, without state and keyed by the id, next to the order workflow. Those commands are their inputs, and each workflow passes them on as outputs to the module's handler, through the store consumer or the broker (Q40).

## Q45 (spec r4)

How does a message from the broker get into a workflow's inbox? (review r3, Quality-3)

"WorkflowHandler, but we could define some forwarder to stream abstraction, right?". So the core has a forwarder in the other direction: it takes a message from a broker queue and stores it in the workflow stream through `WorkflowHandler`'s store-only path for the inbox mode. The workflow processor decides later.

## Q46 (spec r4)

Which remaining findings of review r3 are resolved as proposed?

Fixed to match Java: Q&A-1 (cancel only works on an unpaid order and sends only `ReleaseStock`), Q&A-2 (a rejected fulfillment also releases the stock), Q&A-3 (the cart forwarder has a summary too). Criteria fixed: Quality-8 (money as in Java: a number in currency units rounded to cents, for example 3 × 19.99 = 59.97), Quality-11 (criteria for the same-transaction checkpoint, the `outputHandler` crash path, the RabbitMQ publish timeout and who sets `now`), connection setting names from Java (Q&A-8). Q&A-9: the no-OTLP-endpoint test (30.6) is in this spec.

## Q47 (spec r4)

In inbox mode, each input of the order workflow, including the order's own events, is copied into the workflow stream before it is handled: one extra append per input (review r3, Quality-10). Keep inbox mode?

"use inbox mode for now". The extra append per input is accepted. Delivering messages after the processor's transaction commits is "not acceptable" (review r3, Quality-6 is dropped: it was not verified, and forwarders must not run other modules' handlers inside their processing).

## Q48 (plan r2)

Where do the order workflow's commands to other modules (`AuthorizePayment`, `CapturePayment`, `CancelPayment`, `ReserveStock`, `RequestFulfillment`, `ReleaseStock`) land? (plan review r1, Spec-1)

"those commands are orders workflow outputs that are forwarded to message bus (kafka or rabbitMq) then it's forwarded to payments and shipments workflows". So the order workflow's `outputHandler` sends them to the broker, and the broker-to-workflow forwarder stores them in the payment or shipment workflow's inbox; that workflow passes them on to its module's handler.

## Q49 (plan r2)

The spec says Emmett changes come first, and the run stops after each one (Q36). Keep that order? (plan review r1, Spec-5)

"Just do what you can in samples and emmett prs in parallel, then we update it when they're fixed". So the Emmett changes are prepared on their branches in parallel with the sample work, and the run doesn't stop for them. Until an Emmett change is released, the sample uses its own code in the core package for it; when it is released, the sample switches to Emmett's. This replaces the stops of Q36.

## Q50 (plan r2)

Do given requests that fail make the test fail? Emmett's Hono `ApiE2ESpecification` doesn't check them today; Java fails the test unless the step is an attempt. (plan review r1, Steps-1)

"you can check errorstatuses and problem details". So given requests keep Emmett's behaviour, and tests check failures explicitly with error status and problem details expectations.

## Q51 (plan r2)

The SQLite setup has no broker, so what does `MESSAGING_INTERNAL_DELIVERY=broker` (the default) mean there? (plan review r1, Spec-2)

"broker can be emulated by streams and consumers, right?". Yes. Without Kafka or RabbitMQ (`MESSAGING_BUS=in-memory`), the broker is emulated in the event store: each channel is a stream, a forwarder appends to the channel stream, and consumers read it like a queue. So `broker` works in every setup, and the delivery without a broker follows the same path as with one. This replaces 19.7's direct store into the receiving workflow's inbox: the broker-to-workflow forwarder reads the channel stream and stores the message in the workflow's inbox.

## Q52 (plan r4)

The catch-up loop in the `ApiE2ESpecification` has no timeout; Java bounds it at 30 s. Add a bound? (step 1 review)

"No bound". A catch-up that never settles ends at Vitest's test timeout.

## Q53 (plan r4)

No step adds a CI workflow for `samples/e-commerce`. Add one?

"Yes, in step 2": a workflow like the other samples' `.github/workflows/samples_*.yml`, extended as later steps add Docker tests.

## Q54 (step 2 review)

What are the trusted type names and the old-name upcasts (`messageTypes`)?

They were a port of Java's `MessageMapping` trusted packages. In Java, Jackson builds a class from the type name, so it allows only known packages. Node has no class loading, so a trusted list guards against nothing, and the old-name map only wrapped Emmett's own `upcast`. Oskar chose "Drop both". So `messageTypes` is removed, 23.4 and the "Message mapping" line are removed, and 23.3 uses Emmett's `upcast` in the processor's `messageOptions`.

## Q55 (step 2 review)

How do readers of a channel avoid a second copy of the same message, for example a workflow command that is both in the workflow's outbox and in the channel stream?

Oskar: "just use streams as channels and forward only from channels so checking also stream prefix then they won't be delivered twice, right?" So a channel is a stream `channel:<name>`, a reader is a reactor on the same event store consumer with `canHandle` set to its types, and it handles a message only when its stream is the channel stream and the binding key matches. There is no separate consumer, message source or "emulated broker".

## Q56 (step 2 review)

Oskar: "And ofc allow no internal broker mode with pure emmett". Asked where the cart's external event goes in that mode, Oskar chose "Per-cart external stream". So `MESSAGING_BUS=none` has no channel streams: the cart appends `shopping_carts.external.ShoppingCartCheckedOut` to `shopping_carts:external:<cartId>`, and readers take messages by `canHandle` from the streams where they were stored, including workflow output commands from the workflow stream.

## Q57 (step 2 review)

What shape do forwarders and readers have, after "ensure that forwarders and consumers you added API is consistent and idiomatic to other Emmett built in processors and consumers"?

They follow Emmett's processors: an Emmett reactor registered with `consumer.reactor({ processorId, canHandle, eachMessage })`, which gets the store's transaction scope and checkpoints. The core supplies only the handler: `forwardToChannels` for a forwarder (routings, optional mapping, retry inside the handler) and `fromChannel` for a reader. There is no message bus (Q22), no send target and no message shape of the sample's own: messages are Emmett messages with Emmett metadata. The cart summary is an inline Pongo projection (Q38), and the forwarder reads it.

## Q58 (step 8 review)

The step asked both for the sample core's shape and for #436's proposal, which disagree on the appended-events check. Which wins, and do the Hono docs change on the same branch?

Oskar chose "Emmett names, core strictness": Emmett keeps `expectNewEvents` and `expectNoNewEvents`, and they check exactly the streams and event counts the `when` step appended, in any stream order, with each event matched as a subset, as the sample core does. On the docs: "Yes, same branch": `docs/frameworks/honojs.md` and `docs/guides/testing.md` are updated on `hono_api_e2e_specification_steps`.

## Q59 (step 3)

In step 3 the unpaid-orders worker stored `CloseUnpaidOrder` as an input of the order workflow, and the workflow passed it on to the orders handler as its output (Q44 as written into the spec and plan). Emmett's workflow processor stores that output in the workflow's stream under the same name, and because the name is on the workflow's input list (`workflowProcessor.ts:243`), it handles the output as a new input, endlessly. Asked why the workflow would send its input again, there was no good reason: the workflow only relayed the command. Java's worker sends `CloseUnpaidOrder` straight to the orders facade (`OrdersConfig.java:128`).

Oskar: "Yes" to changing it as in Java. So the unpaid-orders worker stores `CloseUnpaidOrder` in the order's stream and it goes straight to the orders handler (through the event store or the `orders-internal` channel, Q40), without the order workflow. I then also dropped the payment and shipment workflows of Q44 from the spec and plan; Oskar: "Are you fng nuts, why are shipment and payments workflows gone?!" They are restored: Q44 stands. How the payment and shipment workflows pass commands on without the same loop is open. A workflow reacts to events, and a command from a broker may still run a handler (Oskar: "We don't need command when reacting if we're using workflow, we can just listen to events, but for brokers, fine").

## Q60 (step 3 review)

What does "no broker" mean, and how are modules kept apart? Java has no such mode: its `messaging.bus` is `in-memory`, `kafka` or `rabbitmq`, and even a module's own commands travel on `-internal` channels. The earlier `none` setting (Q56) let modules read each other's streams in one shared store.

Oskar: "no broker mode means (and in general it means): each module has its own database (for sqlite that means different file), for such mode it just forward message to another store. Message broker using Emmett event store is the similar either internal channel stream, or if external a dedicated database/file". On PostgreSQL, a schema per module in one database: "Fine". On KurrentDB, one instance: "use some modules prefixes in the stream name so {module}_{streamtype}-{id}".

So every module has its own event store and read models (a SQLite file each, a PostgreSQL schema each, or `{module}_{streamtype}-{id}` stream names on one KurrentDB; the stream names are used in every store). `MESSAGING_BUS=none`: a forwarder writes straight into the receiving module's store, into its workflow inbox. `MESSAGING_BUS=in-memory`: a module's `-internal` channel is a stream in its own store, and the channels between modules are streams in a dedicated broker database. This replaces Q56, and the `requests:` streams proposed during the review are dropped.

## Q61 (wave A reviews)

Oskar, on a list of seven detailed review questions: "Are you kidding me, how can I answer to such scrutinised questions?!" So Claude decides these by the Java or Emmett default and records them here; Oskar may veto any:
1. Orders without a broker: the order workflow decides a command and the orders handler records the event, as in Java and Emmett.
2. A handler run by a processor on SQLite writes through a store on the processor's own connection that also runs the module's inline projections, until Emmett #432 is fixed. This replaces spec L398's "through the application's event store" for that case.
3. 5.3 drops "in one append": Emmett's `WorkflowHandler` already appends all outputs of one decision together, and the black box can't see it.
4. Broker catch-up in tests as in Java: committed Kafka offsets against end offsets, and a probe message per RabbitMQ queue, without blocking a consumer's start.
5. Unknown type (20.8, 21.8) as in Java: only a message that can't be read goes to dead letters; a readable message no processor on the queue handles is acknowledged and skipped, and catch-up doesn't wait for it.
6. Emmett processor retry policy: with a policy, each message is handled and committed in its own transaction, so no handler runs twice; without one, nothing changes.
7. Emmett workflow processor: in a workflow's own stream, only entries marked `input: true` are inputs, so a workflow that passes a command on under the same name (the payment and shipment workflows, Q44) doesn't loop.

## Q62 (step 3 rewire review)

With `MESSAGING_BUS=none`, the cart wrote straight into the orders workflow inbox, while orders wrote `channel:payments-requests` into the payments store: two shapes, and writing into another module's inbox would make one module import the other's `WorkflowHandler`. Claude decides (Oskar may veto): one shape. On `none`, a forwarder appends to a channel stream in the receiving module's own store, and the receiver's `fromChannel` reactor stores the message in its workflow inbox, the same as `in-memory` except that the channel stream lives in the receiver's store instead of the broker database. This refines Q60's "into its workflow inbox".

## Q63 (Emmett fix reviews)

Claude decides these by the plain default (Oskar may veto), from the Opus reviews of the Emmett branches for #437, #440, #441, #432, #434 and #435:
1. #437, which checkpoint stays after a failed batch: the one that matches what was saved. Where the processing scope is a transaction (PostgreSQL, SQLite on a file), the batch rolls back and the checkpoint stays before it; where it isn't (MongoDB, EventStoreDB, in-memory, Cloudflare D1), the earlier messages' writes stay and the checkpoint stays after the last one that succeeded, as on `main`. A handler that returns a stop with an error rolls back like one that throws.
2. #440: the old `getETagFromIfNotMatch` and `IF_NOT_MATCH` stay exactly as they were, deprecated; the fixed behaviour is only in `getETagFromIfNoneMatch` and `IF_NONE_MATCH`. Docs and READMEs describe the new ones.
3. #441: a message the workflow skips runs no `beforeAll` hook and opens no workflow span; pinned by a test and stated in the commit message.
4. #432: `onBeforeCommit` on a processor's store runs inside the processor's transaction, so it can see events that are later rolled back or retried; the docs say so. MongoDB and EventStoreDB follow on their own branch.
5. #434: in the separate inbox mode, an input whose decision appends nothing stays unmarked and can be decided again on redelivery; the docs say so.
6. #435: a custom behaviour gets the method and its arguments; behaviours not reaching processors started from `wrapped.consumer()` is documented as a limit for now.
7. #442 is done in stages: the `MessageStore` interface and generalised option types with the in-memory store first, then the workflow handler and `context.session.messageStore`, then one store per branch.
8. Merge order: `processor_retry_policy` is rebased onto `processor_error_rolls_back`, keeping one error log per failure in both modes.

## Q64 (step 4 review)

Oskar, on the capture client storing the provider's answer itself: "External tools can use workflow's outputhandler, right?! And stop hacking". So the capture, authorization and fulfillment clients are the `outputHandler`s of the payment and shipment workflows: each calls the outside service for the workflow's output and returns its immediate answer (for example `FailPaymentCapture` when the provider refuses), which Emmett stores as the workflow's next input in the same transaction. A confirmation that comes later arrives from outside as a message, as Java's sandbox publishes `ConfirmPaymentCapture`. No reactor and no second connection write into the module's store.

Claude decides the rest of the step 4 review by default (Oskar may veto):
1. The expected failures for Emmett #439 stay (Oskar: "Finish the work with bugs if they're not blocked then we adjust"), in one shared helper, and a timed-out test stops its application.
2. On `none`, orders and payments writing into each other can stall until Emmett #438 is released (Oskar chose B); a test with orders and payments under concurrent load pins it as an expected failure naming #438.
3. 11.1's sandbox `Location` is checked in step 6; step 4 checks the provider's checkout URL, as Java's test does.
4. `modules` and the other test-only options are not part of the production `createApplication` options.

## Q65 (step 4 review)

How do the order, payment and shipment workflows handle commands, after the loop of a workflow passing a command on under the same name? Claude kept proposing extra or relayed commands and separate handlers. Oskar: "I told you that we don't need doubled commands", "See how CheckoutGuest and GuestCheckedOut are handled", "And we said Payments and shipments should have workflow so wtf decideer?!", "Output handler is for external tools, so for instance payment gateway, whatever...", and on the order workflow's `Record…` commands to a separate orders handler: "are you fng joking?!".

So, as in Emmett's group checkout (`guides/workflows.md`): each process is a workflow with state that decides its events itself (here one per module; more when a module has more flows). A command comes in once, as a workflow input, and is decided there; no handler next to the workflow, no command passed on, no command doubled, and no output is ever an input. The Java `OrderDecider`, `PaymentDecider` and `ShipmentDecider` rules become the workflows' `decide`; `evolve` only builds the state from the events (Oskar: "evolve don't decide on anything, it only builds state from events"). The workflow's outputs are its own events and commands for other modules; forwarders send those to other modules (this corrects Q22 and Q48, which had the `outputHandler` send them). The `outputHandler` only calls external tools (the payment gateway, the warehouse), and their answer is the workflow's next input (Q64). Q44's "without state" is replaced. Q59's direct path for `CloseUnpaidOrder` is replaced too: it is an input of the order workflow, like any other command for an order.

## Q66 (step 3 and 4 rework review)

Q61 item 2 (a store on the processor's connection that runs the inline projections until Emmett #432 is fixed) is superseded by Oskar's rule: "it can fail in samples, if there's a real bug in Emmett ... stop workarounding!" The sample appends through Emmett's `context.session.messageStore`; the tests whose read models depend on those appends are marked as expected failures naming #432.

Claude decides by default (Oskar may veto): a workflow stamps its decisions with its own clock, whatever path the input came by; customer commands through `WorkflowHandler` retry version conflicts (3 attempts in all) as the spec's Modules section says; a customer command stored by the synchronous `WorkflowHandler` and then handled again by the inbox processor is Emmett #434 (an inbox that doesn't skip an input already handled), so the sample doesn't work around it and marks what it breaks.

## Q67 (step 3 and 4 rework review)

Where does shipments check stock? Java's `ShipmentFacade.reserveStock` asks the warehouse `isProductAvailable` for each item, then the decider decides `StockReserved` or `ProductWasOutOfStock`. After Q65 the rework put the warehouse call inside the shipment workflow's `decide`. Oskar: "If it's external, then it should go through output handler, right? and returning answer from output handler as input". So on `ReserveStock` the shipment workflow outputs a request to the warehouse; its `outputHandler` asks the warehouse whether every product is available and returns the answer as the workflow's next input; `decide` then records `StockReserved` or `ProductWasOutOfStock` from that answer. `decide` uses only its input and state.

## Q68 (step 4)

Should "pay now" (the checkout session, 11.1) also call the provider through the payment workflow's `outputHandler`? The API calls the provider, gets the checkout URL, records `RecordCheckoutSession` through `WorkflowHandler` and redirects, as Java's `OrdersController` and `PaymentFacade` do. Oskar: "this sounds good to me". So it stays: the customer's HTTP request needs the URL at once, so the API calls the provider before giving the command to the workflow. Every other external call comes out of a workflow decision and goes through its `outputHandler` (Q64, Q67).

## Q69 (step 5)

Do we need KurrentDB? It was in the plan because the port kept Java's three setups (Q3), with Kafka + KurrentDB as Java's default, and it was the only setup with asynchronous read models (Q26, criteria group 31). Oskar: "Drop kurrentdb and just use SQLite and PostgreSQL". So the event stores are SQLite and PostgreSQL only. The three setups become SQLite without a broker, Kafka + PostgreSQL and RabbitMQ + PostgreSQL (any pair still works, Q42). Group 31, step 5 Part 3 and the `kurrentdb` setting values go; the default store is PostgreSQL. This replaces Q13 and Q26 and changes Q3.

## Q70 (steps 3-4, decided by Claude)

On `MESSAGING_BUS=none` the published messages come from separate module stores, so no order holds between them: `ReserveStock` (shipments store) can be recorded before `AuthorizePayment` (payments store). `expectPublished` compared by index, so two order tests failed now and then. A broker keeps order only per routing key (Kafka partition, RabbitMQ queue), so the test can promise no more. Decision: `expectPublished` keeps the order of messages with the same routing key and ignores the order between different keys. No sorting or timestamps in the test application.

## Q71 (steps 3-5)

Oskar on the test application recording published messages with extra reactors and observer consumers: "why do you need additional reactor if it's just checking append?" There is no need. Follow-up from Oskar: "why would it read? expectAppended reads nothing afaik". Right: `expectAppended` takes `appendedEvents` from Emmett's `WrapEventStore`, which records each append as it happens. So on `none` and `in-memory` the test application wraps the stores that hold channel streams (`broker.db`, or the receivers' stores on `none`) with `WrapEventStore`, and `published()` is their `appendedEvents` in channel streams, filtered by `publishedTypes`. No reads, no observer consumers, no `test:published:<n>` reactors. Only Kafka and RabbitMQ need a consumer, because there the broker holds the messages. To do in the step 5 fix round.

## Q72 (step 5, decided by Claude from the step 5 review)

1. Criterion 22.2 said the workflow's outputs and checkpoint commit together, so a crash saves neither. Emmett does not work that way: the workflow appends its decision (events and output commands) and moves on, and the `outputHandler` (the call to an outside system, Q64) runs as its own step after that commit. Example: the stock check calls the warehouse and fails; after a restart the stock check runs again, but `ReserveStock` is decided only once. The sample follows Emmett, so 22.2 now says: the input is decided once, and the `outputHandler` runs again after a restart (at least once).
2. Forwarders skip messages that are already in a channel stream (Oskar, Q-channels: "forward only from channels so checking also stream prefix then they won't be delivered twice"). Only the channel-stream forwarder did it. The Kafka and RabbitMQ forwarders need it too: with `MESSAGING_INTERNAL_DELIVERY=store`, a module's own commands land in a channel stream in its own store, and without the skip the Kafka forwarder would send them to Kafka as well. So all forwarders skip channel streams.
3. Criterion 25.4 said "SQLite file", but the setting is `SQLITE_FOLDER` (one file per module, Q62). It now says folder; a given folder that does not exist is created.
