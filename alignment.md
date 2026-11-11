# EDA workshop: Node.js vs .NET vs JVM

Compared:

- **Node.js**: `workshops/introduction_to_event_sourcing/src/15–17` (the current copy, per commit "Moved EDA exercises to ES workshop") and the older standalone `workshops/event_driven_architecture`.
- **.NET**: `../EventSourcing.NetCore/Workshops/EventDrivenArchitecture`.
- **JVM**: `../EventSourcing.JVM/workshops/event-driven-architecture`.

All three use the same domain (guest stay accounts and group checkout) and the same test scenarios. The differences are in scope, persistence model, scaffolding, naming, and docs.

## 1. Scope

| Step | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| 00 Modelling | – | `00-Modelling` (empty project, no README) | – |
| 01 Events definition | ✅ (15) | ✅ | ✅ |
| 02 Entities definition | ✅ (16) | ✅ | ✅ |
| 03 Business processes | ✅ (17) | ✅ | ✅ |
| 04 Idempotency | ✅ exercise + solution | ✅ exercise + solution | ✅ exercise + solution |
| 05 Optimistic concurrency | ✅ exercise + solution | ✅ exercise + solution | ✅ exercise + solution |
| 06 Consistency (transactional outbox) | ✅ exercise + solution | ✅ exercise + solution | ✅ exercise + solution |
| Real brokers (Kafka, RabbitMQ) | ❌ | ❌ | ✅ solved only |
| Failures (retries, DLQ, unreadable messages) | ❌ | partly (06 retry) | ✅ solved only |
| Metadata (correlation/causation) | ❌ | ❌ | ✅ solved only |
| Observability (OpenTelemetry, Grafana) | ❌ | ❌ | ✅ solved only |

### 04, 05 and 06 across all three

Node.js (`workshops/event_driven_architecture/src/04_idempotency`, `05_optimistic_concurrency`, `06_consistency`), JVM (`e04_idempotency`, `e05_optimistic_concurrency`, `e06_consistency`) and .NET (`04-Idempotency`, `05-OptimisticConcurrency`, `06-Consistency`) now teach the same three exercises:

- **04 Idempotency (duplicates)**: the exercise starts from the solved 03 saga without idempotency guards and adds `IdempotencyTests` (initiate twice, record completion twice, record failure twice). The solution checks in the facade whether the group checkout already exists, and ignores repeated same-status records in the entity.
- **05 Optimistic concurrency (parallel writes)**: the exercise starts from the 04 solution. The in-memory database versions documents: `get` returns the document with its version, and `store` takes an expected version and fails with `ConcurrencyException` (`ConcurrencyError` in Node.js) on a mismatch. `OptimisticConcurrencyTests` run handlers in parallel: the same initiate five times, five guest completions, completions plus a failure, five charges, and a charge racing a checkout. Without version checks, changes get overwritten and duplicates slip past the 04 guard. The solution stores with the loaded version and, on conflict, loads, decides and stores again (up to 10 attempts), publishing only the events of the attempt that succeeded.
- **06 Consistency (transactional outbox)**: the exercise starts from the 05 solution and keeps all its tests, including the concurrency ones. The in-memory database and bus fail with `TimeoutException` (`TimeoutError` in Node.js) at a random call, and then again after 2 to 4 calls, so the exercise fails on every run, in different places. The tools stay neutral and don't name the outbox: a `transaction` that commits its writes together and checks their expected versions, a `getAll` that returns documents in the order they were stored with a database-assigned `position`, and `BackgroundJobs` passed to the facades. Tests flush the jobs (`runUntilIdle`, `runBackgroundJobsUntilIdle` in Node.js) before every reset and assertion, and compare business process messages in any order. There are two solutions, each module with its own outbox: **publish asynchronously** (state and events stored in one transaction; a background job publishes in order and stores a checkpoint, and events stay in the outbox) and **publish right away** (store the state, publish, store only the events that failed to publish; a background job publishes and deletes them, best effort). Node.js has them as `solved/06_consistency/publish_asynchronously` and `publish_right_away`; .NET and JVM pair them with the modelling variants (aggregates publish asynchronously, immutable entities publish right away). The solution READMEs link the follow-up articles on ordering and logical replication, warn against building an outbox yourself, and list tooling for each platform.

Remaining differences:

