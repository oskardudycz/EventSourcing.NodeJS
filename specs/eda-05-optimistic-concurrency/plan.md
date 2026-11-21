# Plan: EDA workshop exercise 05 Optimistic concurrency aligned in Node.js, .NET and JVM

Revision: 14. Built from spec r27.

Spec: `spec.md`. Q&A: `qa.md`.

## Work order

Step 1 is Node.js only and comes first, because the Node.js 05 rebuild needs the async 04. Inside every step that touches more than one repository: JVM first, then .NET, then Node.js (JVM is the reference for structure).

## Terms

- **Node.js workshop**: `workshops/event_driven_architecture/src` in this repository; exercises in `0N_*`, solutions in `solved/0N_*`.
- **.NET workshop**: `../EventSourcing.NetCore/Workshops/EventDrivenArchitecture`; exercises in `0N-*`, solutions in `Solutions/0N-*`.
- **JVM workshop**: `../EventSourcing.JVM/workshops/event-driven-architecture`; `exercises/...` and `solved/...`, packages `e0N_*`.
- **Flavour**: aggregates (JVM `solution1_aggregates`, .NET `Version1-Aggregates`, Node.js `solution1_aggregates`) or immutable entities (`solution2_immutableentities`, `Version2-ImmutableEntities`, `solution2_immutableEntities`).
- **Tools**: the in-memory database, message bus, message catcher (and in 05 the concurrency exception/error and, in solutions, the retry helper): JVM `core/`, .NET `Core/`, Node.js `tools/`.
- **Facade method called directly**: record charge, record payment, check-in, initiate group checkout, and check out in 02 and in the JVM 03 transactions solution. **Triggered by the bus**: record guest completion, record guest failure, and check out in 03–05.
- **Already-resolved promise**: `Promise.resolve(...)`; the Node.js counterpart of .NET's `ValueTask.CompletedTask` / `ValueTask.FromResult(...)`.
- **`MaybePromise<T>`**: Emmett's `T | PromiseLike<T>`, exported from `@event-driven-io/emmett`.

---

## Step 1. Node.js database and message bus are asynchronous from 02

