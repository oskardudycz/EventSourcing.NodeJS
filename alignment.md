# EDA workshop: Node.js vs .NET vs JVM

Compared:

- **Node.js**: `workshops/event_driven_architecture` (exercises in `src/0X_*`, solutions in `src/solved/0X_*`). The older copy in `workshops/introduction_to_event_sourcing/src/15–17` covers only 01–03 and isn't compared here; see section 9.
- **.NET**: `../EventSourcing.NetCore/Workshops/EventDrivenArchitecture` (exercises in `0X-*`, solutions in `Solutions/0X-*`).
- **JVM**: `../EventSourcing.JVM/workshops/event-driven-architecture` (`exercises/` and `solved/`).

All three use the same domain (guest stay accounts and group checkout) and the same test scenarios. The differences are in scope, messaging, scaffolding, naming and docs.

State on 2026-11-15 (compared by test names, files and READMEs; test suites not re-run for this check):

- **Node.js**: `main` at `0ca1564`. Since 2026-11-13 the workshop only got the KurrentDB rename in Docker Compose and the fixed 05 README links.
- **.NET**: `migrated_to_kurrentdb` at `261afb2b`, plus 96 uncommitted workshop files: FluentAssertions replaced by Shouldly, xUnit v3 (`TestContext.Current.CancellationToken` in every call), `dotnet test --project` in the README. No test added or removed. The any-order assertion in 05 and 06 now compares messages as type name plus JSON, ignoring order.
- **JVM**: `migrated_to_kurrentdb` at `f0ad6d7`, plus 17 uncommitted workshop files: Docker Compose project name and port variables, Grafana LGTM always on, JDK 22 through a Gradle toolchain, Kafka/RabbitMQ test infrastructure. No exercise test changed.

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

### Where the tests are

**03 (exercise and every solution): aligned.** All three keep the entity tests next to the code: `groupCheckouts/` (5 tests) and `guestStayAccounts/` (6 tests) in each variant folder, with the business process tests at the variant root. The test names are the same in all three; only the casing differs.

**04–06: not aligned.** Only Node.js has tests next to the code. .NET and JVM keep one flat file for each kind. Example: 04, aggregates variant.

| | Node.js `04_idempotency/regular/solution1_aggregates/` | .NET `04-Idempotency/Version1-Aggregates/` | JVM `e04_idempotency/solution1_aggregates/` |
| --- | --- | --- | --- |
| Business process | `businessProcess.exercise.test.ts` | `BusinessProcessTests.cs` | `BusinessProcessTests.java` |
| Guest stay entity | `guestStayAccounts/entityDefinitionTests.exercise.test.ts` | `EntityDefinitionTests.cs` | `EntityDefinitionTests.java` |
| Group checkout entity | `groupCheckouts/entityDefinitionTests.exercise.test.ts` | one initiation test in `EntityDefinitionTests.cs` (Version1 only) | none |
| Idempotency | `groupCheckouts/idempotency.exercise.test.ts`, `guestStayAccounts/idempotency.exercise.test.ts`, plus `idempotency.exercise.test.ts` with only the bus test | `IdempotencyTests.cs` | `IdempotencyTests.java` |
| Optimistic concurrency (05, 06) | `groupCheckouts/optimisticConcurrency.exercise.test.ts`, `guestStayAccounts/optimisticConcurrency.exercise.test.ts` | `OptimisticConcurrencyTests.cs` | `OptimisticConcurrencyTests.java` |

To align 04–06, JVM (the reference) has to get the 03 layout first: the 5 group checkout entity tests in `groupcheckouts/`, the guest stay tests in `gueststayaccounts/`, and the idempotency and optimistic concurrency tests split by module. Then .NET follows, and its Version1 `GroupCheckoutForMultipleGuestStay_ShouldBeInitiated` test goes, as it did in 03.

### Test counts for each variant (exercises)

| Tests | 03 | 04 | 05 | 06 |
| --- | --- | --- | --- | --- |
| Business process | 4 / 4 / 4 | 4 / 4 / 4 | 4 / 4 / 4 | 4 / 4 / 4 |
| Guest stay entity | 6 / 6 / 6 | 6 / 6 / 6 | 6 / 6 / 6 | 6 / 6 / 6 |
| Group checkout entity | 5 / 5 / 5 | **5 / 1 in Version1, 0 in Version2 / 0** | same as 04 | same as 04 |
| Idempotency | – | 9 / 9 / 9 | 9 / 9 / 9 | 3 / 3 / 3 |
| Optimistic concurrency | – | – | 5 / 5 / 5 | 5 / 5 / 5 |

Each cell is Node.js / .NET / JVM. Apart from the group checkout entity tests, the names match in every exercise.

The 5 group checkout entity tests go through `GroupCheckoutFacade`:

1. initiating group checkout succeeds,
2. recording guest checkout completion succeeds,
3. recording guest checkout failure succeeds,
4. recording last guest checkout completion completes group checkout,
5. recording last guest checkout after failure fails group checkout.

### Test counts for the 03 solutions

| Solution | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| Sagas, aggregates | – | 4 + 5 + 6 | 4 + 5 + 6 |
| Sagas, immutable entities | 4 + 5 + 6 (`solution1_saga`) | 4 + 5 + 6 | 4 + 5 + 6 |
| Process managers | 4 + 5 + 6 | 4 + 5 + 6 | 4 + 5 + 6 |
| Choreography | 4 + 5 + 6 | 4 + 5 + 6 | 4 + 5 + 6 |
| To-do list | 5 + 1 scheduled + 5 projection + 5 + 6 | same | same |
| Transactions | – | – | 4 + 0 + 6 (no group checkout entity) |