- How 05 runs handlers in parallel: Node.js is single-threaded, so 05 makes its database, buses and facades async and runs the calls with `Promise.all`; every handler reads before any stores, so the interleaving is the same on every run. .NET (`Task.WhenAll`) and JVM (virtual threads) run on real threads, and their database waits 1 ms after each read, like a real one, so parallel handlers read before the others store.
- JVM sends commands over the same message bus, so its saga also retries command publishes. .NET and Node.js have a separate command bus that doesn't fail.
- All three have a workshop README. .NET and JVM have a README for each exercise 01–06; Node.js has them for 04–06, its 01 README still describes the shopping cart, and 02 and 03 have none. .NET's `00-Modelling` is still an empty project without one.
- In 04, 05 and 06, sagas are the only solution, so there's no `sagas`/`Sagas` (JVM, .NET) or `regular/solution1_saga` (Node.js) folder: the variants sit at the exercise root and share one `core`/`Core`/`tools` folder.

### Planned next exercises

| # | Exercise | Problem |
| --- | --- | --- |
| 07 | DLQ and wrong events | messages that can't or shouldn't be processed |
| 08 | Tracing and bug finding | chaos: everything at once |

### Solution variants for 03 Business processes

| Variant | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| Transactions | ❌ | ❌ | ✅ |
| Choreography | ✅ | ✅ | ✅ |
| To-do list | ❌ | ✅ | ✅ (plus scheduled version and projection) |
| Process managers | ✅ | ✅ | ✅ |
| Sagas, aggregates | ✅ (one saga solution) | ✅ | ✅ |
| Sagas, immutable entities/decider | ❌ (no separate saga variant) | ✅ | ✅ |
| Sagas on Kafka / RabbitMQ | ❌ | ❌ | ✅ (both styles) |

For 02 Entities definition, all three ship two solutions: aggregates and immutable entities. The Node.js standalone copy also had an **Emmett** variant (`02_entities_definition/emmett`); the ES-workshop copy dropped it.

## 2. Persistence and messaging model

This is the largest conceptual gap.

| | Node.js (ES workshop 16–17) | Node.js (standalone EDA) | .NET | JVM |
| --- | --- | --- | --- | --- |
| Storage | **Event store** (`aggregateStream` / `appendToStream`) | In-memory `Database` (state) | In-memory `Database` (state) | In-memory `Database.Collection` (state) |
| Publishing | Event store middleware (`eventStore.use(...)`) | `EventBus` | `EventBus` | `MessageBus` |
| Commands | Separate `CommandBus` (03) | Separate `CommandBus` (03) | Separate `CommandBus` (03) | Same `MessageBus` for commands and events; README explains intent vs transport |
| Sync/async | Sync | Sync | `async ValueTask` + `CancellationToken` | Sync |

.NET and JVM teach "store state, then publish events". The Node.js ES copy teaches "append events, the store publishes them". That fits an Event Sourcing workshop, but it is a different lesson from the other two.

## 3. Exercise 01: Events definition

| | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| README | **Wrong content**: describes the shopping cart exercise and links a nonexistent `eventsDefinition.test.ts` | None | Group checkout description, rules, notes |
| Assertion | `events.length === 5` | `>= 5` events and `>= 5` distinct types | exactly 5 events and 5 distinct types |
| Given data in test | None | None | Pre-declared IDs (`guestStayId`, `groupCheckoutId`, `clerkId`) |
| Skipped in CI | No marker | `[Trait("Category","SkipCI")]` | `@Tag("Exercise")` |

The Node.js test cannot check type distinctness, so five copies of one event pass.

## 4. Exercise 02: Entities definition

Same seven tests in all three: check-in, charge, payment, payment with charge, checkout with settled balance, checkout with unsettled balance, initiate group checkout.

| | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| README | None | None | ✅ |
| Event types given? | Yes, both unions given | Yes, both given | Yes, both given; `GuestStayAccount` is an empty class |
| Command payload | Richer: `guestId`, `roomId`, `chargeId`, `paymentId` | Minimal: id, amount, time | Minimal: id, amount, time |
| Money type | `number` | `decimal` | `double` |
| Facade scaffolding | Only `recordCharge` shows the load/append pattern | Only `RecordCharge` shows the pattern | `recordCharge`, `recordPayment`, `checkOutGuest` all show it |
| Unsettled-balance test name | Correct | **Typo**: `CheckingOutGuestWithSettledBalance_FailsWithGuestCheckoutFailed` (should be *Unsettled*; repeated in 03, 04 and 06 and their solutions) | Correct |