```text
Use the `implement-step` skill.

What to build
In the Node.js workshop, 02, 03 and 04 (exercises and solutions) use an asynchronous database and message bus, as .NET does from 02 and Node.js 05 already does. Every collection operation returns an already-resolved promise; `publish` returns a promise and awaits each middleware and each handler. All code that calls the database or the bus is `async` and awaits those calls, and the tests await facades and publishes. Behaviour (what is loaded, decided, stored, published) doesn't change. Every Node.js bus from 02 to 05 declares `MessageHandler` and `MessageMiddleware`, both returning Emmett's `MaybePromise<void>`, and `use` takes a `MessageMiddleware`.

Context
- Tools today: `02_entities_definition/tools/{database,messageBus}.ts`, `03_business_processes/tools/...`, `04_idempotency/tools/...` and their `solved/` copies are synchronous (`get: (id) => T | null`, `store: (...) => void`, `publish(...): void`, `use(middleware: MessageHandler)`). `findAll` exists only in `solved/03_business_processes/tools/database.ts`, `04_idempotency/tools/database.ts`, `solved/04_idempotency/tools/database.ts`; don't add it elsewhere.
- `05_optimistic_concurrency/tools/messageBus.ts` (and solved) already has the async `publish` and a separate synchronous `MessageMiddleware = (message: Message) => void`; change its handler and middleware types to `MaybePromise<void>` and await middlewares.
- Callers to convert: 02 facades (`regular`, `emmett`, both 02 solutions), 03 exercise facades and wiring, every 03 solution (sagas both flavours, process managers, choreography, to-do list with `core/projection.ts`, `groupCheckouts/scheduledGroupCheckoutToDoList.ts`, and the projection subscription in `scheduledBusinessProcess.solved.test.ts`), 04 exercise and solution facades, saga (`groupCheckoutSaga.ts`: `onGuestCheckedOut` / `onGuestCheckoutFailed` must return the publish promise) and wiring (`index.ts`), and all 02–04 tests.
- Keep the 02 exercise TODO about passing the class to the collection.
- Do not touch `workshops/introduction_to_event_sourcing` or anything in .NET or JVM.

Similar code
- `05_optimistic_concurrency/tools/database.ts` and `messageBus.ts` (async shape, `Promise.resolve`, `await handle(message)`).
- `05_optimistic_concurrency/regular/*/groupCheckouts/groupCheckoutFacade.ts` (async facades awaiting store and publish).
- Emmett import style: the tools already `import { JSONSerializer } from '@event-driven-io/emmett'`.

Blocked by
None.

Acceptance criteria
- 1.1 GIVEN the Node.js 02, 03 and 04 tools, exercises and solutions WHEN read THEN the collection's `get`, `store` and `delete`, and `findAll` where the tools have it (03 solutions, 04), return promises that are already resolved; no tools gain `findAll`; and the message bus `publish` returns a promise and awaits each handler it calls, once or (with deliver-twice) twice.
- 1.2 GIVEN every piece of Node.js 02–04 code that calls the database or the bus, exercises and solutions (facades, wiring handlers, saga handlers, 03 process managers and choreography handlers, the 03 to-do list, its projection and the scheduled to-do list) WHEN read THEN it is `async` and awaits each database and bus call, and every handler subscribed to the bus returns the promise of the work it starts.
- 1.7 GIVEN a Node.js 03 or 04 saga solution and a group checkout for guests A and B WHEN the test awaits the initiation and both guests check out THEN `GroupCheckoutCompleted` is already published when the awaited call returns, on repeated runs (protects existing behaviour: the business process tests check this).
- 1.8 GIVEN the Node.js 03 to-do list solution with its scheduled part and a group checkout whose guests all checked out WHEN the scheduled run is awaited twice THEN `GroupCheckoutCompleted` is published once and the group checkout is removed from the list (protects existing behaviour: `scheduledBusinessProcess.solved.test.ts` checks this).
- 1.10 GIVEN every Node.js message bus from 02 to 05 WHEN read THEN it declares a `MessageHandler` and a `MessageMiddleware` type, both returning `MaybePromise<void>` from Emmett, `use` takes a `MessageMiddleware`, and `publish` awaits each middleware and each handler; the 04 and 05 buses differ only by what 05 adds (nothing in the bus).
- 1.9 GIVEN the .NET and JVM 02–04 code WHEN compared before and after THEN it is unchanged by this group.
- 1.3 GIVEN every Node.js test in 02–04 WHEN read THEN it awaits each facade call and each publish.
- 1.4 GIVEN the Node.js 02–04 solutions WHEN their tests run THEN they pass with the same expected messages as before; in the exercises the same tests fail as before (protects existing behaviour).
- 1.5 GIVEN the Node.js 02 exercise facades (`regular` and `emmett`) WHEN read THEN they are asynchronous and still have the TODO about passing the class to the collection (04 spec 16.6).
- 1.6 GIVEN the Node.js Introduction to Event Sourcing workshop WHEN compared before and after THEN it is unchanged.

Tests
- 1.1: existing 02–04 solution tests run against the async tools - assert the same published messages as before (the type check proves the promise signatures; no new test).
- 1.2: type check and lint (`npm run build:ts`, `npm run lint`) pass with no floating promises - asserts every call is awaited.
- 1.7: existing 03 and 04 saga business process tests ("…group checkout completes…") - assert `GroupCheckoutCompleted` is caught when the awaited call returns; run the solved suite three times.
- 1.8: existing `scheduledBusinessProcess.solved.test.ts` - asserts one `GroupCheckoutCompleted` after two awaited scheduled runs and the group checkout removed.
- 1.10: type check - the 02–05 buses declare `MessageHandler` and `MessageMiddleware` returning `MaybePromise<void>` and `use(middleware: MessageMiddleware)`; existing tests that register the message catcher still catch every message.
- 1.9: `git diff --stat` in the .NET and JVM repositories shows no change from this step.
- baseline: before changing anything, record the warnings in the Node.js, .NET and JVM test and build output (used by step 7, 11.4).
- 1.3, 1.4: `npm run test:solved` passes with unchanged expected messages; `npm test` fails in the exercises in the same tests as before (record the before/after list of failing exercise tests).
- 1.5: read the 02 exercise facades - async, TODO kept.
- 1.6: `git diff --stat workshops/introduction_to_event_sourcing` is empty.
- extra: a handler that throws inside `publish` rejects the awaited `publish`; no test (Q56: nothing in the workshop relies on it).
- Breaks: every 02–04 Node.js test that calls a facade without `await`; update each to `await`.
```

---

## Step 2. .NET `GetAll` is named `FindAll`, as in JVM and Node.js

```text
Use the `implement-step` skill.

What to build
In the .NET workshop, the database operation that returns all documents of a type is named `FindAll` in 03, 04 and 05, matching JVM and Node.js `findAll`.

Context
- `Solutions/03-BusinessProcesses/Core/Database.cs` (`GetAll<T>`), its caller `Solutions/03-BusinessProcesses/ToDoList/GroupCheckouts/ScheduledGroupCheckOutToDoList.cs`, `04-Idempotency/Core/Database.cs`, `Solutions/04-Idempotency/Core/Database.cs`. The 05 tools get it when step 3 rebuilds them from 04.
- 06 is out of scope: its `GetAll` (stored entries with a position) and README don't change.

Similar code
- JVM `e03_businessprocesses/core/Database.java` `findAll()`; Node.js `solved/03_business_processes/tools/database.ts` `findAll`.

Blocked by
None.

Acceptance criteria
- 14.1 GIVEN the .NET 03, 04 and 05 tools and code WHEN searched THEN there is no `GetAll`, `FindAll` is used where it was, and the 03 tests pass as before.

Tests
- 14.1: existing .NET 03 to-do list tests (`ScheduledBusinessProcessTests`) - assert the scheduled to-do list still completes group checkouts using `FindAll`; a search for `GetAll` in .NET 03 and 04 finds nothing.
- extra: .NET 06 builds and its tests pass unchanged (no 06 file in the diff).
- Breaks: none.
```

---

## Step 3. The 05 exercise is the 04 solution plus what 05 adds

```text
Use the `implement-step` skill.

What to build
In all three repositories and both flavours, the 05 exercise becomes the 04 solution of the same flavour plus: the versioned database (versions, optional expected version on store, `ConcurrencyException`/`ConcurrencyError`, the existing load delay), facades reading `.document` from the versioned `get`, the message catcher that is safe for parallel calls (JVM, .NET) with its any-order check, and the 05 tests. The 05 solution is the 05 exercise plus the retry helper and, in every facade method, the expected version and the retry. Everything the 04 tools offer stays in 05 (JVM `transaction`, `findAll`, `getAndUpdate`; .NET `FindAll`, `Subscribe(Type, …)`; Node.js `findAll`). The Node.js 05 message catcher compares exactly.

Context
- Today 05 is an older copy of 04: JVM and .NET sagas return `SagaResult` (`core/SagaResult.java`, `GroupCheckoutsConfig` unpacking it); Node.js `groupCheckoutSaga.ts` returns commands; facades throw "Entity not found" for bus commands; .NET aggregates `GroupCheckout.Finalize` never sets the status; Node.js immutable `initiateGroupCheckout` throws "Group checkout already initiated!" and `Finished` has no guest list; JVM and .NET 05 tests sit at the variant root without group checkout entity definition tests; Node.js 05 catcher uses `toEqual` / `toMatchObject` / `arrayContaining` and an `ExpectedTypes` type argument.
- Take module code (group checkouts, guest stay accounts, saga, wiring) and the entity definition and idempotency tests from the 04 solution of the same repository and flavour (`solved/e04_idempotency`, `Solutions/04-Idempotency`, `solved/04_idempotency`), keeping 04's test layout. Keep the current 05 versioned database, delay, exception/error, catcher additions and retry, carried onto the 04 tools.
- Keep the five existing concurrency tests as they are (moved in step 4); keep JVM `@Tag("Exercise")` on exercise tests.
- .NET: the per-variant core files (`Aggregate.cs`, `DictionaryExtensions.cs`) sit in the variant `Core/` folders, as in .NET 04.

Similar code
- The 04 step that made the 04 exercise the 03 saga solution (`../eda-04-idempotency/plan.md` step 6).
- Current 05 solutions for the retry shape: JVM `core/Retry.java` + `handle(...)` in facades, .NET `Core/Retry.cs` (Polly, 9 retries), Node.js `tools/retry.ts`.

Blocked by
Step 1 (Node.js 04 solution is async), step 2 (.NET 04 tools have `FindAll`).

Acceptance criteria
- 2.1 GIVEN a 05 exercise and the 04 solution of the same repository and flavour WHEN their module code is compared THEN the only difference is reading the document from the versioned result of `get`.
- 2.2 GIVEN a 05 exercise and the 04 solution of the same repository WHEN their tools are compared THEN every operation of the 04 tools is still there (Q45, Q46), and the only differences are: the versioned database (versions, optional expected version on store, the concurrency exception or error, the load delay in JVM and .NET), the message catcher's any-order check, and in JVM and .NET the catcher being safe for parallel calls.
- 2.3 GIVEN a 05 exercise and either of its 05 solutions WHEN compared THEN the shared tools differ only by the retry helper; the "retry in the facade" module code differs only by the expected versions and the retry; the "retry in the infrastructure" solution adds the aggregate store or command handler in its own `core/` and its facades call it (group 15).
- 2.4 GIVEN a 05 exercise or solution in any repository and flavour WHEN the saga is read THEN it has the 04 shape: built with the message bus, one handler each for `GroupCheckoutInitiated`, `GuestCheckedOut` and the guest checkout failure event, each sending its commands through the bus and returning nothing (in .NET the bus call's `ValueTask`, in Node.js the promise of its publish, so the bus awaits them); there is no `SagaResult`.
- 2.9 GIVEN the 05 tools in any repository WHEN read THEN they have every operation of the 04 tools, adapted to the versioned database: JVM `Database.transaction` is there (it works as group 13 says), `Collection.findAll` returns the documents, `getAndUpdate` stores without an expected version; .NET `Database.FindAll` returns the documents and the non-generic `MessageBus.Subscribe(Type, …)` is there; Node.js `findAll` returns a promise of the documents.
- 2.5 GIVEN a 05 exercise or solution and no group checkout with id X WHEN `RecordGuestCheckoutCompletion` or `RecordGuestCheckoutFailure` for X arrives THEN nothing is published and no error is thrown; GIVEN no guest stay account A WHEN `CheckOutGuest` for A arrives THEN nothing is published (in Node.js immutable entities also no `GuestCheckoutFailed`) and no error is thrown.
- 2.6 GIVEN the .NET 05 aggregates exercise or solution WHEN the group checkout completes or fails THEN its status is completed or failed, so a later guest result publishes nothing.
- 2.7 GIVEN the Node.js 05 immutable entities exercise or solution WHEN read THEN `initiateGroupCheckout` has no "Group checkout already initiated!" throw, and the group checkout state is the 04 solution's.
- 2.8 GIVEN a 05 exercise in any repository and flavour WHEN the same command is sent twice one after another THEN it is handled once, as in the 04 solution (the 05 idempotency tests pass in the exercise).
- 3.1 GIVEN a 05 exercise WHEN all its tests run THEN the business process, entity definition and idempotency tests pass, and the concurrency tests fail.
- 3.2 GIVEN a 05 solution WHEN all its tests run THEN all pass, on repeated runs.
- 6.1 GIVEN a 05 exercise or solution in any repository and flavour WHEN its entity definition and idempotency tests are read THEN they are the 04 ones of the same repository and flavour, including the five group checkout entity definition tests, the seven per-method idempotency tests, "the last completion recorded twice completes the group checkout once" and "the whole process completes once when the bus delivers every message twice".
- 6.2 GIVEN JVM and .NET 05 before the change WHEN listed THEN the group checkout entity definition tests are missing, and after the change they are there.
- 9.1 GIVEN the Node.js 05 message catcher, exercise and solution WHEN read THEN the single-message and list checks use strict equality, and the any-order check compares each message strictly and the number of messages.
- 9.2 GIVEN a 05 test expecting messages in any order WHEN one published message carries an extra field, even one set to `undefined`, THEN the test fails.
- 9.3 GIVEN the Node.js 05 tests WHEN read THEN no call passes a type argument to the message catcher, and no test file declares `type ExpectedTypes`.
- 4.1 GIVEN a 05 solution WHEN a facade method stores THEN it passes the version it loaded, and 0 when it creates the document (check-in, initiation).
- 4.2 GIVEN a 05 solution and a store that fails with a conflict WHEN the facade method retries THEN it loads the current state, decides again and stores again, up to 10 attempts in total; after the 10th failed attempt the conflict is thrown.
- 4.3 GIVEN a 05 solution WHEN a facade method succeeds after one or more conflicts THEN only the events of the successful attempt are published, once, after the retry.
- 4.4 GIVEN a 05 solution and a missing group checkout or guest stay account found inside the retry of record guest completion, record guest failure or check out guest WHEN the attempt runs THEN it ends with no events and the facade method publishes nothing; for record charge and record payment the attempt throws "Entity not found", as in 04 (Q47).

Tests
- 2.1, 2.2, 2.3: diff each 05 exercise against the 04 solution and the 05 solution against the 05 exercise - only the listed differences.
- 2.4: existing business process tests in 05 - assert the saga sends `CheckOutGuest` per guest and records completion/failure; read the saga for the 04 shape, no `SagaResult` left in 05.
- 2.9: compile/type check - every 04 tools operation exists in 05; a search finds no `GetAll` in .NET 05 (14.1 for 05). The JVM `transaction` clause ("works as group 13 says") is delivered in step 6; here it is carried over from 04 as it is.
- 2.5: (no test, as decided in 04) read the 05 facades - bus-triggered methods return without publishing for a missing entity.
- 2.6: the idempotency test "the last completion recorded twice completes the group checkout once" (from 04) - asserts the repeated completion, arriving after the group checkout completed, publishes nothing (Q56).
- 2.7: existing Node.js immutable 05 entity definition and idempotency tests (from 04) pass; the throw is gone.
- 2.8: the 05 idempotency tests (copied from 04) pass in the 05 exercise.
- 3.1: run the 05 exercise suites - business process, entity definition and idempotency pass; the five concurrency tests fail.
- 3.2: run the 05 solution suites three times - all pass.
- 6.1, 6.2: list the 05 tests - the 04 entity definition (incl. the five group checkout ones) and idempotency tests are there in JVM and .NET.
- 9.1: Node.js 05 catcher uses `toStrictEqual` for single and list checks, and the any-order check compares each message strictly plus the count.
- 9.2: no lasting test (Q56); checked once while changing the catcher.
- 9.3: search Node.js 05 tests - no type argument to the catcher, no `type ExpectedTypes`.
- 4.1, 4.3: (the check-in part of 4.1, storing with 0, is tested by step 4's check-in test, 5.3) the five existing concurrency tests in the 05 solution (facade calls at once, exact message checks) - assert each event is published once and no change is lost, which needs the expected versions and the retry.
- 4.2: the retry is tested through the concurrency tests; the 10-attempt limit can't be forced through the facades and has no test (Q56).
- 4.4: bus-triggered methods return without publishing for a missing entity inside the retry (no test, as decided in 04); charge and payment throw "Entity not found" - tested in every repository and flavour by step 5's 12.5 tests; in Node.js immutable entities it holds only after step 5.
- Breaks: every current 05 test file in JVM and .NET (replaced by the 04-based files plus the five concurrency tests); the Node.js 05 tests that used the old saga function or a type argument.
```

---

## Step 4. Every 05 facade method has a concurrency test, next to its module

```text
Use the `implement-step` skill.

What to build
In all three repositories and both flavours, 05 has seven concurrency tests: the five existing ones and two new ones (check-in five times at once checks in once; five payments at once all count towards the balance). The group checkout concurrency tests sit in the group checkouts module and the guest stay account ones in the guest stay accounts module; the variant folder keeps only the business process tests and the bus-delivers-twice test. The bus keeps calling handlers one after another.

Context
- JVM: `exercises/` and `solved/` `e05_optimistic_concurrency/solution*/OptimisticConcurrencyTests.java` (variant root). .NET: `05-OptimisticConcurrency/Version*/OptimisticConcurrencyTests.cs` and `Solutions/05-...`. Node.js: already split per module in `05_optimistic_concurrency/regular/solution*/{groupCheckouts,guestStayAccounts}/optimisticConcurrency.*.test.ts`.
- Test cases first, setup and helpers below. JVM exercise tests keep `@Tag("Exercise")`.

Similar code
- Existing tests "group checkout initiated concurrently is initiated once" (pattern for check-in) and "charges recorded concurrently all count towards balance" (pattern for payments), with their `inParallel` / `InParallel` / `Promise.all` helpers.
- The 04 module test layout in each repository.

Blocked by
Step 3.

Acceptance criteria
- 5.1 GIVEN the group checkout concurrency tests WHEN read THEN there is: the same group checkout initiated several times at once is initiated once; all guest completions recorded at once complete the group checkout; the completions and one failure recorded at once fail the group checkout.
- 5.2 GIVEN the guest stay account concurrency tests WHEN read THEN there is: the same guest stay checked in several times at once is checked in once; charges recorded at once all count towards the balance; payments recorded at once all count towards the balance; a charge recorded at the same time as a checkout doesn't let an unsettled guest check out.
- 5.3 GIVEN no guest stay account with id A WHEN the same `CheckInGuest` is sent five times at once THEN exactly one `GuestCheckedIn` is published.
- 5.4 GIVEN a checked-in guest stay account with one charge for the sum of five amounts WHEN five payments with different payment ids and those amounts are recorded at once, and then the guest is checked out THEN `GuestCheckedOut` is published.
- 5.5 GIVEN the two new tests WHEN run against the 05 exercise THEN they fail, and against both 05 solutions THEN they pass.
- 5.6 GIVEN the same concurrency test in two repositories WHEN compared THEN it has the same name (apart from casing and language convention), sits in the same module, and has the same steps and expected messages.
- 5.7 GIVEN the five existing concurrency tests WHEN compared before and after THEN their steps and expected messages are the same.
- 7.1 GIVEN a 05 exercise or solution in any repository and flavour WHEN listed THEN the variant folder has the business process tests and the bus-delivers-twice test; the group checkouts module has its entity definition, idempotency and concurrency tests; the guest stay accounts module has its entity definition, idempotency and concurrency tests.
- 7.2 GIVEN any 05 test file WHEN read THEN the test cases come first, setup and helpers below them.
- 7.3 GIVEN a JVM 05 exercise test WHEN read THEN it has the exercise marker, as in 04.
- 8.1 GIVEN the 05 message bus in any repository WHEN it delivers a message THEN it calls the handlers one after another, as today, with no option to call them in parallel.

Tests
- 5.3: "guest checked in concurrently is checked in once" (JVM `guestCheckedInConcurrently_IsCheckedInOnce`, .NET `GuestCheckedInConcurrently_IsCheckedInOnce`) - asserts exactly one `GuestCheckedIn(A, now)` after five parallel `CheckInGuest(A)`.
- 5.4: "payments recorded concurrently all count towards balance" (JVM `paymentsRecordedConcurrently_AllCountTowardsBalance`, .NET `PaymentsRecordedConcurrently_AllCountTowardsBalance`, Node.js "payments recorded concurrently all count towards balance") - check in, record one charge for 150 (10+20+30+40+50), record five payments with different ids at once, reset the catcher, check out - asserts the single message `GuestCheckedOut(A, now, no group checkout id)`.
- 5.5: run both new tests against the 05 exercise (fail) and solution (pass).
- 5.1, 5.2, 5.6, 5.7: list and diff the concurrency tests - seven per flavour, same names and steps in all three repositories, the five existing ones unchanged.
- 7.1, 7.2, 7.3: list the 05 test files - layout as stated; read files - cases first; JVM exercise tests of the domain code tagged (the `core/` tools tests added in step 6 are plumbing and untagged, Q56).
- 8.1: read the 05 buses - handlers called one after another, no parallel option.
- extra: the check-in test also fails in the exercise only through duplicates (not an exception escaping) - assert no exception reaches the test in the solution.
- Breaks: the variant-root `OptimisticConcurrencyTests` files in JVM and .NET (split into the modules).
```

