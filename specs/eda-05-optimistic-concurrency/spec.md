# EDA workshop: exercise 05 Optimistic concurrency aligned in Node.js, .NET and JVM

Revision: 27

Based on `qa.md` Q40–Q72 in this folder, and on the 04 decisions in `../eda-04-idempotency/qa.md` (Q1–Q39) and `../eda-04-idempotency/spec.md` r14, which Oskar asked to apply to 05 "accordingly". A 04 question is cited as `04-Q<n>`.

## Problem Statement

Exercise 05 teaches that handlers running at the same time must not lose each other's changes: store with the version you loaded, and on a conflict load, decide and store again. An attendee should get the same exercise in Node.js, .NET and JVM, and it should start from the code they finished in 04.

Today the 05 tests and the retry approach match across the three repositories, but 05 was copied from an earlier 04 and missed everything the 04 alignment changed:

- The saga still has the old shape: JVM and .NET return a `SagaResult` that the wiring unpacks; Node.js returns a list of commands from one function. 04 has the saga that gets the message bus and sends its commands (04-Q11).
- A command from the bus for a missing group checkout or guest stay account throws "Entity not found"; in 03 and 04 it is ignored (04-Q27).
- The .NET aggregates group checkout never sets its status when it completes or fails, so its "finished" check never applies; 04 sets it.
- The Node.js 05 immutable entities group checkout still throws "Group checkout already initiated!" from `initiateGroupCheckout`, and its `Finished` state has no guest list; the 04 solution has neither the throw nor that state shape.
- In JVM and .NET the 05 tests are one file per kind at the variant root, and the group checkout entity definition tests are missing; in 04 (all repositories) and in Node.js 05 the module tests sit next to the module.
- The Node.js 05 message catcher compares loosely (`toEqual`, `toMatchObject`, `arrayContaining`), so a message with a wrong extra field passes; 04 compares exactly.
- The 05 READMEs link only the optimistic concurrency tests.

Two more differences come from 05 itself:

- The Node.js database and message bus are synchronous in 02–04 and become asynchronous in 05, because in JavaScript two handlers can only overlap at an `await` (Q40). So the Node.js 05 exercise changes every facade, the wiring and every test to `async`, while in JVM and .NET the 05 exercise facade differs from the 04 solution only by reading the document from the versioned result. .NET is asynchronous from 02.
- Every facade method has an idempotency test in 04 (04-Q6), but in 05 check-in and record payment have no concurrency test (Q41).

The goal: the 05 exercise of each flavour is the 04 solution of that flavour plus only what 05 adds; the 05 solution adds only the optimistic concurrency handling; every facade method has a concurrency test; and in Node.js the move to asynchronous code happens in 02, as in .NET.

## Solution