Because the exercise gives you the events, it partly spoils exercise 01 in every repo. That is consistent across all three, so it may be intended.

## 5. Exercise 03: Business processes

Same four tests everywhere: no payments → complete, all settled → complete, one settled and the rest unsettled → fail, all unsettled → fail.

| | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| README | None | None | ✅ including "Commands and events on one message bus" |
| Starting point | Aggregates **or** immutable entities | Version1 aggregates **or** Version2 immutable entities | Aggregates **or** functional decider |
| `GroupCheckout` entity | Given (events only) | **Not given**: only events | Given as an empty shell |
| `GroupCheckoutFacade` | Given; `initiateGroupCheckout` already implemented | **Not given**; `InitiateGroupCheckout` is on `GuestStayFacade` | Given, every method a TODO |
| Wiring | `configureGroupCheckouts` / `configureGuestStayAccounts` in `index.ts` | Nothing; the learner builds it | `GroupCheckoutsConfig` / `GuestStayAccountsConfig` with TODO subscriptions |
| Commands in expected message sequence | `CheckoutGuest` **and** `RecordGuestCheckoutCompletion` / `Failure` | `CheckOutGuest` only; no record-completion command | `CheckOutGuest` **and** `RecordGuestCheckoutCompletion` / `Failure` |

.NET exercise 03 leaves the most to the learner. JVM gives the most structure. Node.js sits in between but pre-solves `initiateGroupCheckout`.

**Bugs in the scaffolding** (Node.js and JVM): `recordGuestCheckoutCompletion` and `recordGuestCheckoutFailure` load by `groupCheckoutId` but store under `guestStayAccountId` / `guestStayId`:

- Node.js: `17_business_processes/regular/*/groupCheckouts/groupCheckoutFacade.ts` calls `eventStore.appendToStream(command.data.guestStayAccountId, events)`.
- JVM: `e03_businessprocesses/solution1_aggregates/groupcheckouts/GroupCheckoutFacade.java` calls `collection.store(command.guestStayId(), account)`.

## 6. Naming differences

| Concept | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| Guest recorded in group | `GuestCheckoutCompletionRecorded` | `GuestCheckoutCompleted` | `GuestCheckoutCompletionRecorded` |
| Guest failure in group | `GuestCheckoutFailureRecorded` | `GuestCheckOutFailed` (same name as the guest stay event) | `GuestCheckoutFailureRecorded` |
| Guest checkout failure event | `GuestCheckoutFailed` | `GuestCheckOutFailed` | `GuestCheckoutFailed` |
| Failure reason: not checked in | `NotCheckedIn` | `NotOpened` | `INVALID_STATE` |
| Failure reason: balance | `BalanceNotSettled` | `BalanceNotSettled` | `BALANCE_NOT_SETTLED` |
| Checkout command | `CheckoutGuest` | `CheckOutGuest` | `CheckOutGuest` |
| Account id field | `guestStayAccountId` | `GuestStayId` | `guestStayAccountId` in events, `guestStayId` in commands |
| Check-in timestamp | `checkedInAt` | `CheckedInAt` | `openedAt` |
| Checkout timestamp | `checkedOutAt` | `CheckedOutAt` | `completedAt` |
| Record-completion command time | `now` | n/a | `completedAt` / `failedAt` |

Node.js and JVM agree on the group checkout events. .NET is the outlier there.

## 7. Docs and discoverability

- **Node.js**: the ES workshop README doesn't list exercises 15–17. The standalone `event_driven_architecture` folder still exists, is tracked, and diverges from the ES copy (state + EventBus vs event store, plus the Emmett variant).
- **.NET**: no README anywhere in the workshop, and `00-Modelling` is an empty project.
- **JVM**: README for the workshop and for each exercise, plus a solved README with Grafana instructions.

## 8. Changes to consider to align Node.js

1. Replace the 15 README with the group checkout text (JVM's version), and add READMEs for 16 and 17.
2. Check distinct event types in the 15 test.
3. Fix the `appendToStream(guestStayAccountId)` bug in both 17 facades.
4. Decide whether to keep the standalone `event_driven_architecture` folder or remove it in favour of 15–17.
5. Link 15–17 from the ES workshop README.
6. Optional, to match .NET and JVM: add a saga variant for immutable entities, a to-do list solution, and idempotency/consistency exercises (.NET 04/06).