---

## Step 5. One rule for a missing entity from 02 to 05

```text
Use the `implement-step` skill.

What to build
In all three repositories, 02 to 05, exercises and solutions (the JVM 03 Kafka, RabbitMQ and transactions solutions included): a facade method called directly throws "Entity not found" for a missing guest stay account (record charge, record payment, and check out in 02); a facade method triggered by the bus does nothing for a missing guest stay account or group checkout (check out, record guest completion, record guest failure in 03–05). Node.js immutable entities stop loading a missing account as `initial` for anything but check-in. The 02 exercise skeletons check for a missing account in record charge, record payment and check out before the TODO, as JVM's do. New tests in every guest stay entity definition suite. The 05 solution keeps its concurrency handling.

Context
- Node.js `?? initial` for charge/payment: `solved/02_entities_definition/regular/solution2_immutableEntities/guestStayFacade.ts` (also checkout, line ~90), `03_business_processes/regular/solution2_immutableEntities/guestStayAccounts/guestStayAccountFacade.ts`, `solved/03_business_processes/regular/solution1_sagas/solution2_immutableEntities/...`, `solution3_choreography/...`, `solution4_todo_list/...`, `04_idempotency` and `solved/04_idempotency` immutable, `05` exercise and solution immutable.
- 02 skeletons: Node.js `02_entities_definition/{regular,emmett}/guestStayFacade.ts` and .NET `02-EntitiesDefinition/GuestStayFacade.cs` check only in record charge; JVM `exercises/.../e02_entities_definition/GuestStayFacade.java` checks in all three.
- JVM `solved/.../e03_businessprocesses/sagas_kafka/solution{1,2}/...` and `sagas_rabbitmq/solution{1,2}/...`: `checkOutGuest`, `recordGuestCheckoutCompletion`, `recordGuestCheckoutFailure` throw "Entity not found"; change them to return.
- JVM 03 transactions: guest stay facade methods keep throwing (called directly). Its `initiateGroupCheckout` is step 6.
- 06 is out of scope.

Similar code
- 04 solution bus-triggered methods (`if (!account) return` / `orElse(null)` + guard / null guard) and JVM/.NET "Entity not found" throws.
- Existing guest stay entity definition tests in each suite for naming and setup.

Blocked by
Step 3 (05 is the 04 solution), step 1 (Node.js async tests).

Acceptance criteria
- 12.1 GIVEN any guest stay facade from 02 to 05, any repository and flavour, exercise or solution (the JVM 03 Kafka, RabbitMQ and transactions solutions included), and no guest stay account A WHEN a charge or a payment is recorded for A THEN "Entity not found" is thrown and nothing is published (in Node.js immutable entities today: "Guest account is already checked out!"); GIVEN the same facade in a solution or in code an exercise gives (not the 02 skeleton, where check-in is the attendee's TODO) WHEN A is checked in THEN `GuestCheckedIn` is published.
- 12.2 GIVEN any 02 guest stay facade, any repository and flavour, exercise skeleton or solution, and no guest stay account A WHEN A is checked out THEN "Entity not found" is thrown and nothing is published (in the Node.js 02 immutable solution today: `GuestCheckoutFailed`); GIVEN the 02 exercise skeletons WHEN read THEN record charge, record payment and check out each load the account and throw "Entity not found" for a missing one before the TODO, in all three repositories.
- 12.3 GIVEN any 03–05 solution or 04–05 exercise, any repository and flavour (the JVM 03 Kafka and RabbitMQ solutions included), and no guest stay account A WHEN `CheckOutGuest` for A arrives from the bus THEN nothing is published and no error is thrown; GIVEN no group checkout X WHEN a guest checkout completion or failure for X arrives from the bus THEN nothing is published and no error is thrown. GIVEN the JVM 03 transactions solution and no guest stay account A WHEN A is checked out through the guest stay facade THEN "Entity not found" is thrown; WHEN a group checkout including A is initiated THEN "Entity not found" is thrown.
- 12.4 GIVEN the guest stay entity definition tests of any 02–05 exercise or solution, any repository and flavour (the JVM 03 Kafka, RabbitMQ and transactions solutions included) WHEN read THEN they include "recording a charge for a missing guest stay account fails with Entity not found" and the same for a payment, and in 02 also for a checkout; each test has the same name (apart from casing and language convention) and steps in all three repositories.
- 12.5 GIVEN a 05 exercise or solution, any repository and flavour, and no guest stay account A WHEN a charge or payment is recorded for A THEN "Entity not found" is thrown and nothing is published, as in 04 (Q47, Q48).

Tests
- 12.1, 12.4, 12.5: "recording a charge for a missing guest stay account fails with Entity not found" and "recording a payment for a missing guest stay account fails with Entity not found" in every guest stay entity definition suite of 02–05 (exercise and solution, both flavours, all three repositories, JVM Kafka, RabbitMQ and transactions included) - assert the error message "Entity not found" and no published message. In JVM, .NET and the Node.js aggregates these tests protect existing behaviour (they pass before the change); in Node.js immutable entities and the .NET and Node.js 02 skeletons they fail first.
- 12.1 (check-in): existing check-in entity definition tests - `GuestCheckedIn` still published for a new account.
- 12.2: "checking out a missing guest stay account fails with Entity not found" in every 02 guest stay suite - asserts the error and no message; read the 02 skeletons - the check in all three methods before the TODO.
- 12.3: (no test, as decided in 04 and Q50) read the 03–05 bus-triggered methods and JVM Kafka/RabbitMQ facades - they return without publishing. The JVM 03 transactions clause of 12.3 (`initiateGroupCheckout` throws "Entity not found") is built and tested in step 6 with 13.1; the guest stay checkout clause is checked here.
- extra: in Node.js immutable 05, a charge for a missing account inside the retry throws "Entity not found" once (no retry on a non-conflict error) - covered by the new 05 test.
- Breaks: none expected; the Node.js 02 immutable solution's behaviour for checkout of a missing account changes (no test covers it today).
```

