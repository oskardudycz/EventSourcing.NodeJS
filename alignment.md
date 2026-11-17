# EDA workshop: Node.js vs .NET vs JVM

Compared:

- **Node.js**: `workshops/event_driven_architecture` (exercises in `src/0X_*`, solutions in `src/solved/0X_*`). The older copy in `workshops/introduction_to_event_sourcing/src/15–17` isn't compared.
- **.NET**: `../EventSourcing.NetCore/Workshops/EventDrivenArchitecture` (exercises in `0X-*`, solutions in `Solutions/0X-*`).
- **JVM**: `../EventSourcing.JVM/workshops/event-driven-architecture` (`exercises/` and `solved/`). JVM is the reference.

State on 2026-11-17, from a file-by-file review of exercises, solutions, tools and tests (Kafka/RabbitMQ variants only checked for the shared test data bug):

- **Node.js**: `migrated_to_current_db` at `ab21cde` (same tree as `origin/main`).
- **.NET**: `migrated_to_kurrentdb` at `3c8b01ad`.
- **JVM**: `migrated_to_kurrentdb` at `880b7fd`.

Solution suites, run on 2026-11-16: Node.js `npm run test:solved` 239 passed; .NET `dotnet test --solution EventDrivenArchitecture.slnx` all solution tests passed (the 87 failures are the unsolved exercise projects); JVM `solved` `./gradlew test --rerun` 365 passed, 0 failed.

Legend: **Aligned** means same behaviour and same test scenarios; differences that are only language idioms aren't listed.

## 1. Scope

| Step | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| 00 Modelling | – | `00-Modelling` (only a `.csproj`) | – |
| 01–06 | ✅ | ✅ | ✅ |
| Real brokers (Kafka, RabbitMQ), failures, metadata, observability | ❌ | ❌ | ✅ 03 solved only |

Planned: 07 DLQ and wrong events, 08 tracing and bug finding. The JVM Kafka/RabbitMQ plan (`spec-spring-messaging.md`, `todo.md` steps 4–8) goes last (see section 12).

### Variants

| Exercise | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| 01 solved | `simple`, `typed`, `emmett` | one | one |
| 02 exercise | `regular` plus an `emmett` starting point without a solution | one | one |
| 02 solved | aggregates, immutable entities | same | same |
| 03–05 | aggregates, immutable entities | same | same |
| 06 exercise | immutable entities only | aggregates, immutable entities | same as .NET |
| 06 solved | `publish_asynchronously`, `publish_right_away`, both immutable entities | aggregates publish asynchronously, immutable entities publish right away | same as .NET |

03 solutions:

| Solution | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| Sagas, immutable entities | ✅ `solution1_saga` | ✅ | ✅ |
| Sagas, aggregates | ❌ | ✅ | ✅ |
| Process managers | ✅ | ✅ | ✅ |
| Choreography | ✅ | ✅ | ✅ |
| To-do list (with scheduled version and projection) | ✅ | ✅ | ✅ |
| Transactions | ❌ | ❌ | ✅ |
| Sagas on Kafka / RabbitMQ | ❌ | ❌ | ✅ |

## 2. Tools

Database, message bus and message catcher have the same API and the same bus doc comment in all three. Differences:

| | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| `Database.get` copy | **shallow** (`Object.assign`), nested arrays and maps are shared with the stored document | deep (JSON round trip) | deep (JSON round trip) |
| Catcher `shouldReceiveMessages` | **partial match** (`toMatchObject`) | exact (`ShouldBeEquivalentTo`) | exact (recursive equality) |
| Unused code | – | `Core/DictionaryExtensions.cs` in 02 Solution2 | `core/EventEnvelopeBase` (02, 03), `Database.Collection.getAndUpdate` (02–04) |
| Bus doc | class only | class only | class plus every method |
| Retry on conflict (05) | hand-written loop, 10 attempts | Polly `RetryAsync(9)`, 10 attempts | hand-written loop, 10 attempts |

## 3. Tests

Test names match in every exercise and in every 03 solution that exists in all three. Setup, steps and expected messages also match, apart from:

