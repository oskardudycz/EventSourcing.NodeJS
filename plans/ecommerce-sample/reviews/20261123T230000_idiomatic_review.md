# Idiomatic review: e-commerce sample on Emmett

Scope: `samples/e-commerce` (packages/core and packages/application, step 2 state), compared with Emmett `main` at `0b9b5c7b` (0.43.0-rc.3, the version the sample uses), Emmett's `samples/webApi`, Emmett's dev setup, spec.md and qa.md. Paths to Emmett are relative to `/home/oskar/repos/emmett/src/packages` unless they start with `samples/` or `src/`. Read-only review: no code was changed, and `npm run lint`, `npm run build:ts` and `npm test` were not run, because the code reading gave enough evidence. progress.md says all three pass.

Severity: high = reinvents or contradicts Emmett, a decision or a rule; medium = non-idiomatic; low = style.

## What is really missing from Emmett (checked)

- Extended Hono `ApiE2ESpecification`: Emmett's version takes HTTP requests only and one response assertion (`emmett-honojs/src/testing/apiE2ESpecification.ts:26-30`). The branch `hono_api_e2e_specification_steps` has no commits over `main` yet. The core copy is justified (Q30, Q49).
- Forwarders with routing and checkpoints: Emmett has only `forwardToMessageBus` (`emmett/src/eventStore/afterCommit/forwardToMessageBus.ts:6-18`), an after-commit hook that publishes each event to an `EventsPublisher` with no channel, key, checkpoint or retry. Missing, so the core forwarder is justified.
- Broker abstraction with channels and keys: Emmett's `EventsPublisher`/`CommandSender` (`emmett/src/messageBus/index.ts:14-22`) publish one message with no channel, key or handler context. `SendTarget` is justified.
- Stream filter for processors: `BaseMessageProcessorOptions` (`emmett/src/processors/processors.ts:309-331`) has `canHandle` and `partition`, no stream filter. The emulated broker's own stream filter is justified.
- Routing, binding keys, URNs, deterministic external ids, a test clock: none in Emmett (searched `emmett`, `emmett-honojs`, `emmett-sqlite` for `forward`, `routingKey`, `bindingKey`, `MessageRout`, `clock`, `advanceBy`, `v5`).
- Not missing: retry (`asyncRetry`, used), consumer catch-up (`whenCaughtUp`, used), appended-event recording (`WrapEventStore`, used), Pongo projections (`pongoSingleStreamProjection`, used for the read models but not for the forwarder summary, see 12), handler context types (`WorkflowProcessorContext`, not used, see 28), response assertions (`expectResponse`, `expectError`, re-implemented, see 3).

## Core package

### 1. Core's test helpers import Vitest into application runtime code (high)

Where: `packages/core/src/testing/apiE2ESpecification.ts:13`, `packages/core/src/index.ts:4`, `packages/application/src/application.ts:3-7`.

Problem: the core's only entry point re-exports `testing`, and `apiE2ESpecification.ts` imports `expect` from `vitest`. `application.ts` imports `eventStoreTarget` and `recordedSends` from `@e-commerce/core`, so the application's runtime graph loads Vitest, a dev dependency. Today it does not break only because there is no runtime entry yet (`application/src/index.ts` is `export {}`). It also blocks the move to Emmett (Q30), because Emmett's helpers are test-runner agnostic.

Evidence: Emmett's Hono helpers assert with Emmett's own assertions, not a test runner: `emmett-honojs/src/testing/apiSpecification.ts:183-205` (`assertEqual`, `assertMatches`), with the assertions in `emmett/src/testing/assertions.ts:122-219`.

Fix: write the expectations with Emmett's `assertEqual`, `assertMatches` and `assertDeepEqual`, like Emmett's helpers. Tests can keep Vitest `expect` (Q33 is about the tests). If Oskar prefers Vitest inside the helpers, export them from a separate `@e-commerce/core/testing` subpath that application code never imports.

### 2. The forwarder's summary update runs outside the retry, so a failure stops the forwarder for good (high)

Where: `packages/core/src/messaging/forwarder.ts:67`, with `packages/application/src/application.ts:103`.

Problem: `prepare` (where the cart forwarder updates its Pongo summary) runs once, before `asyncRetry`. If it throws, `eachBatch` throws, the reactor turns that into `STOP` and the processor stops. `application.ts:103` then swallows the consumer's failure with `.catch(() => undefined)`, so the forwarder stops silently. Q24 says "On any failure ... the processor retries the batch with back-off, without a limit", and Q37 says retries happen inside the handlers so the processor does not stop. progress.md lists this as a known deviation ("a retry would apply them twice").