---

## Step 6. The JVM 03 transactions solution and `Database.transaction` just work

```text
Use the `implement-step` skill.

What to build
In JVM, `Database.transaction` (solved 03, exercise and solved 04 and 05) applies all of a transaction's changes or none, makes them visible to every collection after the commit (also one created before), doesn't lose changes when two transactions run at the same time, respects expected versions in 05, and prints nothing on a throw; its signature stays as in 03 and the comment "Do nothing, discard transactional changes" stays. How it's built is the implementer's. The 03 transactions solution's `initiateGroupCheckout` throws "Entity not found" for a missing guest stay account and stores each checked-out account under its own id.

Context
- `solved/.../e03_businessprocesses/core/Database.java` `transaction(Consumer<Database>)` copies all per-class maps, swaps `this.storage` on commit (collections built earlier keep the old maps) and `System.out.println`s the error. Same code in `exercises/` and `solved/` `e04_idempotency/core/Database.java`; after step 3 also in both 05 copies, with versions.
- `solved/.../e03_businessprocesses/transactions/groupcheckouts/GroupCheckoutFacade.java` `initiateGroupCheckout`: `guestStayAccounts.get(id).orElseThrow()` (bare `NoSuchElementException`) and `guestStayAccounts.store(command.groupCheckoutId(), ...)` (bug).
- Exercise and solved copies of 04 and 05 tools stay identical.

Similar code
- Existing JVM core tests in solved e03 (for example `MessageRouterTest`) for placing tests in `core/`; the `inParallel` helper of the JVM 05 concurrency tests for running on threads.
- `transactions/gueststayaccounts/EntityDefinitionTests.java` for the new `transactions/groupcheckouts/EntityDefinitionTests.java`.

Blocked by
Step 3 (05 tools carry `transaction`), step 5 (transactions guest stay tests exist).

Acceptance criteria
- 13.1 GIVEN the JVM 03 transactions solution and checked-in guest stay accounts A and B with settled balances AND a group checkout for A and B initiated WHEN A is checked out again through the guest stay facade THEN `GuestCheckoutFailed(A, INVALID_STATE, now, no group checkout id)` is published (today `GuestCheckedOut`, because A is stored under the group checkout id and the guest stay facade's collection doesn't see the commit; both the id fix and the transaction fix are needed) (Q51, Q52).
- 13.2 GIVEN a JVM `Database` with `transaction` (solved 03, exercise and solved 04 and 05) and a collection created before the transaction WHEN a transaction stores document D and returns THEN the collection returns D; WHEN a transaction stores D and then throws THEN the collection doesn't return D, the exception reaches the caller and nothing is printed; GIVEN D stored WHEN a transaction deletes D and commits THEN the collection doesn't return D; GIVEN document X stored WHEN two transactions are open at the same time, T1 changes X and T2 stores a new document Y without reading X, and T1 commits before T2 THEN both commit and the collection returns T1's X and Y; WHEN instead T2 reads X before T1 commits and stores Y THEN T2's commit fails with `ConcurrencyException`, the collection returns T1's X and doesn't return Y; WHEN instead T2 stores X without reading it, T1 commits its change to X, then T2 commits THEN T2's commit fails with `ConcurrencyException` and the collection returns T1's X; GIVEN X stored WHEN a transaction reads X, X is stored again outside any transaction, and the transaction then commits a change THEN the commit fails with `ConcurrencyException` and applies nothing; in 05, GIVEN D stored at version 1 WHEN a transaction stores a new document E and D with expected version 1, and D is stored again (as D') before the transaction commits THEN the transaction fails with `ConcurrencyException`, the collection returns D' at version 2 and doesn't return E; GIVEN D already at version 2 WHEN a transaction, without reading D, stores D with expected version 1 THEN the commit fails with `ConcurrencyException` and applies nothing (Q52–Q54, Q58).
- 13.3 GIVEN the JVM 03 transactions solution's tests WHEN listed THEN the two group checkout tests are in `transactions/groupcheckouts/EntityDefinitionTests.java`, and the `Database` tests are next to each `Database` with `transaction` (solved 03, exercise and solved 04 and 05); the exercise and solved 04 tools stay identical, and the exercise and solved 05 tools are identical apart from the solved retry helper.

Tests
- 13.1: "initiating a group checkout stores each guest stay account under its own id" in `transactions/groupcheckouts/EntityDefinitionTests.java` - check in A and B, settle, initiate the group checkout, reset the catcher, check A out through the guest stay facade - asserts the single message `GuestCheckoutFailed(A, INVALID_STATE, now, null)`.
- 12.3 (transactions clause, from step 5): "initiating a group checkout with a missing guest stay account fails with Entity not found" in the same file - check in guest stay A only, initiate a group checkout for A and a never-checked-in B - asserts the "Entity not found" error.
- 13.2: in `core/` next to each `Database` with `transaction` (solved 03, exercise and solved 04 and 05), without the exercise tag (Q56: domain code and its tests are for attendees, tools are hidden plumbing): "a committed transaction's changes are visible through a collection created before it" - asserts the collection returns D; "a transaction that throws applies nothing" - asserts D absent and the exception reaches the caller; "two transactions at the same time keep each other's changes, also to a document both saw" - X stored as "original"; T1 and T2 each run on their own thread; T2 opens and signals it is open (latch 1); T1 waits for that, changes X to "from T1" and commits, and signals it has committed (latch 2); T2 waits for that, stores a new document Y and commits; every latch wait has a timeout so a hang fails the test - asserts, through a collection created after both commits, that X is "from T1" and Y exists (fails every time with today's copy-and-swap and with any write-back of a whole copy, passes every time with the fix); in 05 "a transaction whose expected version no longer matches fails and applies none of its changes" - D at version 1; the transaction stores a new document E and D with expected version 1; before it commits, D is stored again as D' outside it, from another thread the transaction waits for (latch with a timeout) - asserts `ConcurrencyException`, D' at version 2, E absent.
- 13.3: list the files - locations as stated; diff exercise vs solved 04 and 05 tools - identical.
- extra: the existing 03 transactions business process tests still pass and print nothing.
- Breaks: none expected.
```

---

## Step 7. 05 README and full verification

```text
Use the `implement-step` skill.

What to build
The 05 README in each repository says in one short paragraph where the tests are and links every test file for each variant, as the 04 README does; the Node.js 05 README no longer says the database or facades become asynchronous in 05 and says the database now versions documents. Then every suite runs green (exercises fail only where expected), with no new warnings, and 06 is unchanged.

Context
- `05_optimistic_concurrency/README.md` (Node.js; lines with "is now asynchronous, like a real one" and "now with asynchronous facades"), .NET `05-OptimisticConcurrency/README.md`, JVM `exercises/.../e05_optimistic_concurrency/README.md`.
- Verification commands: JVM `./gradlew test --rerun` in `solved` and compile `exercises`; .NET `dotnet test --solution` for the workshop; Node.js `npm run test:solved`, `npm run build:ts`, `npm run lint`, and `npm test` for the exercise failure list.

Similar code
- The 04 READMEs in each repository ("## Tests" section).

Blocked by
Steps 1–6.

Acceptance criteria
- 10.1 GIVEN the 05 README in any repository WHEN read THEN one short paragraph says the business process and bus-delivers-twice tests are in the variant folder and the module tests sit next to the module's code, and it links each test file for each variant.
- 10.2 GIVEN any link in it WHEN followed THEN it opens an existing file.
- 10.3 GIVEN the Node.js 05 README WHEN read THEN it no longer says that the database or the facades become asynchronous in 05 (today: "is now asynchronous, like a real one" and "now with asynchronous facades"); it says the database now versions documents.
- 11.1 GIVEN JVM WHEN the solved tests run without cache THEN all pass, and the exercises compile.
- 11.2 GIVEN .NET WHEN all tests run THEN every solution project passes, and the only failures are exercise tests expected to fail.
- 11.3 GIVEN Node.js WHEN the solved tests, type check and lint run THEN they pass.
- 11.4 GIVEN any test run WHEN its output is read THEN it has no new warnings.
- 11.6 GIVEN exercise 06 in any repository WHEN compared before and after THEN it is unchanged.

Tests
- 10.1, 10.3: read the three 05 READMEs.
- 10.2: check every link resolves to an existing file (script over the Markdown links).
- 11.1–11.3: run the commands above - all solution suites pass; exercise failures are the expected ones (05: the concurrency tests).
- 11.4: compare the test and build output with the warning baseline recorded in step 1 - no new warnings.
- 11.6: `git diff --stat` shows no 06 path in any repository.
- Breaks: none.
```