- Fixed on 2026-11-17: in .NET and JVM, the "all stays settled" business process test recorded the third guest's charge and payments on `guestStays[0]` (03 exercises, every 03 solution, 06 exercises and solutions).
- **Group checkout entity tests in 04–06:** only Node.js has the 5 tests (`groupCheckouts/`). .NET Version1 has one initiation test in `EntityDefinitionTests.cs`; .NET Version2 and JVM have none.
- **Layout in 04–06:** only Node.js keeps tests next to the code (`groupCheckouts/`, `guestStayAccounts/`, and the bus test at the variant root). .NET and JVM have one flat file per kind (`BusinessProcessTests`, `EntityDefinitionTests`, `IdempotencyTests`, `OptimisticConcurrencyTests`). 03 is aligned.
- **Style:** Node.js tests have no `Given` / `When` / `Then` / `And` comments (0 of 103 test files); .NET and JVM have them. .NET keeps the setup fields below the tests; Node.js and JVM at the top.
- **Markers:** .NET `[Trait("Category","SkipCI")]` only in 01 and 02; JVM `@Tag("Exercise")` in every exercise test; Node.js `.exercise.test.ts` / `.solved.test.ts`.
- **Test data:** Node.js 01 solved (`simple`) uses `const clerkId = 'room-123'`, the room id.

## 4. Exercise 01: Events definition

Same two tests with the same assertion (exactly 5 events, 5 distinct types).

- Node.js defines the events in the test file (`// 1. Define your events here`); .NET and JVM give separate event files.
- JVM pre-declares the ids in `Given`; .NET and Node.js don't.
- Node.js events carry more: `GuestCheckedIn` has `guestId` and `roomId`, and charges and payments have `chargeId` / `paymentId` from 01. .NET and JVM add charge and payment ids only from 04.
- Field and reason names differ (section 10).

## 5. Exercise 02: Entities definition

Same seven tests. Exercise scaffolding:

- **Entity stub:** JVM gives an empty `GuestStayAccount` class; Node.js and .NET give none (.NET loads `Database.Get<object>` "use here your real type").
- **Facade:** JVM shows load/store/publish in `recordCharge`, `recordPayment` and `checkOutGuest`; Node.js and .NET only in `recordCharge`. JVM's `initiateGroupCheckout` TODO says "publishing event", the others "calling your entity/aggregate". In .NET, `CheckInGuest` has no `CancellationToken`, and `CheckOutGuest` / `InitiateGroupCheckout` throw `NotImplementedException` without the TODO message.
- **Commands:** Node.js already defines `RecordGuestCheckoutCompletion` / `Failure` in 02; .NET and JVM only `InitiateGroupCheckout`. Node.js `InitiateGroupCheckout` uses `guestStayIds` while its event uses `guestStayAccountIds`.
- **Facade constructor:** JVM takes `database.collection(GuestStayAccount.class)`; Node.js and .NET take the database.

Solutions:

| | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| Aggregate style | state changes only in `evolve`, called by `enqueue` | **fields changed in the methods; `Enqueue` only records**, no apply/evolve | state changes only in `apply`, called by `enqueue` |
| Immutable shape | `businessLogic.ts` (one function per command, `decide` returns arrays) + `evolve` / `initial` | decision methods on the `GuestStayAccount` record, `Evolve`, `Initial`; no decider | `GuestStayAccountDecider` (`handle`, `decide` returns one event) + record with `evolve` / `INITIAL` |
| Check-in of an existing account | throws "Guest is already checked-in!" | not checked | not checked |
| Checkout when not open and unsettled | `NotCheckedIn` | `NotOpened` | **`BALANCE_NOT_SETTLED`** (balance checked first) |
| Error messages | "Guest account is already checked out!" for charge and payment | "Cannot record charge/payment for not opened account" | "Cannot record charge/payment if status is other than Open" |
| Immutable state id | none, events use the command's id | `Id` | `id` |

Other: the JVM immutable `INITIAL` balance is `Double.MIN_VALUE` (the smallest positive double). Node.js spells `dequeueUncommitedEvents`. Fixed on 2026-11-17: the .NET payment error said "charge", and the .NET 02 Solution1 `CheckOutGuest` didn't inherit `GuestStayAccountCommand`.

## 6. Exercise 03: Business processes

The exercise starts from the 02 solution in all three (guest stay code unchanged), with `GroupCheckoutFacade` given as TODOs that load, store, publish and throw, and wiring that throws "Configure group checkouts handlers here". Same four business process tests, 5 group checkout and 6 guest stay entity tests.

Exercise differences:

- Node.js `configureGroupCheckouts` builds the facade itself and returns it (`_groupCheckoutFacade` is unused in the exercise); .NET and JVM take a built facade.
- Completion and failure command time field: Node.js `now`; .NET `CompletedAt` / `FailedAt`; JVM `completedAt` / `failedAt` in aggregates (exercises and solutions, 03–06) and `now` in immutable entities. The JVM 03 immutable exercise had `completedAt` / `failedAt` while its solution had `now`; fixed on 2026-11-17.
- Node.js TODO typo: "do something with grup checkout and produce messages" (both variants).
- JVM facade constructors vary: 03 exercises take `Database`, 03 solutions and 04–05 take `Database.Collection<T>`, 06 takes `Database` + `BackgroundJobs`, to-do list `GroupCheckoutFacade` takes only `MessageBus`.
- .NET 03 solutions name the types `GroupCheckOut` / `GroupCheckOutFacade`; the exercise uses `GroupCheckout` / `GroupCheckoutFacade`.

