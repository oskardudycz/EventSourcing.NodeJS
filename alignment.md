# EDA workshop: Node.js vs .NET vs JVM

Compared:

- **Node.js**: `workshops/event_driven_architecture` (exercises in `src/0X_*`, solutions in `src/solved/0X_*`). The older copy in `workshops/introduction_to_event_sourcing/src/15–17` covers only 01–03 and isn't compared here; see section 9.
- **.NET**: `../EventSourcing.NetCore/Workshops/EventDrivenArchitecture` (exercises in `0X-*`, solutions in `Solutions/0X-*`).
- **JVM**: `../EventSourcing.JVM/workshops/event-driven-architecture` (`exercises/` and `solved/`).

All three use the same domain (guest stay accounts and group checkout) and the same test scenarios. The differences are in scope, messaging, scaffolding, naming and docs.

State on 2026-11-11:

- **Node.js**: uncommitted. The single message bus is in place in 02–06. The 03–06 tests are split into per-module files (section 3). `tsc` is clean, ESLint has 19 errors (unused imports left by the split). Solved: 58 suites, 225 tests green.
- **.NET**: uncommitted (148 modified, 18 deleted, 12 new files). The single message bus is in place in 02–06. The tests keep the old layout. Solutions: 192 tests green.
- **JVM**: clean, last commit `675f2d5`. Not re-run for this check.

## 1. Scope

| Step | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| 00 Modelling | – | `00-Modelling` (empty project, no README) | – |
| 01 Events definition | ✅ | ✅ | ✅ |
| 02 Entities definition | ✅ | ✅ | ✅ |
| 03 Business processes | ✅ | ✅ | ✅ |
| 04 Idempotency | ✅ | ✅ | ✅ |
| 05 Optimistic concurrency | ✅ | ✅ | ✅ |
| 06 Consistency (transactional outbox) | ✅ | ✅ | ✅ |
| Real brokers (Kafka, RabbitMQ) | ❌ | ❌ | ✅ solved only |
| Failures (retries, DLQ, unreadable messages) | ❌ | ❌ | ✅ solved only |
| Metadata (correlation/causation) | ❌ | ❌ | ✅ solved only |
| Observability (OpenTelemetry, Grafana) | ❌ | ❌ | ✅ solved only |

### Modelling variants for each exercise

| Exercise | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| 02 | aggregates, immutable entities (solved); the exercise also has an `emmett` starting point with no solution | aggregates, immutable entities | aggregates, immutable entities |
| 03 exercise | aggregates, immutable entities | aggregates, immutable entities | aggregates, immutable entities |
| 04, 05 | `regular/solution1_aggregates`, `regular/solution2_immutableEntities` | `Version1-Aggregates`, `Version2-ImmutableEntities` | `solution1_aggregates`, `solution2_immutableentities` |
| 06 exercise | **immutable entities only**, at the exercise root | both versions | both versions |
| 06 solutions | `publish_asynchronously`, `publish_right_away`, both immutable entities | Version1 (aggregates) publishes asynchronously, Version2 (immutable entities) publishes right away | same pairing as .NET |

### Solution variants for 03 Business processes

| Variant | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| Transactions | ❌ | ❌ | ✅ |
| Choreography | ✅ | ✅ | ✅ |
| To-do list | ✅ (`solution4_todo_list`, plus scheduled version and projection) | ✅ (plus scheduled version and projection) | ✅ (plus scheduled version and projection) |
| Process managers | ✅ (aggregates) | ✅ | ✅ |
| Sagas, aggregates | ❌ | ✅ | ✅ |
| Sagas, immutable entities | ✅ (`solution1_saga`, the only saga) | ✅ | ✅ |
| Sagas on Kafka / RabbitMQ | ❌ | ❌ | ✅ |

### Planned next exercises

| # | Exercise | Problem |
| --- | --- | --- |
| 07 | DLQ and wrong events | messages that can't or shouldn't be processed |
| 08 | Tracing and bug finding | chaos: everything at once |

## 2. Messaging model

All three store state in an in-memory `Database` and publish afterwards over one message bus that carries commands and events (02–06). Each bus has the same doc comment explaining intent vs transport.

| | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| Bus | `getMessageBus()` | `MessageBus` | `InMemoryMessageBus` |
| API | `publish` / `subscribe` / `use` | `Publish` / `Subscribe` / `Use` | `publish` / `subscribe` / `use` |
| Duplicate delivery (04, 05) | `getMessageBus({ deliverTwice: true })` | `new MessageBus(deliverTwice: true)` | `new InMemoryMessageBus(true)` |
| Test catcher | `getMessageCatcher()`, `messageBus.use(catcher.catchMessage)` | `MessageCatcher`, `messageBus.Use(catcher.Catch)` | `MessageCatcher`, `messageBus.use(catcher::catchMessage)` |
| Catcher's any-order assertion | 05, 06 | 05, 06 | 05, 06 |
| Sync/async | sync in 02–04, `Promise` in 05–06 | `async ValueTask` + `CancellationToken` | sync, virtual threads in 05–06 |

The "bus delivers every message twice" test asserts the full message list in all three, including the commands the saga sends again.

## 3. Test layout and setup

### Where the tests are (03–06)

Example: 04, aggregates variant. Each variant folder holds `groupCheckouts/` and `guestStayAccounts/`.

| | Node.js `04_idempotency/regular/solution1_aggregates/` | .NET `04-Idempotency/Version1-Aggregates/` | JVM `e04_idempotency/solution1_aggregates/` |
| --- | --- | --- | --- |
| Business process | `businessProcess.exercise.test.ts` | `BusinessProcessTests.cs` | `BusinessProcessTests.java` |
| Guest stay entity | `guestStayAccounts/entityDefinitionTests.exercise.test.ts` | `EntityDefinitionTests.cs` | `EntityDefinitionTests.java` |
| Group checkout entity | `groupCheckouts/entityDefinitionTests.exercise.test.ts` | one initiation test in `EntityDefinitionTests.cs` (Version1 only) | none |
| Idempotency | `groupCheckouts/idempotency.exercise.test.ts`, `guestStayAccounts/idempotency.exercise.test.ts`, plus `idempotency.exercise.test.ts` with only the bus test | `IdempotencyTests.cs` | `IdempotencyTests.java` |
| Optimistic concurrency (05, 06) | `groupCheckouts/optimisticConcurrency.*.test.ts`, `guestStayAccounts/optimisticConcurrency.*.test.ts` | `OptimisticConcurrencyTests.cs` | `OptimisticConcurrencyTests.java` |

Node.js is the only one with tests next to the code. The agreed plan is to design this in JVM first and port it, so Node.js is ahead of the reference.

### Test counts for each variant

| Tests | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| Business process | 4 | 4 | 4 (solved to-do list: 5, plus 1 scheduled) |
| Guest stay entity | 6 | 6 | 6 |
| Group checkout entity | 5 | 1 in Version1, 0 in Version2 | 0 |
| Idempotency, 04–05 | 4 group + 4 guest stay + 1 bus = 9 | 9 | 9 |
| Idempotency, 06 | 3 group | 3 | 3 |
| Optimistic concurrency, 05–06 | 3 group + 2 guest stay = 5 | 5 | 5 |

The 5 Node.js group checkout entity tests go through `GroupCheckoutFacade`:

1. initiating group checkout succeeds,
2. recording guest checkout completion succeeds,
3. recording guest checkout failure succeeds,
4. recording last guest checkout completion completes group checkout,
5. recording last guest checkout after failure fails group checkout.

The .NET Version1 test, `GroupCheckoutForMultipleGuestStay_ShouldBeInitiated`, initiates through `GuestStayFacade`, the same as the 02 test. Node.js dropped that test from 03–06.

Test names match across the repos; only the casing differs (`group checkout is initiated once for the same id`, `GroupCheckoutIsInitiatedOnceForTheSameId`, `groupCheckoutIsInitiatedOnceForTheSameId`).

### Setup

| | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| Per-test setup | `beforeEach` | inline fields plus the test class constructor | `@BeforeEach` |
| Facade construction | `GroupCheckoutFacade({ database, messageBus })` | `new GroupCheckOutFacade(database, messageBus)` | `new GroupCheckoutFacade(database.collection(GroupCheckout.class), messageBus)` |
| Business process wiring | `configureGroupCheckouts({ database, messageBus })` returns the facade | build facades, then `ConfigureGroupCheckouts(messageBus, facade)` | `configureGroupCheckouts(...)` / `configureGuestStayAccounts(...)` |
| Test data | `uuid()`, `new Date()` | `Guid.NewGuid()`, `Faker`, `DateTimeOffset.Now` | `UUID.randomUUID()`, `Faker`, `OffsetDateTime.now()` |
| Exercise marker | none | `[Trait("Category","SkipCI")]` in 01 and 02 only | `@Tag("Exercise")` in every exercise test file |
| Test file suffix | `.exercise.test.ts`, `.solved.test.ts` | – | – |

### Exercise test results (failures are expected; each exercise is a starting point)

| Exercise | Node.js | .NET |
| --- | --- | --- |
| 02 | 7 of 7 fail | 7 of 7 fail |
| 03 | business process 4 and group checkout entity 5 fail, per variant | 8 of 21 fail (business process, both versions) |
| 04 | 9 idempotency tests fail per variant | 18 of 39 fail (9 per version) |
| 05 | 5 optimistic concurrency tests fail per variant | 10 of 49 fail (5 per version) |
| 06 | random: database and bus fail at a random call | 30 of 37 fail (same reason) |

## 4. Exercises 04–06

### 04 Idempotency

Same in all three: the exercise starts from the solved 03 saga, with 9 idempotency tests (in Node.js split across the module files, see section 3):

1. initiate the same group checkout twice,
2. record the same guest checkout completion twice,
3. record the same guest checkout failure twice,
4. check in the same guest stay account twice,
5. record the same charge id twice,
6. record the same payment id twice,
7. check out the guest for the same group checkout twice,
8. record the last completion twice, so the group checkout completes once,
9. let the buses deliver every message twice through the whole process.

Charges and payments carry `chargeId`/`paymentId`. The solutions:

- ignore check-in of an existing account,
- keep the recorded charge and payment ids,
- keep the group checkout id on the checked-out account,
- ignore a guest status the group checkout already has, and initiating an existing group checkout.

The exercises fail the same 9 tests per version in Node.js and .NET. The group checkout in the exercise doesn't check its status before recording a guest checkout; the solutions add that together with the guest status check.

### 05 Optimistic concurrency

The exercise starts from the 04 solution with a versioned database: `get` returns the document with its version, and `store` takes an expected version and fails with `ConcurrencyException` (`ConcurrencyError` in Node.js). There are 5 optimistic concurrency tests:

- the same initiate five times,
- five guest completions,
- completions plus a failure,
- five charges,
- a charge racing a checkout.

The solution stores with the loaded version and, on a conflict, loads, decides and stores again (up to 10 attempts). Check-in stores with expected version 0 inside the retry. It publishes only the events of the attempt that succeeded.

Remaining difference: Node.js is single-threaded, so 05 runs the calls with `Promise.all`; every handler reads before any stores, so the interleaving is the same on every run. .NET (`Task.WhenAll`) and JVM (virtual threads) run on real threads, and their database waits 1 ms after each read so parallel handlers read before the others store.

### 06 Consistency

The exercise starts from the 05 solution and keeps its tests. The database and bus fail with `TimeoutException` (`TimeoutError` in Node.js) at a random call, and then again after 2 to 4 calls. The tools don't name the outbox: a `transaction`, a `getAll` ordered by a database-assigned `position`, and `BackgroundJobs` passed to the facades. Tests flush the jobs (`runUntilIdle`, `runBackgroundJobsUntilIdle` in Node.js) before every reset and assertion.

**06 hasn't got the 04/05 changes in any repo yet:**

- the idempotency tests are still the old 3 group checkout tests,
- no `deliverTwice`,
- no guest stay idempotency,
- no `chargeId`/`paymentId` in .NET and JVM (Node.js had them from 02).

This waits on the test design for background jobs and the duplicate-delivery loop.