---

## Step 8. The JVM `Database.transaction` behaves like serializable isolation

```text
Use the `implement-step` skill.

What to build
In JVM, `Database.transaction` (solved 03, exercise and solved 04 and 05) behaves like serializable isolation: transactions end up as if they ran one after another. Inside a transaction, its reads and writes are recorded and nothing reaches the stored data; at commit, if a document it read or wrote was changed by another commit since it first read or wrote it, the commit fails with `ConcurrencyException` and applies nothing; otherwise all writes apply together and every collection sees them. In 05 expected versions are checked at commit the same way. A throw in the work applies nothing and prints nothing. The storage is never copied, and the transaction is its own named object (no `Database` marked by a `null` field). 03 and 04 get `ConcurrencyException`, used only by the transaction. The 03 transactions solution keeps working.

Context
- Step 6 rewrote `transaction` in `e03_businessprocesses/core/Database.java` (solved), `e04_idempotency/core/Database.java` (exercises, solved) and `e05_optimistic_concurrency/core/Database.java` (exercises, solved): it copies the storage at start and again at commit as a backup, replays recorded changes, and marks the non-transactional `Database` with a `null` `transactionChanges` field. Replace that with the behaviour above.
- `core/DatabaseTest.java` next to each of those five `Database` files (step 6) - extend it.
- 05 already has `core/ConcurrencyException.java`; add the same class to the 03 and 04 `core/` (exercise and solved where the `Database` has `transaction`). Exercise and solved copies of 04 and 05 tools stay identical apart from the solved retry helper.
- Signature stays `transaction(Consumer<Database>)`; the comment "Do nothing, discard transactional changes" stays.

Similar code
- The step 6 `DatabaseTest` files and the 05 `ConcurrencyException`.
- The `inParallel` helper of the JVM 05 concurrency tests for threads.

Blocked by
None (steps 1-7 are done). Step 6 listed 13.2 and 13.3 for the earlier behaviour; spec r13 changed 13.2 (serializable isolation, Q58), so this step builds and tests the changed criteria.

Acceptance criteria
- 13.2 GIVEN a JVM `Database` with `transaction` (solved 03, exercise and solved 04 and 05) and a collection created before the transaction WHEN a transaction stores document D and returns THEN the collection returns D; WHEN a transaction stores D and then throws THEN the collection doesn't return D, the exception reaches the caller and nothing is printed; GIVEN D stored WHEN a transaction deletes D and commits THEN the collection doesn't return D; GIVEN document X stored WHEN two transactions are open at the same time, T1 changes X and T2 stores a new document Y without reading X, and T1 commits before T2 THEN both commit and the collection returns T1's X and Y; WHEN instead T2 reads X before T1 commits and stores Y THEN T2's commit fails with `ConcurrencyException`, the collection returns T1's X and doesn't return Y; WHEN instead T2 stores X without reading it, T1 commits its change to X, then T2 commits THEN T2's commit fails with `ConcurrencyException` and the collection returns T1's X; GIVEN X stored WHEN a transaction reads X, X is stored again outside any transaction, and the transaction then commits a change THEN the commit fails with `ConcurrencyException` and applies nothing; in 05, GIVEN D stored at version 1 WHEN a transaction stores a new document E and D with expected version 1, and D is stored again (as D') before the transaction commits THEN the transaction fails with `ConcurrencyException`, the collection returns D' at version 2 and doesn't return E; GIVEN D already at version 2 WHEN a transaction, without reading D, stores D with expected version 1 THEN the commit fails with `ConcurrencyException` and applies nothing (Q52–Q54, Q58).
- 13.3 GIVEN the JVM 03 transactions solution's tests WHEN listed THEN the two group checkout tests are in `transactions/groupcheckouts/EntityDefinitionTests.java`, and the `Database` tests are next to each `Database` with `transaction` (solved 03, exercise and solved 04 and 05); the exercise and solved 04 tools stay identical, and the exercise and solved 05 tools are identical apart from the solved retry helper.

Tests
- Test first: with the step 6 code, only the three conflict tests (read, blind write, plain store between read and commit) fail first; the others protect behaviour step 6 already gives and must stay green through the rewrite.
- 13.2 (visible): "a committed transaction's changes are visible through a collection created before it" - collection created first, transaction stores D - asserts the collection returns D.
- 13.2 (throw): "a transaction that throws applies nothing and prints nothing" - stores D then throws; `System.out` swapped for a buffer and restored in `finally` - asserts D absent, the exception reaches the caller, the buffer is empty.
- 13.2 (delete): "a document deleted in a transaction is gone after the commit" - D stored, transaction deletes D - asserts the collection doesn't return D.
- 13.2 (different documents): "two transactions at the same time on different documents both commit" - X stored as "original"; T1 and T2 on their own threads; T2 opens (latch 1); T1 changes X to "from T1" and commits (latch 2); T2, without reading X, stores Y and commits; every wait has a timeout - asserts through a collection created after both commits that X is "from T1" and Y exists.
- 13.2 (serializable conflict): "a transaction that read a document another transaction changed and committed fails and applies nothing" - same setup, but T2 reads X before T1 commits, then stores Y - asserts T2's commit throws `ConcurrencyException`, X is "from T1", Y absent.
- 13.2 (blind write): "a transaction that wrote a document another transaction changed and committed fails" - X stored; T2 opens and stores X = "from T2" without reading it (latch 1); T1 changes X to "from T1" and commits (latch 2); T2 commits; timeouts on waits - asserts T2's commit throws `ConcurrencyException` and X is "from T1".
- 13.2 (plain store): "a transaction whose read document was stored again outside it fails" - X stored; the transaction reads X, then (inside its work, through a collection of the outer `Database`) X is stored again, then the transaction stores Y - asserts `ConcurrencyException`, Y absent.
- 13.2 (05 expected version during): "a transaction whose expected version no longer matches fails and applies none of its changes" - D at version 1; the transaction stores E and D with expected version 1; D stored again as D' from another thread before commit (latch with timeout) - asserts `ConcurrencyException`, D' at version 2, E absent.
- 13.2 (05 expected version before): in the same test file, "a transaction storing a document with an outdated expected version fails" - D already at version 2; the transaction, without reading D, stores D with expected version 1 - asserts `ConcurrencyException` and nothing applied.
- 13.3: diff exercise vs solved 04 and 05 `core/` - identical apart from the solved retry helper; the 03 transactions solution tests (step 6) still pass.
- extra: the 03 transactions business process tests and `transactions/groupcheckouts/EntityDefinitionTests.java` pass and print nothing.
- Breaks: none; the step 6 test `twoTransactionsAtTheSameTime_KeepEachOthersChanges` is renamed to "two transactions at the same time on different documents both commit" (T2 never reads X, so it still passes).
```

---

## Step 9. JVM and .NET immutable entities mark a missing entity with a "not existing" status

```text
Use the `implement-step` skill.

What to build
In JVM and .NET, the immutable entities (guest stay account and group checkout) in every exercise and solution from 02 to 05 where an initial state exists have a "not existing" status, as Node.js has `status: 'NotExisting'`; the initial state carries it, so the code that gets it can detect a missing entity (read in step 10). Deciders and facades stay as they are (Q64). Behaviour doesn't change.

Context
- JVM: every `GuestStayAccount.INITIAL` and `GroupCheckout.INITIAL` (`null` id and status) outside 06: e03 `sagas/solution2_immutableentities`, `choreography`, `todolist`, `transactions`, `sagas_kafka/solution2_immutableentities`, `sagas_rabbitmq/solution2_immutableentities` (solved) and the e03 exercise's given code, e04 and e05 exercises and solved; and the 02 immutable solution if it has an initial state (search `INITIAL`).
- .NET: every `GuestStayAccount.Initial` (status 0, undefined) and `GroupCheckOut.Initial` (status `Initiated`) outside 06: 02 solution, `Solutions/03` (`Sagas`, `Choreography`, `ProcessManagers`, `ToDoList`) and the 03 exercise, 04 and 05 exercises and solutions (search `Initial`).
- Node.js already has it (`status: 'NotExisting'`); don't change Node.js.
- 06 is out of scope.

Similar code
- Node.js immutable `guestStayAccount.ts` / `groupCheckout.ts` (`initial` with `status: 'NotExisting'`) and their `decide`/`evolve`.

Blocked by
None.

Acceptance criteria
- 17.1 GIVEN the JVM and .NET immutable entities (guest stay account and group checkout) in every exercise and solution from 02 to 05 where an initial state exists WHEN read THEN their status has a "not existing" value, as the Node.js `status: 'NotExisting'`, the initial state (JVM `INITIAL`, .NET `Initial`) carries it, so the code that gets the initial state (the function a facade passes to the command handler, and the private helper of the "retry in the facade" solution) detects a missing entity by that status and then behaves idempotently (a command from the bus: no events; check-in and initiation: create) or throws "Entity not found" (a method not triggered by the bus); the deciders and the 04 duplicate checks stay where they are, and the existing tests pass as before (Q63, Q64).

Tests
- 17.1: in every changed solution the existing entity definition, idempotency and business process tests pass unchanged; in every changed exercise the same tests pass and fail as before (record the JVM exercise test results, the .NET exercise failures and the Node.js exercise failures before the change and compare); the step 5 missing-account tests ("recording a charge for a missing guest stay account fails with Entity not found", payment) still pass - asserts the status change keeps behaviour.
- extra: read each initial state - it carries the "not existing" status; deciders and facades are otherwise unchanged (Q64); the status is read in step 10.
- Breaks: none expected.
```

---

## Step 10. Two 05 solutions: retry in the facade, and retry in the infrastructure