Evidence: `emmett/src/processors/processors.ts:1057-1063` (a throw from a custom `eachBatch` fails the batch) and qa.md Q24, Q37.

Fix: make the summary update idempotent: in `evolveSummary` return `current` unchanged when `current.version >= Number(event.metadata.streamPosition)`. Then move `prepare` inside the `asyncRetry` call. In `application.ts`, log or rethrow the consumer's start failure instead of dropping it.

### 3. `expectResponse` and `expectError` re-implement Emmett's, with looser types (medium)

Where: `packages/core/src/testing/apiE2ESpecification.ts:258-283`.

Problem: both are copies of Emmett's helpers written with Vitest. `body` is `object` and `problemDetails` is `object`, so a typo in a problem-details field still compiles.

Evidence: `emmett-honojs/src/testing/apiSpecification.ts:183-205`: `expectResponse<Body>(statusCode, { body?: Body; headers? })` and `expectError(status, problemDetails?: Partial<ProblemDocument>)`.

Fix: keep the `Outcome` wrapper, but type the options as Emmett does (`Body` generic, `Partial<ProblemDocument>`), and assert with Emmett's `assertEqual`/`assertMatches` (see 1). When the Emmett branch lands, these become thin adapters over Emmett's.

### 4. Messages in the specification are `unknown` (medium)

Where: `packages/core/src/testing/apiE2ESpecification.ts:30, 33, 50, 60, 89, 154, 286`.

Problem: `sendMessages`, `published`, `MessagesStep`, `send(...)`, `Outcome.published` and `expectPublished(...)` take `unknown`. A test can publish or expect anything, including a misspelled type, and the compiler cannot help.

Evidence: Emmett's message type `Message` (`emmett/src/typing/message.ts`), already used by the core's own `OutgoingMessage` (`outgoingMessage.ts:1-10`).

Fix: use `Message` (or a `MessageType extends Message` generic on `ApiE2ESpecification.for`) for `send`, `sendMessages`, `published` and `expectPublished`.

### 5. `expectAppended` passes vacuously in the fetch-only overload (medium)

Where: `packages/core/src/testing/apiE2ESpecification.ts:233-242`.

Problem: with `{ fetch }` options, the code wraps a new in-memory store that the application never receives, then reads `appendedEvents` from it. `expectNothingAppended()` always passes and `expectAppended(...)` always fails, whatever the application did.

Evidence: Emmett's fetch overload lets the caller pass `getEventStore` next to `fetch` (`emmett-honojs/src/testing/apiE2ESpecification.ts:32-38`), so the store and the app can be the same.

Fix: accept `getEventStore` with `fetch` as Emmett does, and make `expectAppended`/`expectNothingAppended` throw "needs getEventStore" when no store was given.

### 6. `messageTypes` types the upcast input as the current type (medium)

Where: `packages/core/src/messaging/messageTypes.ts:1-6, 14`, used in `packages/application/src/shoppingCarts/shoppingCartTypes.ts:4` and `shoppingCartFacade.ts:24`.

Problem: `upcasts` is `Record<string, (message: Message) => Message>` with both sides the current union. An old type name is by definition not in that union, so the input type is wrong. `TypedMessage` (`{ type: string; data: unknown }`) is a parallel of Emmett's `AnyMessage`.

Evidence: Emmett's upcast is `(payload: EventPayloadType) => StreamEvent`, with a separate payload type: `emmett/src/commandHandling/handleCommand.ts:91-96`, `emmett/src/processors/processors.ts:378-383`, `emmett/src/eventStore/eventStore.ts:123-130`.

Fix: `messageTypes<MessageType extends Message, Payload extends Message = MessageType>` with `upcasts: Record<string, (payload: Payload) => MessageType>` and `upcast: (payload: Payload) => MessageType`. Pass the payload type to `CommandHandler<ShoppingCart, ShoppingCartEvent, ShoppingCartPayload>` and to the reactor's `messageOptions`. Use Emmett's `AnyMessage` instead of `TypedMessage`.

### 7. The emulated broker's queue consumer retries forever and never dead-letters (medium, uncertain)

Where: `packages/core/src/messaging/eventStoreBroker.ts:87-102`.