**The Node.js database and message bus are asynchronous from 02 (Q40).** In Node.js 02, 03 and 04, exercises and solutions, every database collection operation (`get`, `store`, `delete`, and `findAll` in the tools that have it: the 03 solutions and 04) returns a promise, and the message bus `publish` returns a promise and awaits each handler it calls, as the .NET tools return `ValueTask` from 02 and the Node.js 05 tools already do. The promises are already resolved (`Promise.resolve(...)`), as .NET returns `ValueTask.CompletedTask` and `ValueTask.FromResult(...)`: the tools don't wait for anything, they only have the asynchronous shape. Message handlers and middlewares (the message catcher) both return Emmett's `MaybePromise<void>` (`void | PromiseLike<void>`), and the bus awaits both (Q48). All Node.js 02–04 code that calls the database or the bus, exercises and solutions, is `async` and awaits those calls: facades, wiring handlers, saga handlers, the 03 process managers' and choreography handlers, the 03 to-do list, its projection and the scheduled to-do list, and the tests. A saga handler returns the promise of its publish, so the bus awaits the commands it sends. Nothing else in 02–04 changes: what each piece loads, decides, stores and publishes stays the same. The .NET and JVM 02–04 code doesn't change for this: .NET is asynchronous from 02 (its saga handlers already return the bus call's `ValueTask`), and JVM runs handlers synchronously on threads. The Node.js Introduction to Event Sourcing workshop is not changed (Q40 follow-up).

**The 05 exercise is the 04 solution of the same flavour plus what 05 adds.** Its module code (group checkouts, guest stay accounts, saga, wiring) is the 04 solution's, so it already ignores duplicates and, for the commands from the bus, a missing entity, has the 04 saga shape, and (in .NET aggregates) sets the group checkout status when it finishes. 05 adds only:

- the versioned database, built on the 04 database, so every operation the 04 tools offer stays (Q45, Q46): `get` returns the document with its version; `store` takes an optional expected version and fails with `ConcurrencyException` (JVM, .NET) or `ConcurrencyError` (Node.js) when the stored version is different; expected version 0 means the document must not exist yet; storing without an expected version keeps today's behaviour (overwrite and bump the version); loading responds with a short delay in JVM and .NET, and through an already-resolved promise in Node.js, as each does today, so handlers started together all load before any of them stores;
- in the facades, reading the document from the versioned result (`.document`), and nothing else;
- the message catcher that is safe to call from parallel handlers (JVM, .NET) and its check that the expected messages were published in any order;
- the 05 tests.

There are two 05 solutions per flavour (group 15). Both have the same shared tools plus the retry helper. In the "retry in the facade" solution, the module code differs from the 05 exercise only by the optimistic concurrency handling, as today: every facade method stores with the version it loaded (check-in and initiation with 0), runs load–decide–store inside the retry, which tries up to 10 times on a conflict, and publishes only the events of the attempt that succeeded, after the retry. For the commands from the bus (record guest completion, record guest failure, check out guest), a missing entity inside the retry ends the attempt with no events (04-Q27); record charge and record payment, which a clerk calls directly, throw "Entity not found" for a missing account, as in 04 (Q47); in Node.js immutable entities this is new in every guest stay facade from 02 to 05 (Q48, Q50), see below. The .NET retry stays on Polly (9 retries, so 10 attempts); JVM and Node.js keep their loop. In the "retry in the infrastructure" solution the facades don't store, pass versions or retry themselves: an aggregate store (aggregates) or a command handler (immutable entities) does it for them, with the same rules (see group 15).

```
04 solution (aggregates)              04 solution (immutable entities)
   │  + versioned database, .document, catcher any-order check, 05 tests
   ▼                                      ▼
05 exercise (aggregates)              05 exercise (immutable entities)
   │  + expected versions and retry (attendee)
   ▼                                      ▼
05 solutions (aggregates)             05 solutions (immutable entities)
   "retry in the facade" and "retry in the infrastructure"
```

**One rule for a missing entity, from 02 to 05, in all three repositories (Q47, Q48, Q49, Q50).** A facade method called directly throws "Entity not found"; a facade method triggered by a command from the bus does nothing. This covers every exercise and solution from 02 to 05, the JVM 03 Kafka, RabbitMQ and transactions solutions included (Q50). So:

- record charge and record payment throw "Entity not found" for a missing guest stay account. Today the Node.js guest stay facades whose account is an immutable entity (decide/evolve) load a missing account as `initial` instead, so recording a charge or payment throws "Guest account is already checked out!", the wrong reason for a guest that was never checked in: in the 02 solution, the facade the 03 exercise gives, the 03 saga, choreography and to-do list solutions, 04 and 05. They throw "Entity not found" before deciding, as JVM, .NET and the Node.js aggregates do;
- check out in 02, where nothing comes from the bus, throws "Entity not found", as the 02 aggregates solutions do; the Node.js 02 immutable entities solution, which today publishes `GuestCheckoutFailed` (not checked in) for a missing account, throws instead;
- the 02 exercise skeletons load the account and throw "Entity not found" for a missing one in record charge, record payment and check out, before the TODO, as the JVM ones do; today the Node.js (`regular` and `emmett`) and .NET skeletons do this only in record charge (Q50);
- check out, record guest completion and record guest failure in 03 to 05 come from the bus and do nothing for a missing guest stay account or group checkout, as 03 and 04 already do, and as the 05 exercise and solution will, being built from 04. The JVM 03 Kafka and RabbitMQ solutions, which throw "Entity not found" there today, do nothing too (Q50);
- the JVM 03 transactions solution has no bus wiring: its guest stay facade methods are called directly and keep throwing "Entity not found", and its group checkout facade's `initiateGroupCheckout`, which loads each guest stay account itself inside a transaction, throws "Entity not found" for a missing account instead of today's bare `NoSuchElementException` (Q51); it also stores each checked-out account under the account's own id, not the group checkout id as it does today (an existing bug, Q51);
- the JVM `Database.transaction` (the solved 03 tools, and the exercise and solved 04 and 05 tools that carry it) behaves like serializable isolation (Q52–Q54, Q58): transactions end up as if they ran one after another. Inside a transaction, the documents it reads and the writes it makes are recorded, and nothing reaches the stored data. At commit, if any document the transaction read or wrote was changed since the transaction first read or wrote it (by another transaction's commit or by a plain store or delete outside a transaction), the commit fails with `ConcurrencyException` (in 03 and 04 too, the same exception as in 05, Q58) and applies nothing; otherwise all its writes are applied together, and every collection sees them, also one created before the transaction. In 05 an expected version inside a transaction is checked at commit the same way. When the work throws, nothing is applied, the exception reaches the caller, nothing is printed, and the comment "Do nothing, discard transactional changes" stays. The storage is never copied, and the transaction is its own named object, not a `Database` marked by a `null` field (Q58). Today it copies the whole storage and replaces it on commit, so collections created earlier never see the commit and parallel commits overwrite each other;
- check in still starts a new account.

These tests are new, the same in all three repositories, in every guest stay entity definition test suite of the 02–05 exercises and solutions, both flavours (the JVM 03 Kafka, RabbitMQ and transactions solutions included): "recording a charge for a missing guest stay account fails with Entity not found", the same for a payment, and, in 02 only, the same for a checkout; in the JVM 03 transactions solution, which only JVM has, also "initiating a group checkout with a missing guest stay account fails with Entity not found" and "initiating a group checkout stores each guest stay account under its own id" (checked through the facades: after the group checkout, checking out one of its guests again publishes `GuestCheckoutFailed`), in a new `transactions/groupcheckouts/EntityDefinitionTests.java` (Q51, Q52). Every JVM `Database` with `transaction` (solved 03, exercise and solved 04 and 05) gets tests in `core/` next to it, without the exercise tag: "a committed transaction's changes are visible through a collection created before it", "a transaction that throws applies nothing and prints nothing", "a document deleted in a transaction is gone after the commit", "two transactions at the same time on different documents both commit", "a transaction that read a document another transaction changed and committed fails and applies nothing", and in 05 "a transaction whose expected version no longer matches fails and applies none of its changes" (Q54, Q56, Q58). "A bus command for a missing entity does nothing" gets no test, as decided in 04 (Q50).

**Every facade method has a concurrency test (Q41).** The five tests stay, and two are added, in all three repositories and both flavours:

- checking in the same guest stay several times at once checks it in once (one `GuestCheckedIn`), like the existing initiation test;
- payments recorded at once all count towards the balance, like the existing charges test: after a charge for the full amount and several payments recorded at once that together settle it, checking out publishes `GuestCheckedOut`.

The 05 tests stay at the facade level; the bus keeps calling handlers one after another, and there is no whole-process test with handlers running in parallel (Q42).

**Tests sit next to the module they test (as in 04).** In 05: the business process tests and the "bus delivers every message twice" test in the variant folder; the group checkout entity definition, idempotency and concurrency tests (initiation, completions, completions with a failure) in the group checkouts module; the guest stay account entity definition, idempotency and concurrency tests (check-in, charges, payments, a charge racing a checkout) in the guest stay accounts module. The 05 entity definition and idempotency tests are the 04 ones of the same repository and flavour. Test cases come first in each file, setup and helpers below.

**Node.js compares published messages exactly (as in 04).** The 05 message catcher's single-message and list checks use strict equality, as the 04 one does, and its any-order check compares each message strictly too, so an extra field fails the test in every check. The Node.js 05 tests pass no type argument to the catcher (04-Q24).

**The 05 README** says in one short paragraph where the tests are and links each test file for each variant, as the 04 README does.

## Acceptance criteria

Event names are the JVM and Node.js ones; in .NET they are its own counterparts (`GuestCheckoutCompleted`, the group checkout's `GuestCheckOutFailed`), which this spec doesn't rename.

Node.js asynchronous tools from 02

1. A Node.js attendee writes asynchronous facades from 02, as a .NET attendee does.
   1.1. GIVEN the Node.js 02, 03 and 04 tools, exercises and solutions WHEN read THEN the collection's `get`, `store` and `delete`, and `findAll` where the tools have it (03 solutions, 04), return promises that are already resolved; no tools gain `findAll`; and the message bus `publish` returns a promise and awaits each handler it calls, once or (with deliver-twice) twice.
   1.2. GIVEN every piece of Node.js 02–04 code that calls the database or the bus, exercises and solutions (facades, wiring handlers, saga handlers, 03 process managers and choreography handlers, the 03 to-do list, its projection and the scheduled to-do list) WHEN read THEN it is `async` and awaits each database and bus call, and every handler subscribed to the bus returns the promise of the work it starts.
   1.7. GIVEN a Node.js 03 or 04 saga solution and a group checkout for guests A and B WHEN the test awaits the initiation and both guests check out THEN `GroupCheckoutCompleted` is already published when the awaited call returns, on repeated runs (protects existing behaviour: the business process tests check this).
   1.8. GIVEN the Node.js 03 to-do list solution with its scheduled part and a group checkout whose guests all checked out WHEN the scheduled run is awaited twice THEN `GroupCheckoutCompleted` is published once and the group checkout is removed from the list (protects existing behaviour: `scheduledBusinessProcess.solved.test.ts` checks this).
   1.10. GIVEN every Node.js message bus from 02 to 05 WHEN read THEN it declares a `MessageHandler` and a `MessageMiddleware` type, both returning `MaybePromise<void>` from Emmett, `use` takes a `MessageMiddleware`, and `publish` awaits each middleware and each handler; the 04 and 05 buses differ only by what 05 adds (nothing in the bus).
   1.9. GIVEN the .NET and JVM 02–04 code WHEN compared before and after THEN it is unchanged by this group.
   1.3. GIVEN every Node.js test in 02–04 WHEN read THEN it awaits each facade call and each publish.
   1.4. GIVEN the Node.js 02–04 solutions WHEN their tests run THEN they pass with the same expected messages as before; in the exercises the same tests fail as before (protects existing behaviour).
   1.5. GIVEN the Node.js 02 exercise facades (`regular` and `emmett`) WHEN read THEN they are asynchronous and still have the TODO about passing the class to the collection (04 spec 16.6).
   1.6. GIVEN the Node.js Introduction to Event Sourcing workshop WHEN compared before and after THEN it is unchanged.

05 exercise is the 04 solution

2. An attendee starting 05 finds the code they finished in 04.
   2.1. GIVEN a 05 exercise and the 04 solution of the same repository and flavour WHEN their module code is compared THEN the only difference is reading the document from the versioned result of `get`.
   2.2. GIVEN a 05 exercise and the 04 solution of the same repository WHEN their tools are compared THEN every operation of the 04 tools is still there (Q45, Q46), and the only differences are: the versioned database (versions, optional expected version on store, the concurrency exception or error, the load delay in JVM and .NET), the message catcher's any-order check, and in JVM and .NET the catcher being safe for parallel calls.
   2.3. GIVEN a 05 exercise and either of its 05 solutions WHEN compared THEN the shared tools differ only by the retry helper; the "retry in the facade" module code differs only by the expected versions and the retry; the "retry in the infrastructure" solution adds the aggregate store or command handler in its own `core/` and its facades call it (group 15).
   2.4. GIVEN a 05 exercise or solution in any repository and flavour WHEN the saga is read THEN it has the 04 shape: built with the message bus, one handler each for `GroupCheckoutInitiated`, `GuestCheckedOut` and the guest checkout failure event, each sending its commands through the bus and returning nothing (in .NET the bus call's `ValueTask`, in Node.js the promise of its publish, so the bus awaits them); there is no `SagaResult`.
   2.9. GIVEN the 05 tools in any repository WHEN read THEN they have every operation of the 04 tools, adapted to the versioned database: JVM `Database.transaction` is there (it works as group 13 says), `Collection.findAll` returns the documents, `getAndUpdate` stores without an expected version; .NET `Database.FindAll` returns the documents and the non-generic `MessageBus.Subscribe(Type, …)` is there; Node.js `findAll` returns a promise of the documents.
   2.5. GIVEN a 05 exercise or solution and no group checkout with id X WHEN `RecordGuestCheckoutCompletion` or `RecordGuestCheckoutFailure` for X arrives THEN nothing is published and no error is thrown; GIVEN no guest stay account A WHEN `CheckOutGuest` for A arrives THEN nothing is published (in Node.js immutable entities also no `GuestCheckoutFailed`) and no error is thrown.
   2.6. GIVEN the .NET 05 aggregates exercise or solution WHEN the group checkout completes or fails THEN its status is completed or failed, so a later guest result publishes nothing.
   2.7. GIVEN the Node.js 05 immutable entities exercise or solution WHEN read THEN `initiateGroupCheckout` has no "Group checkout already initiated!" throw, and the group checkout state is the 04 solution's.
   2.8. GIVEN a 05 exercise in any repository and flavour WHEN the same command is sent twice one after another THEN it is handled once, as in the 04 solution (the 05 idempotency tests pass in the exercise).
3. An attendee starting 05 sees which tests are theirs to make pass.
   3.1. GIVEN a 05 exercise WHEN all its tests run THEN the business process, entity definition and idempotency tests pass, and the concurrency tests fail.
   3.2. GIVEN a 05 solution WHEN all its tests run THEN all pass, on repeated runs.

05 optimistic concurrency handling in the solution

4. Handlers running at the same time keep every change in the "retry in the facade" 05 solution (protects existing behaviour); in the "retry in the infrastructure" solution the aggregate store or command handler does the same (group 15).
   4.1. GIVEN a 05 solution WHEN a facade method stores THEN it passes the version it loaded, and 0 when it creates the document (check-in, initiation).
   4.2. GIVEN a 05 solution and a store that fails with a conflict WHEN the facade method retries THEN it loads the current state, decides again and stores again, up to 10 attempts in total; after the 10th failed attempt the conflict is thrown.
   4.3. GIVEN a 05 solution WHEN a facade method succeeds after one or more conflicts THEN only the events of the successful attempt are published, once, after the retry.
   4.4. GIVEN a 05 solution and a missing group checkout or guest stay account found inside the retry of record guest completion, record guest failure or check out guest WHEN the attempt runs THEN it ends with no events and the facade method publishes nothing; for record charge and record payment the attempt throws "Entity not found", as in 04 (Q47).

05 tests

5. Every facade method has a concurrency test.
   5.1. GIVEN the group checkout concurrency tests WHEN read THEN there is: the same group checkout initiated several times at once is initiated once; all guest completions recorded at once complete the group checkout; the completions and one failure recorded at once fail the group checkout.
   5.2. GIVEN the guest stay account concurrency tests WHEN read THEN there is: the same guest stay checked in several times at once is checked in once; charges recorded at once all count towards the balance; payments recorded at once all count towards the balance; a charge recorded at the same time as a checkout doesn't let an unsettled guest check out.
   5.3. GIVEN no guest stay account with id A WHEN the same `CheckInGuest` is sent five times at once THEN exactly one `GuestCheckedIn` is published.
   5.4. GIVEN a checked-in guest stay account with one charge for the sum of five amounts WHEN five payments with different payment ids and those amounts are recorded at once, and then the guest is checked out THEN `GuestCheckedOut` is published.
   5.5. GIVEN the two new tests WHEN run against the 05 exercise THEN they fail, and against both 05 solutions THEN they pass.
   5.6. GIVEN the same concurrency test in two repositories WHEN compared THEN it has the same name (apart from casing and language convention), sits in the same module, and has the same steps and expected messages.
   5.7. GIVEN the five existing concurrency tests WHEN compared before and after THEN their steps and expected messages are the same.
6. 05 runs the 04 entity definition and idempotency tests.
   6.1. GIVEN a 05 exercise or solution in any repository and flavour WHEN its entity definition and idempotency tests are read THEN they are the 04 ones of the same repository and flavour, including the five group checkout entity definition tests, the seven per-method idempotency tests, "the last completion recorded twice completes the group checkout once" and "the whole process completes once when the bus delivers every message twice".
   6.2. GIVEN JVM and .NET 05 before the change WHEN listed THEN the group checkout entity definition tests are missing, and after the change they are there.
7. Tests sit next to the module they test.
   7.1. GIVEN a 05 exercise or solution in any repository and flavour WHEN listed THEN the variant folder has the business process tests and the bus-delivers-twice test; the group checkouts module has its entity definition, idempotency and concurrency tests; the guest stay accounts module has its entity definition, idempotency and concurrency tests.
   7.2. GIVEN any 05 test file WHEN read THEN the test cases come first, setup and helpers below them.
   7.3. GIVEN a JVM 05 exercise test WHEN read THEN it has the exercise marker, as in 04.
8. There is no whole-process concurrency test (Q42).
   8.1. GIVEN the 05 message bus in any repository WHEN it delivers a message THEN it calls the handlers one after another, as today, with no option to call them in parallel.

Exact message comparison in Node.js 05

9. A Node.js 05 test fails when a published message differs in any field.
   9.1. GIVEN the Node.js 05 message catcher, exercise and solution WHEN read THEN the single-message and list checks use strict equality, and the any-order check compares each message strictly and the number of messages.
   9.2. GIVEN a 05 test expecting messages in any order WHEN one published message carries an extra field, even one set to `undefined`, THEN the test fails.
   9.3. GIVEN the Node.js 05 tests WHEN read THEN no call passes a type argument to the message catcher, and no test file declares `type ExpectedTypes`.

README

10. An attendee reading the 05 README finds the tests.
    10.1. GIVEN the 05 README in any repository WHEN read THEN one short paragraph says the business process and bus-delivers-twice tests are in the variant folder and the module tests sit next to the module's code, and it links each test file for each variant.
    10.2. GIVEN any link in it WHEN followed THEN it opens an existing file.
    10.3. GIVEN the Node.js 05 README WHEN read THEN it no longer says that the database or the facades become asynchronous in 05 (today: "is now asynchronous, like a real one" and "now with asynchronous facades"); it says the database now versions documents.

Verification

11. Nothing else broke.
    11.1. GIVEN JVM WHEN the solved tests run without cache THEN all pass, and the exercises compile.
    11.2. GIVEN .NET WHEN all tests run THEN every solution project passes, and the only failures are exercise tests expected to fail.
    11.3. GIVEN Node.js WHEN the solved tests, type check and lint run THEN they pass.
    11.4. GIVEN any test run WHEN its output is read THEN it has no new warnings.
    11.6. GIVEN exercise 06 in any repository WHEN compared before and after THEN it is unchanged.

One rule for a missing entity

12. A missing entity is handled by one rule from 02 to 05, in all three repositories (Q47–Q50).
    12.1. GIVEN any guest stay facade from 02 to 05, any repository and flavour, exercise or solution (the JVM 03 Kafka, RabbitMQ and transactions solutions included), and no guest stay account A WHEN a charge or a payment is recorded for A THEN "Entity not found" is thrown and nothing is published (in Node.js immutable entities today: "Guest account is already checked out!"); GIVEN the same facade in a solution or in code an exercise gives (not the 02 skeleton, where check-in is the attendee's TODO) WHEN A is checked in THEN `GuestCheckedIn` is published.
    12.2. GIVEN any 02 guest stay facade, any repository and flavour, exercise skeleton or solution, and no guest stay account A WHEN A is checked out THEN "Entity not found" is thrown and nothing is published (in the Node.js 02 immutable solution today: `GuestCheckoutFailed`); GIVEN the 02 exercise skeletons WHEN read THEN record charge, record payment and check out each load the account and throw "Entity not found" for a missing one before the TODO, in all three repositories.
    12.3. GIVEN any 03–05 solution or 04–05 exercise, any repository and flavour (the JVM 03 Kafka and RabbitMQ solutions included), and no guest stay account A WHEN `CheckOutGuest` for A arrives from the bus THEN nothing is published and no error is thrown; GIVEN no group checkout X WHEN a guest checkout completion or failure for X arrives from the bus THEN nothing is published and no error is thrown. GIVEN the JVM 03 transactions solution and no guest stay account A WHEN A is checked out through the guest stay facade THEN "Entity not found" is thrown; WHEN a group checkout including A is initiated THEN "Entity not found" is thrown.
    12.4. GIVEN the guest stay entity definition tests of any 02–05 exercise or solution, any repository and flavour (the JVM 03 Kafka, RabbitMQ and transactions solutions included) WHEN read THEN they include "recording a charge for a missing guest stay account fails with Entity not found" and the same for a payment, and in 02 also for a checkout; each test has the same name (apart from casing and language convention) and steps in all three repositories.
    12.5. GIVEN a 05 exercise or solution, any repository and flavour, and no guest stay account A WHEN a charge or payment is recorded for A THEN "Entity not found" is thrown and nothing is published, as in 04 (Q47, Q48).

JVM transactions

13. The JVM 03 transactions solution and the JVM `Database.transaction` just work (Q51–Q54).
    13.1. GIVEN the JVM 03 transactions solution and checked-in guest stay accounts A and B with settled balances AND a group checkout for A and B initiated WHEN A is checked out again through the guest stay facade THEN `GuestCheckoutFailed(A, INVALID_STATE, now, no group checkout id)` is published (today `GuestCheckedOut`, because A is stored under the group checkout id and the guest stay facade's collection doesn't see the commit; both the id fix and the transaction fix are needed) (Q51, Q52).
    13.2. GIVEN a JVM `Database` with `transaction` (solved 03, exercise and solved 04 and 05) and a collection created before the transaction WHEN a transaction stores document D and returns THEN the collection returns D; WHEN a transaction stores D and then throws THEN the collection doesn't return D, the exception reaches the caller and nothing is printed; GIVEN D stored WHEN a transaction deletes D and commits THEN the collection doesn't return D; GIVEN document X stored WHEN two transactions are open at the same time, T1 changes X and T2 stores a new document Y without reading X, and T1 commits before T2 THEN both commit and the collection returns T1's X and Y; WHEN instead T2 reads X before T1 commits and stores Y THEN T2's commit fails with `ConcurrencyException`, the collection returns T1's X and doesn't return Y; WHEN instead T2 stores X without reading it, T1 commits its change to X, then T2 commits THEN T2's commit fails with `ConcurrencyException` and the collection returns T1's X; GIVEN X stored WHEN a transaction reads X, X is stored again outside any transaction, and the transaction then commits a change THEN the commit fails with `ConcurrencyException` and applies nothing; in 05, GIVEN D stored at version 1 WHEN a transaction stores a new document E and D with expected version 1, and D is stored again (as D') before the transaction commits THEN the transaction fails with `ConcurrencyException`, the collection returns D' at version 2 and doesn't return E; GIVEN D already at version 2 WHEN a transaction, without reading D, stores D with expected version 1 THEN the commit fails with `ConcurrencyException` and applies nothing (Q52–Q54, Q58).
    13.3. GIVEN the JVM 03 transactions solution's tests WHEN listed THEN the two group checkout tests are in `transactions/groupcheckouts/EntityDefinitionTests.java`, and the `Database` tests are next to each `Database` with `transaction` (solved 03, exercise and solved 04 and 05); the exercise and solved 04 tools stay identical, and the exercise and solved 05 tools are identical apart from the solved retry helper.

.NET `FindAll`

14. .NET names the operation that returns all documents `FindAll`, as JVM and Node.js do (Q47).
    14.1. GIVEN the .NET 03, 04 and 05 tools and code WHEN searched THEN there is no `GetAll`, `FindAll` is used where it was, and the 03 tests pass as before.

Two 05 solutions

15. The 05 solution shows two places for the optimistic concurrency retry, in both flavours and all three repositories (Q57, Q59–Q61).
    15.1. GIVEN the 05 solutions in any repository WHEN listed THEN there are two solution folders, each with both flavours, and the shared tools at the 05 root; the "retry in the infrastructure" folder also has its own `core/`, used by both its flavours, holding the aggregate store and the command handler (Q62): JVM `e05_optimistic_concurrency/retry_in_facade/{solution1_aggregates, solution2_immutableentities}` and `retry_in_infrastructure/...`; .NET `Solutions/05-OptimisticConcurrency/RetryInFacade/{Version1-Aggregates, Version2-ImmutableEntities}` and `RetryInInfrastructure/...`; Node.js `solved/05_optimistic_concurrency/regular/solution1_retry_in_facade/{solution1_aggregates, solution2_immutableEntities}` and `solution2_retry_in_infrastructure/...`; the 05 exercise keeps its layout (Q59).
    15.2. GIVEN a facade of the "retry in the facade" solution WHEN read THEN it has one private helper that, inside the retry, loads the entity, calls the facade method's function with it (aggregates: the aggregate or nothing stored, JVM empty `Optional`, .NET and Node.js `null`; immutable entities: the state or the decider's initial state), stores the result with the loaded version (0 when nothing was stored) only when there are events, and publishes the events of the successful attempt; every facade method, check-in and initiation included, calls it (Q60, Q62).
    15.3. GIVEN the "retry in the infrastructure" solution, immutable entities, WHEN a facade method runs THEN it calls a command handler with the entity id and a function from state to events; the command handler loads the state, or passes the decider's initial state (JVM `INITIAL`, .NET `Initial`, Node.js `initial`) when nothing is stored, calls the function, and when there are events evolves the state, stores it with the loaded version or 0, retrying on a conflict up to 10 attempts and throwing the conflict after the 10th, as the facade solution does (4.2); with no events it stores nothing; it returns the events, which the facade publishes (Q61, Q62).
    15.4. GIVEN the "retry in the infrastructure" solution, aggregates, WHEN a facade method runs THEN it calls an aggregate store with the id and a function that gets the loaded aggregate or nothing stored (JVM empty `Optional`, .NET and Node.js `null`) and returns the aggregate to store, or nothing; the aggregate store calls it, and when there is an aggregate with events dequeues them and stores it with the loaded version (0 when nothing was stored), retrying on a conflict up to 10 attempts and throwing the conflict after the 10th (4.2); it returns the events, which the facade publishes. Check-in and initiation create the aggregate when nothing is stored and return nothing when it exists; when two check-ins of the same account run at once, the one that loses the conflict retries, finds the account and returns nothing, so `GuestCheckedIn` is published once (Q61, Q62).
    15.5. GIVEN either solution WHEN nothing is stored for the id (immutable entities: the function gets the initial state) THEN the facade's function applies the missing-entity rule (group 12): check-in and initiation create, charge and payment throw "Entity not found", bus commands produce no events; the aggregate store and command handler only load, store and retry (Q61, Q62).
    15.8. GIVEN the aggregate store and the command handler of the "retry in the infrastructure" solution in any repository WHEN their own tests run (in that solution's `core/`, next to them, like the JVM `Database` tests) THEN they show, the same in all three repositories: a conflict is retried and the next attempt's events are returned; after the 10th conflict the conflict is thrown; when the function returns no events nothing is stored and the version stays; a missing entity reaches the function as the initial state (command handler) or as nothing stored (aggregate store) (Q65).
    15.6. GIVEN both 05 solutions, any repository and flavour, WHEN their tests run THEN each has the full set of 05 tests (business process, entity definition, idempotency, the seven concurrency tests), the same in both, and all pass, on repeated runs.

Broker solutions' clean test output

16. The JVM 03 Kafka and RabbitMQ tests print no warning (Q58).
    16.1. GIVEN the JVM 03 Kafka and RabbitMQ `MessageMetadataPropagationTest` WHEN it runs THEN its expected messages list every message the process publishes (including `RecordGuestCheckoutCompletion`, `GuestCheckoutCompletionRecorded` and `GroupCheckoutCompleted`), it passes, and the output has no "WARNING: Unexpected message type found" line.

Immutable entities' "not existing" status

17. JVM and .NET immutable entities mark a missing entity the way Node.js does (Q63).
    17.1. GIVEN the JVM and .NET immutable entities (guest stay account and group checkout) in every exercise and solution from 02 to 05 where an initial state exists WHEN read THEN their status has a "not existing" value, as the Node.js `status: 'NotExisting'`, the initial state (JVM `INITIAL`, .NET `Initial`) carries it, so the code that gets the initial state (the function a facade passes to the command handler, and the private helper of the "retry in the facade" solution) detects a missing entity by that status and then behaves idempotently (a command from the bus: no events; check-in and initiation: create) or throws "Entity not found" (a method not triggered by the bus); the deciders and the 04 duplicate checks stay where they are, and the existing tests pass as before (Q63, Q64).

Node.js 05 README note

18. The Node.js 05 README has the same Notes as .NET and JVM (Q58).
    18.1. GIVEN the Node.js 05 README WHEN its Notes are read THEN they include "2. Settled means SUM(Charges) - SUM(Payments) === 0", as the .NET and JVM 05 READMEs do (Q58).

Fixes after the second run

19. The JVM transaction is fully serializable, .NET has one starting status, empty event lists aren't published, and the JVM test run is clean (Q66).
    19.1. GIVEN a JVM `Database` with `transaction` and document D stored WHEN a transaction reads D, D is deleted and stored again outside the transaction, and the transaction then commits a change THEN the commit fails with `ConcurrencyException` and applies nothing (versions never reset).
    19.2. GIVEN a JVM `Database` with `transaction` WHEN a transaction reads all documents of a type with `findAll`, another document of that type is stored outside the transaction, and the transaction then commits a change THEN the commit fails with `ConcurrencyException` and applies nothing.
    19.3. (replaced by 20.4: nested transactions are not supported, Q70 follow-up)
    19.4. GIVEN the .NET immutable group checkout in every exercise and solution from 02 to 05 WHEN read THEN its record's default status is the same "not existing" status as `Initial`, and its existing tests pass.
    19.5. GIVEN any facade of either 05 solution in any repository and flavour WHEN its command produces no events THEN it publishes nothing (no publish call with an empty list), the same in every facade.
    19.6. GIVEN the JVM `solved` and `exercises` build files WHEN read THEN they don't attach the Mockito agent; GIVEN the JVM tests WHEN run THEN they pass as before and the output has no "Sharing is only supported for boot loader classes" line.

Reliable concurrency tests and a failing nested transaction

20. The 05 concurrency tests fail every time against the exercise and pass every time against the solutions, and a failed nested transaction records nothing (Q67, Q68).
    20.1. GIVEN the 05 concurrency tests that start several calls at once (initiation, completions, completions with a failure, check-in, charges, payments) in any repository and flavour WHEN read THEN they start 10 calls at once instead of 5, with the same expected messages for 10; the retry limit stays 10 attempts and the load delay stays as it is.
    20.2. GIVEN the charge-racing-checkout concurrency test in any repository and flavour WHEN it runs THEN it runs the race (one charge and one checkout at once) for 10 checked-in guest stays at once and asserts that none of them is checked out with an unsettled balance.
    20.3. GIVEN the 05 exercise and both 05 solutions in all three repositories WHEN their concurrency tests run 50 times THEN in the exercise every concurrency test fails in every run, and in the solutions every one passes in every run; the counts before and after the change are written down once (no lasting test).
    20.5. GIVEN the JVM and .NET 05 concurrency test helpers (`inParallel` / `InParallel`) in the exercise and both solutions, both flavours WHEN they start the calls THEN every call waits at a shared start gate and all are released together once the last one is ready (JVM `CyclicBarrier`, .NET a `TaskCompletionSource` set by the last call); Node.js keeps `Promise.all`; the 50-run check (20.3) is run again and holds (Q69).
    20.7. GIVEN the Node.js charge-racing-checkout concurrency test, exercise and both solutions, both flavours WHEN read THEN it checks in its 10 guest stays one after another and, while racing, ignores only the same expected error type as JVM and .NET (not every error), so it matches the JVM and .NET test (Q72).
    20.6. GIVEN every 05 concurrency test in all three repositories WHEN read THEN it has clear `// Given`, `// When`, `// Then` comments (Q69).
    20.4. GIVEN a JVM transaction WHEN its work starts another transaction THEN that fails at once with an exception saying nested transactions are not supported, and if the outer work doesn't catch it nothing is applied; the database doesn't join, nest or partly undo transactions, as most databases don't support nested transactions (Q70 follow-up).

alignment.md

21. `alignment.md` describes 05 as it is after this work (Q71).
    21.1. GIVEN `alignment.md` WHEN its 05 section is read THEN it says what 05 teaches, what its tests prove and its model after this work (the 05 exercise is the 04 solution plus the versioned database; two solutions per flavour: retry in the facade and retry in the infrastructure; the seven concurrency tests next to their modules; Node.js asynchronous from 02), and no longer lists gaps this work closed (for example "Node.js copies a loaded document shallowly").

## Implementation Decisions

- The model for 05 is the JVM 05 exercise and solution, brought to the 04 shape; JVM is the reference for structure.
- Node.js tools in 02–04: collection `get`, `store`, `delete`, and `findAll` where it exists, return already-resolved promises; `publish` is asynchronous and awaits each middleware and each handler.
- Node.js message bus in 02–05: message handlers and middlewares return `MaybePromise<void>`, imported from Emmett as the tools import `JSONSerializer`; the bus awaits both. The 02–04 buses get the separate `MessageMiddleware` type that 05 has, and `use` takes it; in every bus it returns `MaybePromise<void>`, so every Node.js bus from 02 to 05 has the same handler and middleware types (Q48, Q49).
- Node.js 02–04 code that calls the database or bus (facades, wiring, saga handlers, process managers and choreography handlers, to-do list, projection, scheduled to-do list, tests): `async` and `await` throughout; a handler subscribed to the bus returns the promise of its work; no change to what the code does.
- A missing entity, 02–05, all three repositories, the JVM 03 Kafka, RabbitMQ and transactions solutions included: facade methods called directly throw "Entity not found" (record charge, record payment, check out in 02 and in the JVM 03 transactions solution, and the JVM 03 transactions `initiateGroupCheckout`); facade methods triggered by the bus do nothing (record guest completion, record guest failure, and check out in 03–05) (04-Q27, Q47–Q50). Node.js immutable guest stay facades stop loading `initial` for anything but check-in. The 02 exercise skeletons have the "Entity not found" check in record charge, record payment and check out.
- .NET `Database.GetAll` in 03, 04 and 05 is renamed `FindAll`, as JVM and Node.js name that operation (it returns the documents): the .NET 03 solution, 04 exercise and solution and 05 tools, and its caller, the 03 scheduled to-do list (Q47).
- The helpers that nothing in 04 or 05 calls (`findAll`/`FindAll`, JVM `transaction` and `getAndUpdate`) are copied to 05 (Q46, Q48). .NET `Subscribe(Type, …)` is not such a helper: `Subscribe<T>` calls it.
- 05 exercise of each flavour: the 04 solution of that flavour, plus the versioned database, `.document` in the facades, the 05 message catcher and the 05 tests. Each 05 solution adds the retry helper; the "retry in the facade" solution adds the expected version and the retry in its facades' private helper, the "retry in the infrastructure" solution in its aggregate store or command handler (group 15).
- Versioned database: the current 05 behaviour in each repository (versions start at 1 on the first store, expected version 0 for a new document, optional expected version, the existing exception or error and its message, the existing load delay). Node.js 05 keeps resolving `get` with an already-resolved promise.
- 05 tools are the 04 tools plus what 05 adds (Q45). The helpers that only 03 solutions use stay and work with the versioned database: JVM `Database.transaction` works as group 13 says (Q54), `Collection.findAll` returns the documents, `getAndUpdate` stores without an expected version; .NET `Database.FindAll` returns the documents and the non-generic `MessageBus.Subscribe(Type, …)` stays; Node.js `findAll` returns the documents (as a promise, like the other collection operations).
- JVM `Database.transaction` in solved 03 and exercise and solved 04 and 05: serializable isolation (Q58): a commit fails with `ConcurrencyException` and applies nothing when a document the transaction read or wrote changed since, otherwise all writes apply together and are visible to every collection; expected versions checked at commit in 05; nothing printed on a throw; no copy of the storage; the transaction is its own named object (no `null` marker); 03 and 04 get `ConcurrencyException`, used only by the transaction; its signature stays as in 03 (Q54).
- Two 05 solutions per flavour (Q57, Q59–Q61): "retry in the facade" with one private helper per facade, and "retry in the infrastructure" with an aggregate store (aggregates) or a command handler (immutable entities) modelled on Emmett's `CommandHandler`; the facade passes the business logic as a function and publishes the returned events; the missing-entity rule stays in the facade's function, which gets the initial state (immutable entities, recognised by its "not existing" status, which JVM and .NET get as Node.js has it, Q63) or nothing stored (aggregates) for a missing entity; nothing is stored when there are no events; the store and handler live in the `retry_in_infrastructure` folder's own `core/` (Q62). The private helper of the "retry in the facade" solution takes the same shape. The 05 exercise gives neither; attendees solve it as they like (Q57).
- Retry: up to 10 attempts on a conflict only; events published after it. .NET keeps Polly; JVM and Node.js keep their loop.
- Message catcher in 05: JVM and .NET keep theirs (safe for parallel calls, any-order check by exact field comparison). Node.js: strict equality in all three checks; its signatures stay as they are.
- Test layout in 05: as in 04 of the same repository, plus the concurrency tests in their module.
- New concurrency tests: check-in five times at once; one charge for the sum, then five payments at once, then checkout. Names follow the existing ones in each repository (for example JVM `guestCheckedInConcurrently_IsCheckedInOnce`, `paymentsRecordedConcurrently_AllCountTowardsBalance`; Node.js "guest checked in concurrently is checked in once", "payments recorded concurrently all count towards balance").
- Work order: JVM, then .NET, then Node.js.

## Testing Decisions

- Tests check behaviour through the facades and the messages caught by the message catcher, as every workshop test does. The exceptions are infrastructure tested on itself: the JVM `Database.transaction` (Q52) and the aggregate store and command handler of the "retry in the infrastructure" solution, in all three repositories (Q65).
- Concurrency tests start several facade calls at once (threads in JVM, tasks in .NET, `Promise.all` in Node.js) and check the published messages, as the five existing ones do.
- Test first: the two new concurrency tests fail against the 05 exercise and pass against both 05 solutions; the new missing-account tests fail where the code still loads `initial` (Node.js immutable entities) or the 02 skeleton lacks the check, and pass after the change.
- Every new test goes to all three repositories (Q49).
- The Node.js async change in 02–04 is covered by the existing tests of those exercises, which keep their expected messages.
- Prior art: the existing 05 concurrency tests (initiation for the check-in test, charges for the payments test); each repository's 04 test files for the layout.

## Out of Scope

- Exercise 06, in every repository: nothing in it changes in this work (Q50).
- The Node.js Introduction to Event Sourcing workshop (Q40 follow-up).
- A bus option to run handlers in parallel and a whole-process concurrency test (Q42).
- The Kafka and RabbitMQ work in JVM, which goes last; only the missing-entity rule and its tests (Q50) and the `MessageMetadataPropagationTest` fix (group 16, Q58) and the "not existing" status (group 17, aligned everywhere, Q49) apply to the JVM 03 Kafka and RabbitMQ solutions now.
- The other differences in `alignment.md`.

## Further Notes

- The .NET 04 tools are already asynchronous; the .NET and JVM 02–04 code doesn't change for Q40.