```text
Use the `implement-step` skill.

What to build
In all three repositories and both flavours, the 05 solution becomes two solutions with the shared tools at the 05 root: "retry in the facade" (today's solution, each facade with one private helper that every method calls, check-in and initiation included) and "retry in the infrastructure" (an aggregate store for aggregates and a command handler for immutable entities, in that folder's own `core/`, doing load, run, store with the loaded version and retry; the facades pass the business logic as a function and publish the returned events). In both, the function gets the initial state (immutable entities, with its "not existing" status) or nothing stored (aggregates) for a missing entity and applies the missing-entity rule; nothing is stored when there are no events; the conflict is thrown after the 10th attempt. Both solutions have the full set of 05 tests. The 05 exercise doesn't change.

Context
- Today: JVM `solved/.../e05_optimistic_concurrency/solution{1_aggregates,2_immutableentities}`, .NET `Solutions/05-OptimisticConcurrency/Version{1-Aggregates,2-ImmutableEntities}`, Node.js `solved/05_optimistic_concurrency/regular/solution{1_aggregates,2_immutableEntities}`; shared tools in `core/` / `Core/` / `tools/`. Some facades use a private `handle` helper (JVM, .NET group checkout), others write the retry out; check-in and checkout sit outside the helper in JVM.
- New layout (15.1): JVM `e05_optimistic_concurrency/retry_in_facade/{solution1_aggregates, solution2_immutableentities}` and `retry_in_infrastructure/{core, solution1_aggregates, solution2_immutableentities}`; .NET `Solutions/05-OptimisticConcurrency/RetryInFacade/{Version1-Aggregates, Version2-ImmutableEntities}` and `RetryInInfrastructure/{Core, ...}`; Node.js `solved/05_optimistic_concurrency/regular/solution1_retry_in_facade/{solution1_aggregates, solution2_immutableEntities}` and `solution2_retry_in_infrastructure/{core, ...}`.
- Tests: copy the 05 tests (business process, entity definition, idempotency, seven concurrency) into each solution's variant folders, keeping the module layout.
- Update the 05 README links if they point at solved paths (they shouldn't; 10.5 was dropped).

Similar code
- Emmett's `CommandHandler` (`@event-driven-io/emmett`, in the workshop's node_modules) for the command handler shape and "no events, no append".
- 03 sagas layout (one folder per solution, both flavours inside) in each repository.
- The current 05 solution facades and `Retry` helpers.

Blocked by
Step 9 (initial states carry "not existing"). Step 3 listed 2.3 and 4.1–4.4 for the single 05 solution; spec r13–r15 changed them for two solutions (Q57–Q62), so this step covers them for both.

Acceptance criteria
- 15.1 GIVEN the 05 solutions in any repository WHEN listed THEN there are two solution folders, each with both flavours, and the shared tools at the 05 root; the "retry in the infrastructure" folder also has its own `core/`, used by both its flavours, holding the aggregate store and the command handler (Q62): JVM `e05_optimistic_concurrency/retry_in_facade/{solution1_aggregates, solution2_immutableentities}` and `retry_in_infrastructure/...`; .NET `Solutions/05-OptimisticConcurrency/RetryInFacade/{Version1-Aggregates, Version2-ImmutableEntities}` and `RetryInInfrastructure/...`; Node.js `solved/05_optimistic_concurrency/regular/solution1_retry_in_facade/{solution1_aggregates, solution2_immutableEntities}` and `solution2_retry_in_infrastructure/...`; the 05 exercise keeps its layout (Q59).
- 15.2 GIVEN a facade of the "retry in the facade" solution WHEN read THEN it has one private helper that, inside the retry, loads the entity, calls the facade method's function with it (aggregates: the aggregate or nothing stored, JVM empty `Optional`, .NET and Node.js `null`; immutable entities: the state or the decider's initial state), stores the result with the loaded version (0 when nothing was stored) only when there are events, and publishes the events of the successful attempt; every facade method, check-in and initiation included, calls it (Q60, Q62).
- 15.3 GIVEN the "retry in the infrastructure" solution, immutable entities, WHEN a facade method runs THEN it calls a command handler with the entity id and a function from state to events; the command handler loads the state, or passes the decider's initial state (JVM `INITIAL`, .NET `Initial`, Node.js `initial`) when nothing is stored, calls the function, and when there are events evolves the state, stores it with the loaded version or 0, retrying on a conflict up to 10 attempts and throwing the conflict after the 10th, as the facade solution does (4.2); with no events it stores nothing; it returns the events, which the facade publishes (Q61, Q62).
- 15.4 GIVEN the "retry in the infrastructure" solution, aggregates, WHEN a facade method runs THEN it calls an aggregate store with the id and a function that gets the loaded aggregate or nothing stored (JVM empty `Optional`, .NET and Node.js `null`) and returns the aggregate to store, or nothing; the aggregate store calls it, and when there is an aggregate with events dequeues them and stores it with the loaded version (0 when nothing was stored), retrying on a conflict up to 10 attempts and throwing the conflict after the 10th (4.2); it returns the events, which the facade publishes. Check-in and initiation create the aggregate when nothing is stored and return nothing when it exists; when two check-ins of the same account run at once, the one that loses the conflict retries, finds the account and returns nothing, so `GuestCheckedIn` is published once (Q61, Q62).
- 15.5 GIVEN either solution WHEN nothing is stored for the id (immutable entities: the function gets the initial state) THEN the facade's function applies the missing-entity rule (group 12): check-in and initiation create, charge and payment throw "Entity not found", bus commands produce no events; the aggregate store and command handler only load, store and retry (Q61, Q62).
- 15.6 GIVEN both 05 solutions, any repository and flavour, WHEN their tests run THEN each has the full set of 05 tests (business process, entity definition, idempotency, the seven concurrency tests), the same in both, and all pass, on repeated runs.
- 15.8 GIVEN the aggregate store and the command handler of the "retry in the infrastructure" solution in any repository WHEN their own tests run (in that solution's `core/`, next to them, like the JVM `Database` tests) THEN they show, the same in all three repositories: a conflict is retried and the next attempt's events are returned; after the 10th conflict the conflict is thrown; when the function returns no events nothing is stored and the version stays; a missing entity reaches the function as the initial state (command handler) or as nothing stored (aggregate store) (Q65).
- 2.3 GIVEN a 05 exercise and either of its 05 solutions WHEN compared THEN the shared tools differ only by the retry helper; the "retry in the facade" module code differs only by the expected versions and the retry; the "retry in the infrastructure" solution adds the aggregate store or command handler in its own `core/` and its facades call it (group 15).
- 4.1 GIVEN a 05 solution WHEN a facade method stores THEN it passes the version it loaded, and 0 when it creates the document (check-in, initiation).
- 4.2 GIVEN a 05 solution and a store that fails with a conflict WHEN the facade method retries THEN it loads the current state, decides again and stores again, up to 10 attempts in total; after the 10th failed attempt the conflict is thrown.
- 4.3 GIVEN a 05 solution WHEN a facade method succeeds after one or more conflicts THEN only the events of the successful attempt are published, once, after the retry.
- 4.4 GIVEN a 05 solution and a missing group checkout or guest stay account found inside the retry of record guest completion, record guest failure or check out guest WHEN the attempt runs THEN it ends with no events and the facade method publishes nothing; for record charge and record payment the attempt throws "Entity not found", as in 04 (Q47).

Tests
- 15.1: list the folders in each repository - layout as stated; the 05 exercise unchanged (git diff of the exercise folders shows nothing from this step).
- 15.2, 15.5: the full 05 test set in "retry in the facade" passes three times; the step 5 missing-account tests pass (charge/payment "Entity not found"); read the helper - one per facade, called by every method.
- 15.3, 15.4, 15.5: the full 05 test set in "retry in the infrastructure" passes three times, including the seven concurrency tests (they hit conflicts through the facades and need the store/handler's retry) and the check-in concurrency test (5.3: two check-ins at once publish `GuestCheckedIn` once).
- 15.3 (no events): "recording a guest checkout completion for a missing group checkout stores nothing" is not added (no test for bus commands on a missing entity, Q50); read the handler - it skips the store when there are no events.
- 15.6: the same test files in both solutions, all pass.
- 15.8: in each repository's `retry_in_infrastructure/core/` (JVM, .NET already have 12 each; add the same in Node.js): "a conflict is retried and the next attempt's events are returned", "after the 10th conflict the conflict is thrown", "no events stores nothing and keeps the version", "a missing entity reaches the function as the initial state / as nothing stored" - for both the aggregate store and the command handler; same names (apart from casing) and steps in all three.
- 2.3: diff exercise vs each solution - only the stated differences.
- 4.1–4.4: as in step 3, now for "retry in the facade"; the infrastructure solution's store/handler gives the same results through the same tests.
- Breaks: every 05 solved test path (moved into the two solution folders); update imports/namespaces/packages.
```

---

## Step 11. JVM Kafka and RabbitMQ tests print no warning; Node.js 05 README note