Problem: a message whose handler keeps failing blocks the queue forever. spec.md "Core package / Consumers" says: "exponential back-off from the initial interval, 2 retries; messages that can't be read skip retries; then dead letters and the `messaging.dead_lettered` counter". Uncertain: that line may mean only the Kafka and RabbitMQ consumers (step 5), and plan step 2 does not say how the emulated broker's consumers retry.

Evidence: spec.md, section "Core package", bullet "Consumers".

Fix: ask Oskar whether the emulated broker follows the same rule (Q51 says the delivery without a broker "follows the same path as with one"). If yes, give `queueConsumer` the same retry count and a dead-letter stream per queue.

### 8. `as Event` when appending to a channel stream (low)

Where: `packages/core/src/messaging/eventStoreBroker.ts:29-39`.

Problem: a command is cast to `Event` to fit `appendToStream`. This is a library boundary: `EventStore.appendToStream` accepts only `Event` (`emmett/src/eventStore/eventStore.ts:49-56`), and Emmett itself casts the same way when it stores workflow commands (`emmett/src/workflows/handleWorkflow.ts:368`, `:534`, with a TODO).

Evidence: as above.

Fix: build the message with Emmett's `message(kind, type, data, metadata)` (`emmett/src/typing/message.ts:40`), which keeps `kind` typed, and keep one cast at the `appendToStream` call, as Emmett does. File an Emmett issue for `appendToStream` taking `Event | Command`.

### 9. `conditionalRead` parses `If-None-Match` by hand (low)

Where: `packages/core/src/http/conditionalRead.ts:11-17`.

Problem: the code uses `WeakETagRegex` directly. This works around an Emmett bug, which progress.md notes: Emmett reads the header `if-not-match` (`emmett-honojs/src/etag.ts:8-12`, `:57-68`). `Number(version)` gives `NaN` for a value such as `W/"1x"`, which the regex `-?\d+.*` accepts, and then nothing compares as newer.

Evidence: `emmett-honojs/src/etag.ts:10, 17`.

Fix: keep the workaround, file an Emmett issue for `IF_NOT_MATCH`, and switch to `getETagFromIfNotMatch` + `getWeakETagValue` when it is fixed. Treat a `NaN` version as "no version seen".

### 10. A second copy of `manualClock` in the spec test (low)

Where: `packages/core/src/testing/apiE2ESpecification.unit.spec.ts:22-30`.

Problem: the test defines its own `manualClock`, the same as `packages/core/src/testing/manualClock.ts`.

Evidence: both files.

Fix: import `manualClock` from `./manualClock`.

### 11. Core's dependencies don't match what it imports (low)

Where: `packages/core/package.json:13-22`.

Problem: `@event-driven-io/pongo` is listed but never imported in core. `dumbo`, `emmett-sqlite` and `sqlite3` are imported only by `forwarder.int.spec.ts`. Emmett's integration packages declare Emmett as a peer dependency, which the core will need when it moves there.

Evidence: `grep` over `packages/core/src`. Emmett: `emmett-honojs/package.json` (`peerDependencies`).

Fix: drop `pongo`. Move test-only packages to `devDependencies`. Make Emmett and Hono `peerDependencies`.

## Application package

### 12. The cart forwarder builds its own Pongo client and summary loop instead of an Emmett Pongo projection (medium)

Where: `packages/application/src/shoppingCarts/external/shoppingCartExternalEventForwarder.ts:47-80`, `packages/application/src/pongo.ts:5-14`, `external/shoppingCartSummaries.ts:63-76`.

Problem: per batch, the forwarder creates a Pongo client on the processor connection, with the sqlite3 driver hard-coded and without the schema options, and runs its own `collection.handle` loop. The `fileName` option exists only to build that client. This is what Emmett's Pongo projections already do, and Emmett passes the projections schema name and migration table, which this copy drops.

Evidence: `emmett-sqlite/src/eventStore/projections/pongo/pongoProjections.ts:91-127` (the client from `context.session.connection` with `pongoDriverOf(context.driver)` and `pongoSchemaOptions(context)`), and `:372` (`pongoSingleStreamProjection`).

Fix: define the summary as an Emmett projection, `pongoSingleStreamProjection({ collectionName, canHandle, getDocumentId, evolve: evolveSummary })`, and call `projection.handle(messages, context)` from the forwarder's handler. Use `pongoProjection({ handle })` if the forwarder needs to read the summary with the same client. The processor context has the fields that `SQLiteProjectionHandlerContext` needs (`emmett-sqlite/src/eventStore/consumers/sqliteProcessor.ts:77-95` against `projections/sqliteProjection.ts:44-61`). Uncertain: I checked this by reading the types, not by compiling it. This removes `pongoOnConnection` and the `fileName` option.