Solution differences:

| | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| Recording a guest result after the group finished | ignored | **recorded** | ignored |
| Recording the same guest result twice | **recorded** | **recorded** | ignored (04's idempotency already in 03) |
| Initiating an existing group checkout | throws | overwrites | overwrites |
| Recording for a missing group checkout (saga) | ignored | throws "Entity not found" | throws "Entity not found" |
| Saga result | plain command arrays | `SagaResult` (`Send` / `Ignore`, plus unused `Event` / `Publish`) | `SagaResult` (`Send` / `Ignore`) |
| Choreography start | facade publishes `CheckOutGuest` after `GroupCheckoutInitiated` | a `GroupCheckoutInitiated` handler publishes `CheckOutGuest` | same as Node.js |
| Process manager base | `ProcessManager` in the variant `core.ts` | `ProcessManagerResult` in `GroupCheckout.cs` | `core/AbstractProcessManager`, `ProcessManager`, `Message` |

Message subscriptions match for sagas, process managers and the to-do list. .NET process manager events are named `GuestCheckOutCompleted` and `GroupCheckOutCompleted`, unlike the other .NET solutions (`GuestCheckoutCompleted`, `GroupCheckoutCompleted`).

## 7. Exercise 04: Idempotency

**Aligned.** The exercise is the 03 saga solution plus `chargeId` / `paymentId` (.NET, JVM) and `deliverTwice`; Node.js loosens its 03 group checkout guard so the tests fail. The 9 tests and the bus-twice message list match.

The solutions, in both flavours and all three repos:

- ignore check-in of an existing account,
- keep the recorded charge and payment ids,
- keep the group checkout id on the checked-out account,
- ignore a guest status the group already has, anything after the group finished, and re-initiation.

JVM exercises use `ignored` lambda parameters where solved uses `_`.

## 8. Exercise 05: Optimistic concurrency

**Aligned.** The exercise is the 04 solution on a versioned database (`get` returns document and version, `store` takes an expected version and throws `ConcurrencyException` / `ConcurrencyError`). The solution adds a retry helper: load, decide, store with the loaded version, retry on conflict up to 10 attempts, check-in stores with expected version 0, publish after the retry. The 5 tests match.

- .NET and JVM facades share a private `Handle`; Node.js repeats the retry in every method.
- Node.js runs the concurrent calls with `Promise.all` (deterministic interleaving); .NET and JVM use real threads with a 1 ms wait after each read.

## 9. Exercise 06: Consistency

The exercise starts from the 05 solution with failing database and bus (`TimeoutException` / `TimeoutError`), `transaction`, `getAll` ordered by `position`, `BackgroundJobs`, and the 05 retry given. The solution adds an `Outbox` (store in outbox, publish from outbox with a checkpoint). Publishing styles match between the repos (`publishOrStoreInOutbox` and `publishFromOutbox`).

- Node.js stores the events as they are, in one collection per outbox name. .NET and JVM store a serialized `OutboxMessage` with the type name in one collection, filtered by outbox id.
- JVM has an extra `core/Stored.java`.

**06 hasn't got the 04/05 changes in any repo:**

- the idempotency tests are the old 3 group checkout tests,
- there is no `deliverTwice`,
- the guest stay account has no idempotency (no recorded charge or payment ids, no repeated-checkout check); the group checkout keeps its 05 guards,
- there is no `chargeId` / `paymentId` in .NET and JVM.

## 10. Naming

| Concept | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| Guest recorded in group | `GuestCheckoutCompletionRecorded` | `GuestCheckoutCompleted` (`GuestCheckOutCompleted` in 03 process managers) | `GuestCheckoutCompletionRecorded` |
| Guest failure in group | `GuestCheckoutFailureRecorded` | `GuestCheckOutFailed` (same name as the guest stay event) | `GuestCheckoutFailureRecorded` |
| Guest checkout failure event | `GuestCheckoutFailed` | `GuestCheckOutFailed` | `GuestCheckoutFailed` |
| Failure reason: not checked in | `NotCheckedIn` | `NotOpened` | `InvalidState` in 01, `INVALID_STATE` from 02 |
| Failure reason: balance | `BalanceNotSettled` | `BalanceNotSettled` | `BalanceNotSettled` in 01, `BALANCE_NOT_SETTLED` from 02 |
| Checkout command | `CheckoutGuest` | `CheckOutGuest` | `CheckOutGuest` |
| Account id | `guestStayAccountId` | `GuestStayId` | `guestStayAccountId` in events, `guestStayId` in commands |
| Group checkout id on guest events and commands | `groupCheckoutId` | `GroupCheckOutId` | `groupCheckoutId` in events, `groupCheckOutId` in commands |
| Guest ids on group initiation | `guestStayAccountIds` (command: `guestStayIds`) | `GuestStayIds` | `guestStayAccountIds` (command: `guestStayIds`) |
| Check-in time | `checkedInAt` | `CheckedInAt` | `openedAt` |
| Checkout time | `checkedOutAt` | `CheckedOutAt` | `completedAt` |
| Guest completion time in group | `checkedOutAt` | `CompletedAt` | `completedAt` |
| Account status | `NotExisting` / `CheckedIn` / `CheckedOut` | `Opened` / `CheckedOut` | `OPEN` / `CHECKED_OUT` |
| Balance sign | charge +, payment − | charge −, payment + | charge −, payment + |
| Guest stay facade file | `guestStayAccountFacade.ts` | `GuestStayFacade.cs` | `GuestStayAccountFacade.java` |

## 11. Docs

Every repo has a workshop README and a README for each exercise 01–06, with the same headings. Solved READMEs: Node.js and .NET have 06; JVM has 03 (Grafana) and 06.

| Test links in exercise READMEs | Node.js | .NET | JVM |
| --- | --- | --- | --- |
| 01, 02 | ✅ | ✅ | ✅ |
| 03 | ✅ | ✅ | ✅ |
| 04 | ✅ group checkouts, guest stay accounts and message bus files | ✅ | ✅ |
| 05 | ✅ | ✅ | ✅ |
| 06 | – | – | – |

- The 02 title is "Entity Definition" in all three.
- Link labels: Node.js "aggregates" / "immutable entities", .NET "Aggregates" / "Immutable Entities", JVM "DDD Aggregate" / "Functional Decider".
- The JVM workshop README links each exercise folder; the Node.js and .NET ones don't.
- JVM keeps `plan.md`, `todo.md` and `spec-spring-messaging.md` at the workshop root.

## 12. To do

### Clear

1. 04–06 test layout: move JVM to the 03 layout (group checkout entity tests, tests split by module), then .NET, and drop the .NET Version1 initiation test.

Done on 2026-11-17: the third-guest test data in .NET and JVM; the .NET payment error message; the .NET 02 Solution1 `CheckOutGuest` base type; `now` in the JVM 03 immutable exercise commands; the Node.js 03 and 04 README test links.

### Decisions needed

1. 03 group checkout guards: should every 03 solution behave like JVM (ignore after finish and ignore repeated guest results), or should that wait for 04 as in the exercises?
2. Aggregate style in .NET 02+: switch to state changes in apply/evolve like Node.js and JVM?
3. Checkout failure reason order: JVM reports the balance first, Node.js and .NET the status first. Which one?
4. Check-in of an existing account before 04: Node.js throws, .NET and JVM don't check.
5. Immutable entity shape: one decider per entity (JVM), functions per command (Node.js) or methods on the record (.NET)?
6. Node.js tools: deep copy in `Database.get` and exact `shouldReceiveMessages`, like .NET and JVM?
7. Node.js tests: add `Given` / `When` / `Then` comments?
8. Naming (section 10): which names win for each row, including the JVM time field (`completedAt` / `failedAt` in aggregates, `now` in immutable entities)?
9. Port the 04/05 changes to 06 in all three, after settling the background jobs test design (how duplicate delivery works with the jobs).
10. 06 variants: Node.js aggregates variant, or .NET/JVM split by publishing style like Node.js?
11. JVM facade constructors: one shape across 03–06?
12. Unused code: JVM `EventEnvelopeBase` and `getAndUpdate`, .NET 02 `DictionaryExtensions`, .NET `SagaResult.Event`.
13. 06 README test links, and the variant link labels.
14. Scope: Node.js aggregates saga; Transactions in Node.js and .NET; Node.js 01 `typed` / `emmett` solutions and the 02 `emmett` starting point (including the stray `eventsDefinition.emmett.exercise.test.ts`); the ES-workshop 15–17 copy; .NET `00-Modelling`; JVM root `plan.md` / `todo.md` / `spec-spring-messaging.md`.

### Last

Last, after all the other improvements (Oskar, 2026-11-16): the Kafka and RabbitMQ work from JVM `spec-spring-messaging.md` and `todo.md` (steps 4–8: Spring Kafka, Spring AMQP, Spring Modulith, Spring Cloud Stream, docs). Their planned names `e04_spring_kafka`, `e05_spring_cloud_stream` and `e06_spring_modulith` clash with the current 04–06; the numbering is still open.