## 5. Exercise 01: Events definition

| | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| README | Group checkout description, rules, notes | Group checkout description | Group checkout description, rules, notes |
| Assertion | exactly 5 events and 5 distinct types | `>= 5` events and `>= 5` distinct types | exactly 5 events and 5 distinct types |
| Given data in test | None | None | Pre-declared IDs (`guestStayId`, `groupCheckoutId`, `clerkId`) |
| Skipped in CI | No marker | `[Trait("Category","SkipCI")]` | `@Tag("Exercise")` |


## 6. Exercise 02: Entities definition

Same seven tests in all three: check-in, charge, payment, payment with charge, checkout with settled balance, checkout with unsettled balance, initiate group checkout (through `GuestStayFacade`).

| | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| README | None | ✅ | ✅ |
| Command payload | `guestId`, `roomId`, `chargeId`, `paymentId` | id, amount, time; `ChargeId`/`PaymentId` only from 04 | id, amount, time; `chargeId`/`paymentId` only from 04 |
| Money type | `number` | `decimal` | `double` |
| Facade scaffolding | Only `recordCharge` shows the load/store pattern | Only `RecordCharge` shows it | `recordCharge`, `recordPayment`, `checkOutGuest` all show it |

The exercise gives you the events, which partly spoils 01. That's the same in all three, so it may be intended.

## 7. Exercise 03: Business processes

Same four tests everywhere: no payments → complete, all settled → complete, one settled and the rest unsettled → fail, all unsettled → fail.

| | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| README | None | ✅ | ✅ including "Commands and events on one message bus" |
| `GroupCheckout` entity | Given (events and status) | **Not given**: only events | Given as an empty shell |
| `GroupCheckoutFacade` | Given, every method a TODO that loads, stores, publishes, then throws | Given, same shape | Given, same shape |
| Wiring | `configureGroupCheckouts` throws "Configure group checkouts handlers here"; `configureGuestStayAccounts` subscribes `CheckoutGuest` | `GroupCheckoutsConfig` / `GuestStayAccountsConfig`, same | `GroupCheckoutsConfig` / `GuestStayAccountsConfig`, same |
| Entity tests | guest stay 6 + group checkout 5, in the module folders | same | same |
| Commands in the exercise's expected messages | `CheckoutGuest` and `RecordGuestCheckoutCompletion` / `Failure` | `CheckOutGuest` only; the 03 solutions and 04+ include `RecordGuestCheckoutCompletion` | `CheckOutGuest` and `RecordGuestCheckoutCompletion` / `Failure` |

The Node.js ES-workshop copy (`17_business_processes/regular/solution2_immutableEntities`) still appends to `guestStayAccountId`.

## 8. Naming differences

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

Node.js and JVM agree on the group checkout events; .NET is the outlier.

## 9. Docs

- **Node.js**: workshop README lists 01–06. Exercise READMEs exist for 01 (wrong content), 04, 05, 06 and solved 06; 02 and 03 have none. The ES workshop still carries the older 15–17 copy, which uses an event store instead of `Database` + `EventBus`.
- **.NET**: workshop README and a README for each exercise 01–06, plus solved 06. `00-Modelling` is an empty project without one.
- **JVM**: workshop README and a README for each exercise 01–06, plus solved 03 and 06 (Grafana instructions). `plan.md`, `todo.md` and `spec-spring-messaging.md` sit at the workshop root.

## 10. To do

1. READMEs: explain the test layout and link the test files in every repo.
2. Port the 04/05 idempotency changes to 06 in all three, after settling the background jobs test design.
3. Decide whether Node.js 06 gets the aggregates variant, or .NET/JVM 06 split by outbox style like Node.js.
4. Node.js: decide on the 02 `emmett` starting point (no solution) and the ES-workshop 15–17 copy.
5. .NET: decide on `00-Modelling`; decide whether the 01 test checks exactly 5 event types (JVM, Node.js) or at least 5.
6. Optional: Node.js 03 aggregates saga; naming alignment for the .NET group checkout events.
7. Node.js: fix the 16 ESLint errors in the 04 and 05 `idempotency` tests.