### 13. The summary-version guard cannot fail (low)

Where: `packages/application/src/shoppingCarts/external/shoppingCartExternalEventForwarder.ts:83-91`.

Problem: the summary is updated with this event's position a few lines earlier, in the same transaction, so `summary.version < streamPosition` is never true. A reader looks for a race that cannot happen.

Evidence: lines 79 and 83-91.

Fix: drop the check, or keep only the `!summary` branch.

### 14. The send recorder is always on in the application (medium)

Where: `packages/application/src/application.ts:70`, `:112-117`, `packages/core/src/messaging/recordedSends.ts:3-17`.

Problem: `recordedSends` keeps every sent message in an in-memory array for the life of the process, and `catchUp` and `sent` (test hooks) are part of the application's API. The recorder is a test concern, and in a running shop it grows without a limit.

Evidence: Emmett keeps its recording decorator in testing code and applies it only from the test side: `WrapEventStore` (`emmett/src/testing/wrapEventStore.ts`), applied in the specification, not in the application.

Fix: let `createApplication` take the send target (or a `wrapTarget` option) and have `testApplication` wrap it with `recordedSends`. Build `catchUp` in the test application from the consumer's `whenCaughtUp` and the recorder.

### 15. The consumer's start failure is swallowed (medium)

Where: `packages/application/src/application.ts:103`.

Problem: `void consumer.start().catch(() => undefined)` hides every processor error, so a stopped forwarder shows up only as a missing message in a test. See 2.

Evidence: Emmett's tests keep the start promise and await it on stop (`emmett-sqlite/src/storage/sqlite3/eventStore/consumers/sqliteEventStoreConsumer.projections.int.spec.ts:123-124`), so a failure surfaces.

Fix: keep the promise, and await it in `stop` (or log the rejection), so a processor failure fails the test.

### 16. `twoConcurrentAddsBothEndUpInTheCart` does not force a version conflict (medium)

Where: `packages/application/src/shoppingCarts/shoppingCartsApi.api.spec.ts:101-125`.

Problem: criterion 1.4 is "the version conflict is retried (3 attempts in all)". The test fires two requests at once and hopes they collide, so it also passes with no retry at all. Plan step 2 asks for a named store wrapper, `ConflictingOnceEventStore`, that fails the first append with a version conflict.

Evidence: plan.md step 2, test line for 1.4. AGENTS.md: "write a fake that implements the real interface, and name it after what it does".

Fix: add `conflictingOnceEventStore(store)` (a wrapper of `EventStore` that throws `ExpectedVersionConflictError` on the first `appendToStream`), use it from `testApplication`'s `getEventStore`, and assert that both products end up in the cart.

### 17. `mapError` checks `IllegalStateError` twice (low)

Where: `packages/application/src/application.ts:37-42`.

Problem: `IllegalStateError` is an `EmmettError` with status 403, so the `instanceof IllegalStateError ||` branch repeats the status check.

Evidence: `emmett/src/errors/index.ts:201-210`.

Fix: `error instanceof EmmettError && error.status === EmmettError.Codes.IllegalStateError ? new ProblemDocument({ detail: error.message, status: 409 }) : undefined`.

### 18. Application options that nobody passes (low)

Where: `packages/application/src/application.ts:32, 34`.

Problem: `pullingFrequencyInMs` and `onForwardingFailure` are never set, by the tests or by anything else. `forwarderRetry` is fine, because it maps to the spec's `MESSAGING_RETRY_INITIAL_INTERVAL` setting.

Evidence: `grep` over `packages`.

Fix: remove them until a setting or a test needs them.

### 19. The API setup is not typed as `WebApiSetup` (low)

Where: `packages/application/src/shoppingCarts/shoppingCartsApi.ts:49-55`.

Problem: the function returns a bare `(router: Hono) => void`.

Evidence: `emmett-honojs/src/application.ts:19`, Emmett sample `samples/webApi/honojs-with-postgresql/src/shoppingCarts/api.ts:35`.

Fix: annotate the return type as `WebApiSetup`.

### 20. `weakETag` in the requests duplicates Emmett's `toWeakETag` (low)

Where: `packages/application/src/shoppingCarts/shoppingCartRequests.ts:6`.

