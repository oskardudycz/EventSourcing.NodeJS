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
