# Follow-ups

Work that is out of this spec and plan, to do later. Each item says where it came from.

## Emmett

- **Workflow inbox mode doesn't skip an input it already handled.** Filed as [emmett#434](https://github.com/event-driven-io/emmett/issues/434), with three possible fixes. Source: spec review r3, Quality-4, Q43.
- **`getETagFromIfNotMatch` in emmett-honojs reads the wrong header.** `HeaderNames.IF_NOT_MATCH` is `'if-not-match'` ([etag.ts L10](https://github.com/event-driven-io/emmett/blob/main/src/packages/emmett-honojs/src/etag.ts#L10)), but the HTTP header is `If-None-Match`. The function also throws when the header is missing, so a first conditional read can't use it. The sample's `conditionalRead.ts` reads `If-None-Match` itself until this is fixed. Source: plan step 2.

- `conflictingEventStore` in `packages/application/src` moves to Emmett's `WrapEventStore` behaviours when [emmett#435](https://github.com/event-driven-io/emmett/issues/435) lands.

- The core `ApiE2ESpecification` with `expectAppended` moves to Emmett's merged API specification when [emmett#436](https://github.com/event-driven-io/emmett/issues/436) lands (given requests or event streams, and a check of the events the `when` step appended). Step 8's `hono_api_e2e_specification_steps` branch should build on it.

- Emmett fixes the sample waits for, and what it switches to when they're released:
  - [#437](https://github.com/event-driven-io/emmett/issues/437) a throwing handler's writes roll back: the channel-stream 19.4 test stops being an expected failure.
  - [#438](https://github.com/event-driven-io/emmett/issues/438) processor retry policy: forwarders and readers use it instead of `retryInHandler`; the SQLite lock tests and the `none` stall go away.
  - [#439](https://github.com/event-driven-io/emmett/issues/439) workflows count only marked inputs in their own stream: the payment and shipment workflows can pass commands on.
  - [#440](https://github.com/event-driven-io/emmett/issues/440) `If-None-Match`: `conditionalRead` uses Emmett's helper.
  - [#441](https://github.com/event-driven-io/emmett/issues/441) no `mapWorkflowId` for skipped messages: `OrderId.workflowStreamNameOf` drops its empty-id tolerance.
  - [#442](https://github.com/event-driven-io/emmett/issues/442) `appendToStream` takes commands: the cast in `appendMessageToStream` goes.
  - [#432](https://github.com/event-driven-io/emmett/issues/432), [#434](https://github.com/event-driven-io/emmett/issues/434), [#435](https://github.com/event-driven-io/emmett/issues/435), [#436](https://github.com/event-driven-io/emmett/issues/436), [#433](https://github.com/event-driven-io/emmett/issues/433): the stop-gap session store, idempotent inbox handling, `conflictingEventStore`, the core `ApiE2ESpecification` and the zero counters move to Emmett.

- Emmett branches ready to merge, in this order: `processor_error_rolls_back` (#437) → `processor_retry_policy` (#438) → `session_store_runs_inline_projections` (#432) → `workflow_skips_messages_without_id` (#441) → `workflow_inbox_skips_handled_input` (#434). Independent: `honojs_if_none_match_header` (#440), `wrap_event_store_behaviours` (#435), `message_store_abstraction` (#442 stage 1: the interface and the in-memory store; stage 2 widens projections and hooks to messages, which removes its `appendedMessages` cast, then the workflow handler, then SQLite, PostgreSQL and EventStoreDB), `metrics_series_registered_at_zero` (#433), `hono_api_e2e_specification_steps` (#436). `workflow_inputs_marked_in_own_stream` (#439) is no longer needed after Q65; Oskar decides whether to close #439 and drop it. The full Emmett `test:int` and `test:e2e` suites have not been run on these branches.

- Emmett: `store.consumer()` on SQLite and PostgreSQL takes no `source` in rc.3, so the sample's consumers that read the in-memory `broker` store are still standalone `sqliteEventStoreConsumer`/`postgreSQLEventStoreConsumer`. On the #432 fix branch only `store.consumer()` passes the store's projections to processors, so those consumers would miss them. Add `source` to `store.consumer()` options (or pass projections to standalone consumers), then switch the sample. (Found in the step 5 fix round, 2026-11-24.)

- Pongo: on PostgreSQL `countDocuments` returns a `bigint` while its type says `number`. OpenTelemetry drops a gauge observation that isn't a number, so "Orders in progress" and "Orders awaiting payment" showed no data. The sample converts with `Number(...)` in `customerShoppingCarts.countOf` and `orderMetrics`; filed as [Pongo#237](https://github.com/event-driven-io/Pongo/issues/237), fix on the local branch `count_documents_returns_number`; drop the conversions after its release. (Found 2026-11-25.)

- Emmett: branch `polling_backs_off_only_when_idle` (Q78): `1178e80c` resets the polling wait after a read that finds messages and adds `pulling.backoff`; `5c3b14dd` adds `npm run bench:consumer-latency` in `emmett-sqlite` with `consumerLatency.results.md` (values before and after); `bccd7dc0` lowers the default ceiling to 250 ms; `e5986cf5` lets `projections.async` take projections of generic event types, as `projections.inline` does. After the release, the sample's test settings use `batchSize: 100`, `batchDeadlineInMs: 0` and `backoff: { maxInMs: 20 }` instead of `batchSize: 1` (measured on the payments API file: 52 s → 32 s). (2026-11-25.)

- Emmett [#445](https://github.com/event-driven-io/emmett/issues/445): a default processor retry for transient dumbo errors (status 503) and for version conflicts on a version that `handleCommand` or `handleWorkflow` computed themselves. Oskar's call: "we'll do it after we finish our merge train". (2026-11-25.)

## Sample

- **`internalDelivery.int.spec.ts` fails on Kafka every time.** `aWorkersTimeOutPaymentDeliveredThrough_store_IsDecided` (the first Kafka test, on a fresh Kafka container) fails 3 times out of 3 when the test's own `sendingToKafka(producer)` sends `payments.AuthorizePayment`: `MultipleErrors [AggregateError]: Producing messages failed` (`PLT_KFK_MULTIPLE`), with one `ResponseError` from `Produce(v11)` (`PLT_KFK_RESPONSE`) and `produced.offsets: []`. The broker's error code inside `response` is not read yet. The `broker` test after it and both RabbitMQ tests pass. `kafkaProducer` sets `retries: 0`, and `declareKafkaTopics` waits until every partition has a leader in its ISR, so the next step is to read the error code and check whether the test sends before the application declares its topics. Earlier notes called this failure flaky; it is not. To do after the Emmett release. (Found 2026-11-25.)