Problem: a copy of an Emmett helper.

Evidence: `emmett-honojs/src/etag.ts:40-42`.

Fix: import `toWeakETag` from `@event-driven-io/emmett-honojs`.

### 21. Product item add and remove hand-make Emmett's `merge` (low)

Where: `packages/application/src/shoppingCarts/productItems.ts:43-71`.

Problem: the find-then-map-or-append logic is what Emmett's `merge` does, and Emmett's samples use it for the same cart lines.

Evidence: `emmett/src/utils/collections/merge.ts:1`, Emmett sample `samples/webApi/honojs-with-postgresql/src/shoppingCarts/getDetails/index.ts:40-77`.

Fix: optional. Use `merge(items, productItem, sameLine, grow, () => productItem)`. Keep the current code if the Java parity of `ProductItems` matters more.

### 22. `assertProductItem` hand-rolls Emmett's validators (low)

Where: `packages/application/src/shoppingCarts/productItems.ts:86-105`.

Problem: the string and positive-number checks are what `assertNotEmptyString` and `assertPositiveNumber` do. The Emmett sample uses them for the same input.

Evidence: `emmett/src/validation/index.ts:19-31`, `samples/webApi/honojs-with-postgresql/src/shoppingCarts/application.ts:44-46`.

Fix: use Emmett's validators if the Java error messages are not required. They throw `ValidationError` (400) too, but with codes such as `NOT_A_POSITIVE_NUMBER`.

### 23. A malformed `If-Match` version answers 500 (low)

Where: `packages/application/src/shoppingCarts/shoppingCartsApi.ts:34-39`.

Problem: `WeakETagRegex` is `/W\/"(-?\d+.*)"/`, so `W/"1x"` passes `isWeakETag`, and `BigInt("1x")` then throws a `SyntaxError` with no status, which the problem-details middleware maps to 500, not 400. I found this by reading the code; I did not run it.

Evidence: `emmett-honojs/src/etag.ts:17, 25-38`; `emmett/src/http/errorToProblemDetails.ts:4-31`.

Fix: check the value with `/^-?\d+$/` before `BigInt`, and throw `ValidationError` otherwise.

### 24. The config module depends on the forwarder file (low)

Where: `packages/application/src/shoppingCarts/shoppingCartsConfig.ts:1-7`.

Problem: the channel list is imported from the forwarder, and `shoppingCartsRoutes` is re-exported but never used. Configuration should be the root that the forwarder reads, not the other way round.

Evidence: `grep` for `shoppingCartsRoutes`.

Fix: declare the channel and routes in the config file and import them in the forwarder, or drop the config file until step 5 needs it.

### 25. A test starts a request it never awaits (low)

Where: `packages/application/src/shoppingCarts/shoppingCartsApi.api.spec.ts:357-364`.

Problem: the add request in `setTimeout` is fired and forgotten. If the read answers before it ends, the request can still run after `stop` closes the store, which leaves an unhandled rejection.

Evidence: the code at those lines.

Fix: keep the promise of the delayed add, and await it in the `TestRequest` after the read returns.

## Dev setup

### 26. Small drift from Emmett's setup (low)

Where: `packages/core/package.json:7-9`, root `package.json:27-31`, `vitest.shared.ts`.

Problem: the rest is a faithful copy of `src/tsconfig*.json`, `eslint.config.mjs`, `.prettierrc.json`, `.vscode/*` and `.nvmrc`. The differences: core resolves through `exports: "./src/index.ts"`, where Emmett uses tsconfig `paths` plus `resolve.tsconfigPaths: true` in Vitest; and the scripts add `--passWithNoTests` and a `test:api` stage.

Evidence: `src/tsconfig.json:16-41`, `src/vitest.shared.ts:5-9`, `src/package.json:44-50`.

Fix: none needed for `test:api`, which follows the AGENTS.md test layers. Consider `paths` + `tsconfigPaths` so the core moves to Emmett with no import changes. Drop `--passWithNoTests` once every stage has tests.

## Forwarder and queue consumer API against Emmett's processors

Reference points: `reactor` and its options (`emmett/src/processors/processors.ts:301-401`, `:523-560`), the consumer's register-or-create (`processors.ts:232-276`, `emmett/src/consumers/consumers.ts:72-112`), the SQLite factories (`emmett-sqlite/src/eventStore/consumers/sqliteEventStoreConsumer.ts:87-131`, `:191-256`; `sqliteProcessor.ts:77-95`, `:145-186`), the workflow `outputHandler` (`emmett/src/workflows/workflowProcessor.ts:59-188`).