Business process + group checkout entity + guest stay entity. JVM also has the Kafka and RabbitMQ saga tests and their infrastructure tests (routing, retries, dead letters, metadata).

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

From 2026-11-11, before the 01–03 alignment; not re-run since.

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

Aligned, apart from the CI marker and the given data.

| | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| README | Group checkout description, rules, notes, test link | same | same |
| Assertion | exactly 5 events and 5 distinct types | same | same |
| Given data in test | None | None | Pre-declared IDs (`guestStayId`, `groupCheckoutId`, `clerkId`) |
| Skipped in CI | No marker | `[Trait("Category","SkipCI")]` | `@Tag("Exercise")` |

## 6. Exercise 02: Entities definition

Same seven tests in all three: check-in, charge, payment, payment with charge, checkout with settled balance, checkout with unsettled balance, initiate group checkout (through `GuestStayFacade`).

| | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| README | ✅ with test link | ✅ with test link | ✅ with test link |
| README title | "Entity Definition" | "Entities Definition" | "Entity Definition" |
| Command payload | `guestId`, `roomId`, `chargeId`, `paymentId` | id, amount, time; `ChargeId`/`PaymentId` only from 04 | id, amount, time; `chargeId`/`paymentId` only from 04 |
| Money type | `number` | `decimal` | `double` |
| Facade scaffolding | Only `recordCharge` shows the load/store pattern | Only `RecordCharge` shows it | `recordCharge`, `recordPayment`, `checkOutGuest` all show it |
| Extra starting point | `emmett/` with its own copy of the 7 tests and 2 event type tests, no solution | – | – |

The exercise gives you the events, which partly spoils 01. That's the same in all three, so it may be intended.

## 7. Exercise 03: Business processes

Same four business process tests everywhere: no payments → complete, all settled → complete, one settled and the rest unsettled → fail, all unsettled → fail. Plus the 5 group checkout and 6 guest stay entity tests in the module folders.

| | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| README | ✅ including "Commands and events on one message bus" | same | same |
| `GroupCheckout` entity | events only (no class in Node.js) | empty class, events in `GroupCheckoutEvent.cs` | empty class, events in `GroupCheckoutEvent.java` |
| `GroupCheckoutFacade` | Given, every method a TODO that loads, stores, publishes, then throws | same shape | same shape |
| Wiring | `configureGroupCheckouts` throws "Configure group checkouts handlers here"; `configureGuestStayAccounts` subscribes `CheckoutGuest` | `GroupCheckoutsConfig` / `GuestStayAccountsConfig`, same | same as .NET |
| Commands in the exercise's expected messages | `CheckoutGuest` and `RecordGuestCheckoutCompletion` / `Failure` | **`CheckOutGuest` only**; the 03 solutions and 04+ include `RecordGuestCheckoutCompletion` / `Failure` | `CheckOutGuest` and `RecordGuestCheckoutCompletion` / `Failure` |

The Node.js ES-workshop copy (`17_business_processes/regular/solution2_immutableEntities`) still appends to `guestStayAccountId`.

## 8. Naming differences

Unchanged.

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

Every repo has a workshop README and a README for each exercise 01–06, with the same headings. Solved READMEs: Node.js and .NET have 06; JVM has 03 (Grafana) and 06.

Test file links in the exercise READMEs:

| Exercise | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| 01 | ✅ | ✅ | ✅ |
| 02 | ✅ | ✅ | ✅ |
| 03 | **names `businessProcess.exercise.test.ts` without a link** | ✅ business process and group checkout entity tests | ✅ same as .NET |
| 04 | **links only the bus test file** (`idempotency.exercise.test.ts`), not the module files | ✅ | ✅ |
| 05 | ✅ group checkouts and guest stay accounts files | ✅ | ✅ |
| 06 | – | – | – |

The link labels differ: Node.js "aggregates" / "immutable entities", .NET "Aggregates" / "Immutable Entities", JVM "DDD Aggregate" / "Functional Decider". The 02 title is "Entity Definition" in all three.

The JVM workshop README links each exercise folder; the Node.js and .NET ones don't.

Other:

- **Node.js**: the ES workshop still carries the older 15–17 copy, which uses an event store instead of `Database` + message bus.
- **.NET**: `00-Modelling` is an empty project without a README.
- **JVM**: `plan.md`, `todo.md` and `spec-spring-messaging.md` sit at the workshop root.

## 10. To do

Done since 2026-11-11: 01 asserts exactly 5 events everywhere; 01–03 READMEs, file names and to-do list aligned; 03 tests next to the code in all three; Node.js ESLint errors fixed; .NET Aspire 13.6.5. Done since 2026-11-13: .NET 03 exercise expects `RecordGuestCheckoutCompletion` / `Failure`; 03–05 READMEs link the test files in .NET and JVM; Node.js 05 links fixed; 02 title aligned.

1. 04–06 test layout: move JVM to the 03 layout (group checkout entity tests, tests split by module), then .NET. Node.js already has it.
2. Commit the .NET (Shouldly, xUnit v3) and JVM (Docker Compose, toolchain) workshop changes, and re-run all three solution suites.
3. READMEs: Node.js 03 (link the business process and group checkout entity tests) and 04 (link the module idempotency files, not only the bus file); 06 in all three. Decide whether to align the variant link labels.
4. Port the 04/05 idempotency changes to 06 in all three, after settling the background jobs test design.
5. Decide whether Node.js 06 gets the aggregates variant, or .NET/JVM 06 split by outbox style like Node.js.
6. Node.js: Emmett solution for 02 (on hold); decide on the stray `emmett/eventsDefinition.emmett.exercise.test.ts` and the ES-workshop 15–17 copy.
7. .NET: decide on `00-Modelling`.
8. Optional: Node.js 03 aggregates saga; naming alignment for the .NET group checkout events.