```text
Use the `implement-step` skill.

What to build
The JVM 03 Kafka and RabbitMQ `MessageMetadataPropagationTest` expects every message the process publishes, so the run prints no "WARNING: Unexpected message type found". The Node.js 05 README Notes include "2. Settled means SUM(Charges) - SUM(Payments) === 0", as .NET and JVM have.

Context
- `solved/.../e03_businessprocesses/sagas_kafka/core/MessageMetadataPropagationTest.java` and `sagas_rabbitmq/core/MessageMetadataPropagationTest.java`: `publishedMessages.shouldReceiveMessages(List.of(...))` lists only the first messages; the catcher (`core/MessageCatcher.java`, unchanged) prints the warning for `RecordGuestCheckoutCompletion`, `GuestCheckoutCompletionRecorded`, `GroupCheckoutCompleted`.
- `workshops/event_driven_architecture/src/05_optimistic_concurrency/README.md` Notes; compare with the .NET and JVM 05 READMEs.

Similar code
- The JVM 03 saga business process tests' full expected message lists.

Blocked by
None.

Acceptance criteria
- 16.1 GIVEN the JVM 03 Kafka and RabbitMQ `MessageMetadataPropagationTest` WHEN it runs THEN its expected messages list every message the process publishes (including `RecordGuestCheckoutCompletion`, `GuestCheckoutCompletionRecorded` and `GroupCheckoutCompleted`), it passes, and the output has no "WARNING: Unexpected message type found" line.
- 18.1 GIVEN the Node.js 05 README WHEN its Notes are read THEN they include "2. Settled means SUM(Charges) - SUM(Payments) === 0", as the .NET and JVM 05 READMEs do (Q58).

Tests
- 16.1: run the Kafka and RabbitMQ `MessageMetadataPropagationTest` (Testcontainers/Docker) - passes; grep its output for "Unexpected message type" - none.
- 18.1: read the Node.js 05 README Notes - the line is there, worded as in .NET and JVM.
- Breaks: none.
```

---

## Step 12. Full verification after the post-run changes

```text
Use the `implement-step` skill.

What to build
Every suite runs green again after steps 8-11 (exercises fail only where expected), with no new warnings compared with the baseline in progress.md, and 06 unchanged. Step 7 checked these criteria before steps 8-11; this step checks them again for the final state.

Context
- Commands: JVM `./gradlew test --rerun` in `solved` and `compileTestJava --rerun` in `exercises`; .NET `dotnet build` and `dotnet test --solution` for `EventDrivenArchitecture.slnx`; Node.js `npm run test:solved`, `npm run build:ts`, `npm run lint`.
- Warning baseline: progress.md (Node.js none; .NET 0; JVM only the Gradle deprecation notice).

Similar code
- Step 7's verification notes in progress.md.

Blocked by
Steps 8-11.

Acceptance criteria
- 11.1 GIVEN JVM WHEN the solved tests run without cache THEN all pass, and the exercises compile.
- 11.2 GIVEN .NET WHEN all tests run THEN every solution project passes, and the only failures are exercise tests expected to fail.
- 11.3 GIVEN Node.js WHEN the solved tests, type check and lint run THEN they pass.
- 11.4 GIVEN any test run WHEN its output is read THEN it has no new warnings.
- 11.6 GIVEN exercise 06 in any repository WHEN compared before and after THEN it is unchanged.

Tests
- 11.1–11.3: run the commands - all solution suites pass; run the JVM exercise tests (`./gradlew test --rerun` in `exercises`), the .NET exercise projects and the Node.js exercises (`npm test`) - the pass and fail lists match the lists recorded in step 9 (in 05 only the 14 concurrency tests fail).
- 11.4: compare outputs with the baseline - no new warnings, and no "Unexpected message type" line.
- 11.6: `git diff --stat` shows no 06 path in any repository.
- Breaks: none.
```

---

## Step 13. Fixes after the second run

```text
Use the `implement-step` skill.

What to build
The JVM `Database.transaction` is fully serializable: a document deleted and stored again in between is a conflict, `findAll` inside a transaction conflicts with documents of that type added, removed or changed by others, and a transaction started inside another joins it. The .NET immutable group checkout record defaults to the "not existing" status, like `Initial`. Every facade of both 05 solutions, in all three repositories, publishes nothing when there are no events. The JVM build files stop attaching the unused Mockito agent, so the test run prints no class-sharing warning.

Context
- JVM `Database.java` and `DatabaseTest.java` in solved e03 and exercise and solved e04 and e05 (`core/`), with the private `Transaction` class from step 8; the open findings in `reviews/20261120T070000_step8_review.md` (Step-2, Step-3, Step-4).
- .NET `GroupCheckOut` records in 02–05 immutable entities (default `Status = CheckoutStatus.Initiated`); `reviews/20261120T080000_step9_review.md` Step-3.
- 05 solution facades: .NET aggregate facades publish an empty list (`reviews/20261120T110000_step10_review.md` Step-2); check every facade of both solutions in all three repositories.
- JVM `solved/build.gradle` and `exercises/build.gradle`: `mockitoAgent(...)` configuration and `jvmArgs += "-javaagent:..."`; no test uses Mockito.

Similar code
- The step 8 `DatabaseTest` tests and their latch setup.
- .NET immutable facades' `if (events.Length == 0) return;`.

Blocked by
None (steps 1-12 are done).

Acceptance criteria
- 19.1 GIVEN a JVM `Database` with `transaction` and document D stored WHEN a transaction reads D, D is deleted and stored again outside the transaction, and the transaction then commits a change THEN the commit fails with `ConcurrencyException` and applies nothing (versions never reset).
- 19.2 GIVEN a JVM `Database` with `transaction` WHEN a transaction reads all documents of a type with `findAll`, another document of that type is stored outside the transaction, and the transaction then commits a change THEN the commit fails with `ConcurrencyException` and applies nothing.
- 19.3 (replaced by 20.4: nested transactions are not supported, Q70 follow-up)
- 19.4 GIVEN the .NET immutable group checkout in every exercise and solution from 02 to 05 WHEN read THEN its record's default status is the same "not existing" status as `Initial`, and its existing tests pass.
- 19.5 GIVEN any facade of either 05 solution in any repository and flavour WHEN its command produces no events THEN it publishes nothing (no publish call with an empty list), the same in every facade.
- 19.6 GIVEN the JVM `solved` and `exercises` build files WHEN read THEN they don't attach the Mockito agent; GIVEN the JVM tests WHEN run THEN they pass as before and the output has no "Sharing is only supported for boot loader classes" line.

Tests
- 19.1: "a transaction whose read document was deleted and stored again fails" - D stored; the transaction reads D; through the outer `Database`, D is deleted and stored again; the transaction stores Y - asserts `ConcurrencyException`, Y absent. Fails first with step 8 code.
- 19.2: "a transaction that read all documents of a type fails when another one is added" - one document of type T stored; the transaction calls `findAll`; through the outer `Database`, another T is stored; the transaction stores Y - asserts `ConcurrencyException`, Y absent. Fails first.
- 19.3: "a transaction started inside a transaction joins it" - the outer transaction stores D1, starts an inner transaction on itself that stores D2, then returns - asserts no exception, D1 and D2 both stored, each once (version 1 in 05). Fails first.
- 19.4: existing .NET entity definition, idempotency and business process tests of the changed variants pass; read the record - default status equals `Initial`'s.
- 19.5: existing tests of both 05 solutions pass; read every facade - no publish call with an empty list.
- 19.6: run JVM `solved` `./gradlew test --rerun` and `exercises` `./gradlew test --rerun` - same pass/fail results as in step 12, and no "Sharing is only supported for boot loader classes" line; the build files have no Mockito agent.
- Breaks: none expected; exercise and solved copies of 04 and 05 tools stay identical apart from the solved retry helper.
```

---

## Step 14. Reliable concurrency tests and a failing nested transaction