A general point first: returning reactor options, not a built processor, is right on SQLite. `consumer.reactor(options)` goes through `sqliteReactor`, which adds the SQLite processing scope (transaction, `session.messageStore`) (`sqliteEventStoreConsumer.ts:220-234`). A processor built with core `reactor(...)` would get no such scope. So the target shape is "a function that returns Emmett reactor options", like `workflowOutputHandler` (`workflowProcessor.ts:136-156`), not a new processor type.

### 27. `forwarder` returns its own `ForwarderProcessor` type and drops Emmett's processor options (high)

Where: `packages/core/src/messaging/forwarder.ts:13-20`, `:42-56`, `:94-108`; workaround in `packages/application/src/shoppingCarts/external/shoppingCartExternalEventForwarder.ts:53-124`.

Problem: `ForwarderProcessor` is a parallel of `ReactorOptions` with three fields. The forwarder accepts and passes on only `processorId` and `canHandle`, so `startFrom`, `stopAfter`, `hooks`, `checkpoints`, `partition`, `version`, `lock`, `observability`, `messageOptions` and the SQLite `schema` cannot be set through it. The cart forwarder therefore spreads the forwarder's result and adds `schema` and `messageOptions` outside it.

Evidence: `ReactorOptions = BaseMessageProcessorOptions & HandlerOptions & { messageOptions }` (`processors.ts:309-331`, `:367-383`); `SQLiteReactorOptions` (`sqliteProcessor.ts:145-156`).

Fix: an Emmett-shaped forwarder takes reactor options without the handler, adds its own, and returns reactor options:

```ts
export type ForwarderOptions<
  Input extends Message,
  MetadataType extends AnyReadEventMetadata = AnyReadEventMetadata,
  HandlerContext extends AnyMessageHandlerContext = AnyMessageHandlerContext,
  Outgoing extends Message = Input,
> = Omit<ReactorOptions<Input, MetadataType, HandlerContext>, 'eachMessage' | 'eachBatch'> & {
  routes: readonly MessageRoutes<OutgoingMessage<Outgoing>>[];
  target: SendTarget<HandlerContext>;
  prepare?: (messages: RecordedMessage<Input, MetadataType>[], context: HandlerContext) => OutgoingMessage<Outgoing>[] | Promise<OutgoingMessage<Outgoing>[]>;
  retry?: AsyncRetryOptions;
};

export const forwarder = <...>({ routes, target, prepare, retry, ...reactorOptions }: ForwarderOptions<...>): ReactorOptions<Input, MetadataType, HandlerContext> => ({
  ...reactorOptions,
  eachBatch: async (messages, context) => { /* route, then send inside asyncRetry */ },
});
```

The cart forwarder then passes `schema` and `messageOptions` into `forwarder({...})`, and `consumer.reactor(forwarder({...}))` stays as it is.

### 28. The handler context is an unconstrained generic, and `StoreContext` copies Emmett's type (medium)

Where: `packages/core/src/messaging/forwarder.ts:13, 42-66`; `packages/core/src/messaging/eventStoreBroker.ts:16-18, 66-69`; `packages/core/src/messaging/outgoingMessage.ts:18-21`.

Problem: `Context = unknown` everywhere, and the implementation erases it to `unknown` (`forwarder.ts:54-66`). `StoreContext = { session: { messageStore: Store } }` is Emmett's `MessageStoreSession` / `WorkflowProcessorContext` under another name.

Evidence: `WorkflowProcessorContext = MessageHandlerContext<Record<never, never>, MessageStoreSession>` (`workflowProcessor.ts:59-66`); processors constrain `HandlerContext extends AnyMessageHandlerContext` (`processors.ts:309-313`).

Fix: `HandlerContext extends AnyMessageHandlerContext = AnyMessageHandlerContext` on `forwarder`, `queueConsumer` and `SendTarget`. Type `eventStoreTarget` as `SendTarget<WorkflowProcessorContext>` and delete `StoreContext`.

### 29. `eachBatch` signatures lose the read metadata and can't return Emmett's results (medium)

Where: `packages/core/src/messaging/forwarder.ts:63-66, 104-107`; `packages/core/src/messaging/eventStoreBroker.ts:76-79`.