```text
Use the `implement-step` skill.

What to build
The 05 concurrency tests start 10 calls at once (5 today), and the charge-racing-checkout test runs its race for 10 guest stays at once, so the exercise fails every time and the solutions pass every time, in all three repositories and both flavours, for the exercise and both solutions. In JVM, an inner transaction that throws records none of its writes.

Context
- Concurrency tests: JVM `exercises/` and `solved/` `e05_optimistic_concurrency/**/{groupcheckouts,gueststayaccounts}/OptimisticConcurrencyTests.java`; .NET `05-OptimisticConcurrency/**/OptimisticConcurrencyTests.cs` and `Solutions/05-OptimisticConcurrency/**`; Node.js `05_optimistic_concurrency/**/optimisticConcurrency.*.test.ts` and `solved/05_optimistic_concurrency/**`. Helpers `inParallel` / `InParallel` / `Promise.all`.
- The retry limit stays 10 attempts; the load delay stays as it is.
- JVM `Database.java` (solved e03, exercise and solved e04, e05), the step 13 nested join (`Transaction.transaction`).

Similar code
- The existing concurrency tests and their helpers.
- The step 13 `DatabaseTest` nested-join test.

Blocked by
None (steps 1-13 are done).

Acceptance criteria
- 20.1 GIVEN the 05 concurrency tests that start several calls at once (initiation, completions, completions with a failure, check-in, charges, payments) in any repository and flavour WHEN read THEN they start 10 calls at once instead of 5, with the same expected messages for 10; the retry limit stays 10 attempts and the load delay stays as it is.
- 20.2 GIVEN the charge-racing-checkout concurrency test in any repository and flavour WHEN it runs THEN it runs the race (one charge and one checkout at once) for 10 checked-in guest stays at once and asserts that none of them is checked out with an unsettled balance.
- 20.3 GIVEN the 05 exercise and both 05 solutions in all three repositories WHEN their concurrency tests run 50 times THEN in the exercise every concurrency test fails in every run, and in the solutions every one passes in every run; the counts before and after the change are written down once (no lasting test).
- 20.4 GIVEN a JVM transaction WHEN its work starts another transaction THEN that fails at once with an exception saying nested transactions are not supported, and if the outer work doesn't catch it nothing is applied; the database doesn't join, nest or partly undo transactions, as most databases don't support nested transactions (Q70 follow-up).
- 21.1 GIVEN `alignment.md` WHEN its 05 section is read THEN it says what 05 teaches, what its tests prove and its model after this work (the 05 exercise is the 04 solution plus the versioned database; two solutions per flavour: retry in the facade and retry in the infrastructure; the seven concurrency tests next to their modules; Node.js asynchronous from 02), and no longer lists gaps this work closed (for example "Node.js copies a loaded document shallowly").
- 11.1 GIVEN JVM WHEN the solved tests run without cache THEN all pass, and the exercises compile.
- 11.2 GIVEN .NET WHEN all tests run THEN every solution project passes, and the only failures are exercise tests expected to fail.
- 11.3 GIVEN Node.js WHEN the solved tests, type check and lint run THEN they pass.
- 11.4 GIVEN any test run WHEN its output is read THEN it has no new warnings.
- 11.6 GIVEN exercise 06 in any repository WHEN compared before and after THEN it is unchanged.

Tests
- before: run the 05 exercise and both solutions' concurrency tests 50 times in each repository (JVM `./gradlew test --rerun --tests '*e05*OptimisticConcurrencyTests'` in `exercises` and `solved`; .NET `dotnet test --project ... --filter OptimisticConcurrency`; Node.js `npx vitest run` on the 05 concurrency files) and write the pass/fail counts per test into progress.md.
- 20.1: the changed tests - 10 calls at once (10 initiations, 10 completions, 9 completions and 1 failure, 10 check-ins, 10 charges, 10 payments), expected messages for 10; the solutions pass.
- 20.2: "a charge recorded at the same time as a checkout doesn't let an unsettled guest check out" - 10 checked-in guest stays, each with one charge and one checkout started together - asserts for each guest that the published messages are either `GuestCheckedOut` alone or `ChargeRecorded` and `GuestCheckoutFailed`.
- 20.3: after the change, the same 50 runs - exercise: every concurrency test fails in every run; solutions: every one passes in every run; counts in progress.md.
- 20.4: "an inner transaction that throws records none of its writes" - the outer transaction stores D1, starts an inner one that stores D2 and throws, catches it, then returns - asserts D1 stored and D2 absent; "an inner transaction that throws uncaught fails the whole transaction" - same without the catch - asserts the exception reaches the caller and neither D1 nor D2 is stored. Next to each `Database` with `transaction`; the first fails with the step 13 code.
- Breaks: the changed concurrency tests (updated in place, same names).
```

---

## Step 15. Concurrency tests start their calls together and read Given/When/Then

```text
Use the `implement-step` skill.

What to build
In JVM and .NET, the 05 concurrency test helpers start all calls together: every call waits at a shared start gate and all are released once the last one is ready, so the calls really overlap and the exercise fails every time. Every 05 concurrency test in all three repositories has clear `// Given`, `// When`, `// Then` comments. Nothing else changes.

Context
- JVM `inParallel(List<Runnable> handlers, Class<? extends Exception> ignoring)` in every `OptimisticConcurrencyTests.java` of e05 (exercises, and solved `retry_in_facade` and `retry_in_infrastructure`, both flavours): today it submits each handler to a virtual-thread executor in a loop, so the first starts before the last is submitted. Wrap each handler so it first awaits a `CyclicBarrier(handlers.size())`.
- .NET `InParallel(IEnumerable<Func<ValueTask>> handlers, Type? ignoring = null)` in every `OptimisticConcurrencyTests.cs` of 05 (exercise and `Solutions/05-OptimisticConcurrency/RetryIn*`): each call increments a counter with `Interlocked.Increment`, the last one sets a `TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously)`, and every call awaits it before running.
- Node.js `Promise.all` already starts every call in the same tick; only the comments change there.
- The database, the solutions, the retry limit and the 10 calls stay as they are.
- The JVM and .NET 04 tests already use `// Given`, `// When`, `// Then`; follow them.

Similar code
- The JVM `DatabaseTest` latches (step 8) for barrier use.
- The 04 tests in each repository for the comment style.

Blocked by
None (steps 1-14 are done).

Acceptance criteria
- 20.5 GIVEN the JVM and .NET 05 concurrency test helpers (`inParallel` / `InParallel`) in the exercise and both solutions, both flavours WHEN they start the calls THEN every call waits at a shared start gate and all are released together once the last one is ready (JVM `CyclicBarrier`, .NET a `TaskCompletionSource` set by the last call); Node.js keeps `Promise.all`; the 50-run check (20.3) is run again and holds (Q69).
- 20.6 GIVEN every 05 concurrency test in all three repositories WHEN read THEN it has clear `// Given`, `// When`, `// Then` comments (Q69).

Tests
- 20.5: the 50-run check again in JVM and .NET (JVM `./gradlew test --rerun --tests '*e05*OptimisticConcurrencyTests'` in `exercises` and `solved`; .NET `dotnet test --project ... --filter OptimisticConcurrency` for the exercise and the solutions) - exercise: every concurrency test fails in every run; solutions: every one passes in every run; counts in progress.md. Node.js isn't rerun for this (unchanged).
- 20.6: read every 05 concurrency test file in the three repositories - `// Given`, `// When`, `// Then` mark the setup, the parallel calls and the assertions.
- Breaks: none; the tests keep their names and assertions.
```

---

## Step 16. Nested transactions are not supported, alignment.md, and final verification

```text
Use the `implement-step` skill.

What to build
In JVM, starting a transaction inside a transaction fails at once with an exception saying nested transactions are not supported. The database doesn't join, nest or partly undo transactions. The step 13 joining code and the step 14 undo code go. Then `alignment.md` describes 05 as it is now, and the whole workshop is verified again in all three repositories after steps 13-16 (step 12 checked group 11 before them).

Context
- `Transaction.transaction` in the 5 JVM `Database.java` files with `transaction` (solved e03, exercise and solved e04 and e05): step 13 made it join the outer transaction, step 14 made a throwing inner one undo its writes. Replace it with throwing at once (for example `UnsupportedOperationException("Nested transactions are not supported")`).
- The `DatabaseTest` tests from steps 13 and 14 about nested transactions ("a transaction started inside a transaction joins it", "an inner transaction that throws records none of its writes", "an inner transaction that throws uncaught fails the whole transaction").
- Nothing in the workshop starts a transaction inside a transaction.

Similar code
- The other `DatabaseTest` tests.

Blocked by
None.

Acceptance criteria
- 20.4 GIVEN a JVM transaction WHEN its work starts another transaction THEN that fails at once with an exception saying nested transactions are not supported, and if the outer work doesn't catch it nothing is applied; the database doesn't join, nest or partly undo transactions, as most databases don't support nested transactions (Q70 follow-up).
- 21.1 GIVEN `alignment.md` WHEN its 05 section is read THEN it says what 05 teaches, what its tests prove and its model after this work (the 05 exercise is the 04 solution plus the versioned database; two solutions per flavour: retry in the facade and retry in the infrastructure; the seven concurrency tests next to their modules; Node.js asynchronous from 02), and no longer lists gaps this work closed (for example "Node.js copies a loaded document shallowly").
- 11.1 GIVEN JVM WHEN the solved tests run without cache THEN all pass, and the exercises compile.
- 11.2 GIVEN .NET WHEN all tests run THEN every solution project passes, and the only failures are exercise tests expected to fail.
- 11.3 GIVEN Node.js WHEN the solved tests, type check and lint run THEN they pass.
- 11.4 GIVEN any test run WHEN its output is read THEN it has no new warnings.
- 11.6 GIVEN exercise 06 in any repository WHEN compared before and after THEN it is unchanged.

Tests
- 20.4: "starting a transaction inside a transaction fails" - the outer stores D1 and starts an inner transaction - asserts the exception with the "not supported" message reaches the caller and D1 is not stored. Fails first with the step 13/14 code.
- 21.1: read the 05 section of `/home/oskar/repos/EventSourcing.NodeJS/alignment.md` against spec r26 - it matches, with no closed gaps left.
- 11.1-11.3: JVM `./gradlew test --rerun` in `solved` and `exercises`; .NET `dotnet build` and `dotnet test --solution` for `EventDrivenArchitecture.slnx`; Node.js `npm run test:solved`, `npm run build:ts`, `npm run lint`, `npm test` - solutions pass; exercises fail only in their TODO tests (05: the 14 concurrency tests).
- 11.4: compare outputs with the baseline in progress.md - no new warnings.
- 11.6: `git status` shows no 06 path in any repository.
- Breaks: the three nested-transaction tests from steps 13 and 14 are removed (replaced by the test above); exercise and solved copies of 04 and 05 stay identical.
```

---

## Step 17. The Node.js charge-racing-checkout test matches JVM and .NET

```text
Use the `implement-step` skill.

What to build
The Node.js charge-racing-checkout concurrency test, in the 05 exercise and both solutions, both flavours, checks in its 10 guest stays one after another and, while racing, ignores only the same expected error type as JVM and .NET, so an unexpected error fails the test.

Context
- `optimisticConcurrency.*.test.ts` in `workshops/event_driven_architecture/src/05_optimistic_concurrency/regular/*/guestStayAccounts/` and `src/solved/05_optimistic_concurrency/regular/*/*/guestStayAccounts/`: the test "a charge recorded concurrently with checkout ..." uses `Promise.allSettled` and checks in the guests in parallel.
- JVM `inParallel(..., ignoring)` and .NET `InParallel(..., ignoring)` in the same test ignore one exception type; find which and use the Node.js counterpart.

Similar code
- The JVM and .NET versions of the same test (step 14/15).

Blocked by
None.

Acceptance criteria
- 20.7 GIVEN the Node.js charge-racing-checkout concurrency test, exercise and both solutions, both flavours WHEN read THEN it checks in its 10 guest stays one after another and, while racing, ignores only the same expected error type as JVM and .NET (not every error), so it matches the JVM and .NET test (Q72).

Tests
- 20.7: the changed test passes in both solutions on repeated runs (`npx vitest run` on the solved 05 guest stay concurrency files, 10 times) and fails in the exercise as before; read it against the JVM and .NET test - same setup order and same ignored error.
- extra: Node.js build, lint and `npm run test:solved` pass.
- Breaks: none.
```