Problem: batches are typed `RecordedMessage<Input>[]` with the default metadata, so the SQLite metadata (global position) is lost. The return type `Promise<undefined>` rules out `MessageProcessor.result.skip()` / `stop()`.

Evidence: `BatchRecordedMessageHandlerWithContext<MessageType, MessageMetadataType, HandlerContext>` (`processors.ts:333-353`); `SQLiteProcessorEachBatchHandler` (`sqliteProcessor.ts:115-122`); `MessageProcessor.result` (`processors.ts:278-292`).

Fix: type the handlers with `BatchRecordedMessageHandlerWithContext<Input, MetadataType, HandlerContext>` (or `SingleRecordedMessageHandlerWithContext`, see 31), with `MetadataType` as a generic as in 27.

### 30. Retry is set with a private shape plus a separate `onRetry` (medium)

Where: `packages/core/src/messaging/forwarder.ts:18-19, 69-89`; `packages/core/src/messaging/eventStoreBroker.ts:62-63, 87-102`; passed through `packages/application/src/application.ts:33-34, 77-78`.

Problem: `retry?: { minTimeout?; maxTimeout? }` and `onRetry?` are a hand-made subset of the options `asyncRetry` already takes.

Evidence: `AsyncRetryOptions = retry.Options & { shouldRetryResult?; shouldRetryError? }` (`emmett/src/utils/retry.ts:5-8`); the workflow processor takes `retry?: WorkflowHandlerRetryOptions` (`workflowProcessor.ts:180`).

Fix: `retry?: AsyncRetryOptions` with the forwarder's defaults (`forever`, `factor: 2`, `minTimeout: 1000`, `maxTimeout: 30_000`) spread under it. `onRetry` is then part of `retry`. When Emmett's processor retry policy lands (Q37), switch to it.

### 31. `queueConsumer` is a hand-made per-message loop with a misleading type (medium)

Where: `packages/core/src/messaging/eventStoreBroker.ts:53-111`.

Problem: three issues. (a) It has no `canHandle`, so the reactor gives it every message in the store, but its batch is typed `ReceivedMessage<MessageType>[]`: the type says "only my messages" while the value holds all messages, filtered later by stream name (lines 80-85). (b) It names the handler `handle`, where Emmett uses `eachMessage`, and loops by hand in `eachBatch`, so it loses the reactor's per-message observability scope, `SKIP`/`STOP` results and `stopAfter`. (c) It cannot pass on the other reactor options (see 27).

Evidence: the reactor's per-message path (`processors.ts:630-700`); `HandlerOptions` with `eachMessage` (`processors.ts:333-353`). The stream filter itself is missing in Emmett (see the first section).

Fix: take `eachMessage: SingleRecordedMessageHandlerWithContext<MessageType, MetadataType & ChannelMessageMetadata, HandlerContext>` plus reactor options, and return reactor options with an `eachMessage` that returns `MessageProcessor.result.skip()` for other streams or keys and otherwise calls the handler inside `asyncRetry`. Type its input as `AnyMessage`, and narrow it with a type guard after the stream check. Keep `processorId: \`queue:${queue}\``, which matches Emmett's derived ids (`getProjectorId`, `processors.ts:488`; `getWorkflowId`, `workflowProcessor.ts:190`).

### 32. Stopping relies on a caller-supplied `AbortSignal` instead of the processor's lifecycle (medium, fix uncertain)

Where: `packages/core/src/messaging/forwarder.ts:17, 57, 71, 87`; `packages/core/src/messaging/eventStoreBroker.ts:61, 74, 89, 100`; `packages/application/src/application.ts:61, 76, 107`.

Problem: every forwarder and queue needs the application to create an `AbortController` and abort it before `consumer.close()`, or the retry loop never ends. Emmett processors stop through `close()` and the `hooks.onClose` hook, and callers never pass a signal.

Evidence: `ProcessorHooks` (`processors.ts:301-307`) and `close` (`processors.ts:790-835`). The handler context has no abort signal.

Fix: uncertain. The Emmett-shaped version creates its own `AbortController` and aborts it in `hooks.onClose` (composed with the caller's hook). But `close` runs `onClose` inside a new `processingScope` (`processors.ts:811-828`), which on SQLite opens a new transaction while the retrying batch still holds the write lock, so it may wait forever. Keep the `signal` for now, and add "abort the in-flight handler on close" to the Emmett processor retry policy branch (Q37).

### 33. `OutgoingMessage` flattens Emmett's metadata (medium)

Where: `packages/core/src/messaging/outgoingMessage.ts:3-16, 23-32`; converted back in `packages/core/src/messaging/eventStoreBroker.ts:29-38`; built by hand in `shoppingCartExternalEventForwarder.ts:104-111`.

Problem: `id`, `correlationId` and `causationId` sit at the top level, while Emmett keeps them in `metadata` (`messageId`, `correlationId`, `causationId`). Every target and forwarder converts between the two shapes, and `kind?: 'Event' | 'Command'` repeats Emmett's kind type. On the receiving side the core already uses Emmett's shape (`ReceivedMessage` = `RecordedMessage` with `key` in metadata, `eventStoreBroker.ts:45-51`), so sent and received messages differ.

Evidence: `RecordedMessageMetadata` and `RecordedMessage` (`emmett/src/typing/message.ts`); `appendToStream` reads these fields from `metadata` (`emmett-sqlite/src/eventStore/schema/appendToStream.ts:82-99`).

Fix: `OutgoingMessage<M extends Message> = M & { metadata: { messageId: string; correlationId?: string; causationId?: string } }` and `SentMessage<M> = OutgoingMessage<M> & { metadata: ChannelMessageMetadata & { channel: string } }`, or keep `channel`/`key` beside it. Then `outgoingOf` is a pick, and `eventStoreTarget` appends the message as it is.

### 34. `MessageRoutes` is a mutable class with a fluent API (medium)

Where: `packages/core/src/messaging/messageRoutes.ts:20-46`, used in `shoppingCartExternalEventForwarder.ts:24-33` and `forwarder.int.spec.ts:68-92`.

Problem: Oskar's TypeScript rules say "we prefer not use classes unless needed". Emmett builds definitions with functions over plain data (`projections.inline([...])`, `workflowOutputHandler({...})`, `reactor({...})`). The public `rules` array can also be mutated from outside.

Evidence: `~/.claude/docs/typescript.md`; `workflowProcessor.ts:136-156`; `packages/application/src/eventStore.ts:14` (`projections.inline`).

Fix: plain functions, for example `messageRoutes<M>(routeChannel('shopping_carts.external.ShoppingCartCheckedOut', channel), routeKey('shopping_carts.external.ShoppingCartCheckedOut', (m) => Urns.routingKeyOf(m.data.cartId)))`, which returns a readonly list of rules that `messageRouter` takes.

### 35. `canHandle` is typed by hand and required (low)

Where: `packages/core/src/messaging/forwarder.ts:15, 103`.

Problem: `Input['type'][]` duplicates Emmett's `CanHandle<Input>`, and making it required differs from Emmett, where it is optional.

Evidence: `emmett/src/typing/message.ts:37`; `processors.ts:326`.

Fix: comes with 27 (use `CanHandle<Input>` from `ReactorOptions`). Keep it required if Oskar wants every forwarder to name its types.

### 36. `toWorkflowInbox` types the workflow handler loosely (low)

Where: `packages/core/src/messaging/eventStoreBroker.ts:113-125`.

Problem: the handler is typed `(store, message: RecordedMessage<Input>) => Promise<unknown>`, so the result type is lost, and the context is the private `StoreContext`.

Evidence: `WorkflowHandler(...)` returns `<Store>(store, message, handleOptions?) => Promise<WorkflowHandlerResult<Output, Store>>` (`emmett/src/workflows/handleWorkflow.ts:238-256`).

Fix: type the parameter as `ReturnType<typeof WorkflowHandler<Input, State, Output>>` (or that signature with generics) and the context as `WorkflowProcessorContext` (see 28).

### 37. `SendTarget` is justified, but its name and shape could follow Emmett's bus (low)

Where: `packages/core/src/messaging/outgoingMessage.ts:18-21`.

Problem: no defect. It is confirmed missing in Emmett: `EventsPublisher.publish(event)` / `CommandSender.send(command)` take one message without channel, key or context (`emmett/src/messageBus/index.ts:14-22`). Noted so it is not re-reviewed.

Evidence: as above.

Fix: none now. When it moves to Emmett, name it after Emmett's bus (for example a `MessageSender` with `send(messages, context)`), so it sits next to `CommandSender`.

## Counts

High: 3 (1, 2, 27). Medium: 16 (3, 4, 5, 6, 7, 12, 14, 15, 16, 28, 29, 30, 31, 32, 33, 34). Low: 18 (8, 9, 10, 11, 13, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 35, 36, 37). Total: 37.
