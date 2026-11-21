# EDA workshop: exercise 04 Idempotency aligned in Node.js, .NET and JVM

Revision: 14

Based on `qa.md` Q1–Q38. Exercises 05 and 06 don't change (Q9), except the Node.js database, aggregates, group checkout state and the type argument in tests (Q18, Q19, Q21, Q24).

## Problem Statement

Exercise 04 teaches that a message delivered twice must have the same effect as delivered once (Q1). An attendee should get the same exercise in Node.js, .NET and JVM: the same starting code, the same tests and the same model solution.

Today the 04 tests and solutions match, but the road to them doesn't:

- Duplicate handling shows up before 04, differently in each repository. The JVM 03 solutions and the .NET 03 aggregates saga ignore the same guest result recorded twice. Node.js 02 and 03 throw on a repeated check-in and a repeated group checkout initiation, while 04 teaches to ignore them. So an attendee meets the answer before the question, and in Node.js a different answer.
- The rule "a finished group checkout ignores later guest results" is in JVM 03 and in the Node.js 03 saga and choreography, but not in the Node.js process manager, the .NET solutions or any to-do list (the to-do lists throw "Entity not found"). The .NET aggregates saga has the check, but its group checkout status never changes after creation (in 03 and 04), so it never applies.
- The sagas are built three ways: Node.js returns commands from a function, .NET and JVM return a `SagaResult` that the wiring unpacks. The model is a saga that gets the message bus and sends its commands itself, as in the .NET order saga sample (Q11).
- The 04 exercise should be the 03 saga solution, so the attendee only adds idempotency (Q2). In every repository it differs from its 03 saga solution: checks removed by hand, tools that differ from 03, and in Node.js no 03 aggregates saga to start from at all.
- .NET aggregates keeps a group checkout initiation on the guest stay facade, a leftover from 02, in 03 and 04, with an old test in 04.

The tests also differ in what they prove:

- JVM and .NET 04 don't run the group checkout entity definition tests from 03, so breaking the group checkout while adding idempotency isn't caught at that level.
- Node.js compares published messages loosely: a message with a wrong extra field passes. JVM and .NET compare every field.
- In JVM and .NET the 04 tests are one file per kind at the variant root; in 03 (all repositories) and Node.js 04 they sit next to the module they test.

The Node.js tools and model also differ from JVM and .NET in ways that change what an attendee's code is tested against:

- The Node.js database hands out a shallow copy of the stored object, while JVM and .NET serialize and deserialize. Nested lists are shared between the stored and the loaded object, and aggregates whose methods are arrow-function properties change the stored object instead of the loaded one. A change to a loaded document can reach the store before it's stored.
- Node.js has two aggregate base class implementations, and a third base class, `ProcessManager`, in the same `#`/arrow style: one with a JavaScript `#` field and arrow-function properties (02 aggregates solution, 03 aggregates exercise, 03 process managers), one with a TypeScript `private` field and normal methods (03 aggregates saga, 04, 05).
- The Node.js group checkout keeps its guest list in a `Map`, which JSON can't carry.
- The Node.js tests pass `ExpectedTypes`, a union of all four module message unions, as the type argument of `shouldReceiveMessages`; it says nothing about what the test expects.

The goal: the same saga shape everywhere; no duplicate handling before 04, but a finished group checkout ignores later results in every 03 solution; the 04 exercise is the 03 saga solution of its flavour without that check, plus what 04 adds; every facade method has an idempotency test; the tests compare messages exactly and sit next to the module they test.

## Solution

**One saga shape (Q11).** As in the .NET order saga sample, the group checkout saga gets the message bus, has one handler for each event it reacts to, and sends the commands itself:

- on `GroupCheckoutInitiated`, it sends a checkout command for each guest stay of the group;
- on `GuestCheckedOut` with a group checkout id, it sends `RecordGuestCheckoutCompletion`;
- on a guest checkout failure with a group checkout id, it sends `RecordGuestCheckoutFailure`;
- a guest event without a group checkout id needs nothing.

The handlers return nothing, and `SagaResult` goes. The wiring subscribes the saga's handlers to those events. This applies to every saga solution in scope: the 03 saga solutions in both flavours and the 04 exercises and solutions, in all three repositories.

**What the group checkout does with a guest result in 03 (Q4, Q9, Q11, Q12).** In every 03 solution (saga, process manager, choreography, to-do list) in every repository, a group checkout that finished (completed or failed) ignores any later guest result. While it is in progress, it records every guest result it gets, including the same one twice: ignoring that is 04's work. So:

- the JVM 03 solutions and the .NET 03 aggregates saga lose their "same result twice" check;
- the .NET saga, process manager and choreography solutions and the Node.js process manager get the "finished" rule;
- the .NET aggregates saga sets its status when the group checkout completes or fails;
- the to-do lists ignore a guest result for a group checkout that isn't on the list (finished and removed, or never there), instead of throwing "Entity not found" (Q14: throwing doesn't help a message handler). Their test "guest checkout for group checkout not on the to-do list fails" changes to expect the result to be ignored.

In 03, each repository keeps its own group checkout state shape: Node.js immutable entities have a `Finished` state without the guest list; JVM and .NET keep the list (Q13).

**Bus-triggered facade methods ignore a missing entity (Q27, Q31).** In every 03 solution (saga, process manager, choreography, to-do list), in the facades the 03 exercises give, and in the 04 exercises and solutions of all three repositories, recording a guest completion or failure for a group checkout that doesn't exist, and checking out a guest whose account doesn't exist, do nothing instead of throwing "Entity not found" (Q27). In Node.js immutable entities, which today load a missing account as `initial` and publish `GuestCheckoutFailed` (not checked in), a missing account also does nothing (Q30); a group checkout that includes such an account doesn't finish. These methods are called by commands from the bus, where an error helps nobody; handling such messages (for example with a dead-letter queue) is a later exercise.

**No other duplicate handling before 04 (Q9).** In 02 and 03, a repeated check-in or group checkout initiation is neither ignored nor rejected: Node.js loses its throws in 02 and 03, the to-do list included.

The 03 business process and entity definition tests don't depend on any of these checks and keep passing.

**Node.js gets a 03 aggregates saga solution (Q10).** It's the same saga, facades and wiring as the immutable entities saga, with the group checkout and guest stay account as aggregates, as in JVM. Both saga solutions sit in one folder, one subfolder per flavour: `solution1_sagas/solution1_aggregates` and `solution1_sagas/solution2_immutableEntities` (today's `solution1_saga`).

**The 04 exercise is the 03 saga solution of the same flavour, without the "finished" check (Q2, Q9, Q12).** Its module code (group checkouts, guest stay accounts, saga, wiring) matches the 03 saga solution apart from that check, which the attendee adds back in 04. In Node.js immutable entities, where the 03 check also narrows the state type, the 04 exercise keeps the guest list in the `Finished` state so that a late result can still be recorded (Q13); the 04 solution keeps that state shape and adds the check back. Its tools match the 03 saga solution. The per-variant core files (in .NET, the aggregate base and the dictionary extension) sit where 03 has them. 04 adds only:

- charge and payment ids in the commands and events (.NET, JVM; Node.js has them from 01), so the attendee can recognise a repeated charge or payment;
- the message bus option to deliver every message twice;
- the 04 tests.

The 04 solution has the same tools as the 04 exercise, and module code that differs from it only by the idempotency handling.

```
03 saga solution (aggregates)            03 saga solution (immutable entities)
   │  + charge/payment ids, deliver-twice bus, 04 tests
   ▼                                         ▼
04 exercise (aggregates)                 04 exercise (immutable entities)
   │  + idempotency handling (attendee)      │
   ▼                                         ▼
04 solution (aggregates)                 04 solution (immutable entities)
```

The idempotency handling in the 04 solutions is what they have today: ignore a repeated initiation, check-in, charge id, payment id and checkout for the same group checkout, a guest result the group checkout already has, and any result after it finished. The .NET 04 aggregates solution also sets its status when the group checkout completes or fails, as 03 does, so its "finished" check works. The Node.js 04 immutable solution drops its unreachable "Group checkout already initiated!" throw (Q11).

**Every facade method has an idempotency test (Q6).** The seven facade methods (group checkout initiate, record completion, record failure; guest stay account check in, record charge, record payment, check out) already have one each, plus the "last completion recorded twice completes the group checkout once" test and the "whole process with the bus delivering every message twice" test. They stay as they are. In .NET aggregates, the guest stay facade loses group checkout initiation in 03 and 04, and the old 04 test that used it goes.

**04 also runs the group checkout entity definition tests from 03** (agreed 2026-11-11).

**Tests sit next to the module they test (agreed 2026-11-11).** In 04: the business process tests and the "bus delivers every message twice" test in the variant folder; group checkout entity definition and idempotency tests in the group checkouts module; guest stay account entity definition and idempotency tests in the guest stay accounts module. Test cases come first in each file, setup and helpers below.

**Node.js compares published messages exactly (Q7):** the single-message and the message-list checks of the message catcher use strict equality, so an extra field, even one set to `undefined`, fails the test. This changes the message catcher copies of 02, 03 and 04, exercises and solutions; every Node.js solution test passes with it (checked on a copy of the workshop).

**The 04 README** says in one short paragraph where the tests are and links each test file for each variant.

**The Node.js database serializes and deserializes, as JVM and .NET do (Q16, Q18, Q20, Q21).** In every Node.js database from 02 to 06, exercises and solutions, storing a document keeps it as JSON written with Emmett's `JSONSerializer.serialize`, and loading reads it with `JSONSerializer.deserialize(json, { parseDates: true })`, so dates come back as `Date`. A collection can be created with an optional class, as a JVM collection is created with its class: `database.collection('guestStayAccount', GuestStayAccount)`. The parameter is typed as a constructor without parameters, `type?: new () => T`; every Node.js aggregate and process manager has such a public constructor, with the comment "Public constructor without parameters, used when loading from the database", as JVM's "Default constructor for Jackson" (Q33, Q37); the same holds for the 06 `transaction.collection`. Then loading creates the object with the class's public constructor without parameters and assigns the parsed data to it, so an aggregate has its methods and its constructor-initialised fields (Q33); without a class (immutable entities, outbox, checkpoints) the loaded value is the plain data. Nothing else copies the document. Where the attendee writes the model and the flavour is fixed, the exercise already gives an empty class and passes it to the collection, as JVM gives empty classes (Q28): the 03 aggregates exercise gets an empty `GroupCheckout` class in `groupCheckouts/groupCheckout.ts`, next to the event types (as JVM's `GroupCheckout.java`); it extends `Aggregate<GroupCheckoutEvent>` and has the public constructor without parameters with the comment "Public constructor without parameters, used when loading from the database" (as JVM's empty class has its "Default constructor for Jackson") and an `evolve` stub that throws "TODO: Fill the implementation" (Q38), and the 03 aggregates exercise's group checkout facade passes it to the collection; the 02 exercise gives no class at all; the 03 immutable entities exercise passes no class. The 02 exercise doesn't fix a flavour, so its facades (`regular` and `emmett`) create their collection without a class; the class is passed in the 02 aggregates solution (Q32). Both 02 exercise facades get a TODO at the `database.collection(...)` call, "If your guest stay account is a class, pass it here: `database.collection('guestStayAccount', GuestStayAccount)`. It needs a public constructor without parameters", and the 02 README says the same (Q34, Q36).

**One Node.js aggregate implementation (Q16, Q19, Q20).** Every Node.js aggregate from 02 to 06 uses one aggregate base class and one way of writing aggregates, the one that works with an object created by its public constructor and then given the parsed data: normal class methods, normal TypeScript fields (`private`) for the state, and the pending events (in `Aggregate`) or messages (in `ProcessManager`) in a JavaScript `#` field, so they're never written into the JSON and start empty after loading (Q33); that field has the comment "Not stored, so it's empty after loading" in both base classes (Q37); no arrow-function properties. Factories such as `GuestStayAccount.checkInGuest` and `GroupCheckout.initiate` are static methods, not static arrow properties, in every aggregate and process manager (Q23). The 03 process managers keep their own `ProcessManager` base class, like JVM's `AbstractProcessManager`, written the same way: a `#` uncommitted messages field and normal methods (Q25, Q33). Every Node.js aggregate and process manager changes to this: the 02 aggregates solution, the 03 aggregates exercise, the 03 aggregates saga, the 03 process managers, and the 04 and 05 aggregates (today all have a `private constructor()`; the 03 aggregates saga, 04 and 05 have `private uncommitedEvents`; the 02 aggregates solution, the 03 aggregates exercise and the 03 process managers have `#` fields and arrow-function methods). Aggregates stay classes (Q15). Pending events and messages never reach the store (Q29): every facade takes them out (`dequeueUncommitedEvents`, `dequeueUncommitedMessages`) before it stores the aggregate or process manager, as the 04 facades do, and the stored JSON never contains the pending events or messages, because they're `#` fields, as JVM's `@JsonIgnore` on `AbstractProcessManager.uncommittedMessages` keeps them out (Q33).

**The group checkout keeps its guest list in a `Record` (Q21).** In every Node.js group checkout from 03 to 06, both flavours and the 03 to-do list's group checkout document (`solution4_todo_list/groupCheckouts/groupCheckout.ts`), the guest list is a `Record<string, CheckoutStatus>` keyed by guest stay account id instead of a `Map`. Aggregates and process managers change their own field in place (`this.guestStayCheckouts[id] = 'Completed'`); immutable entities create new state (`{ ...state.guestStayCheckouts, [id]: 'Completed' }`) in both `decide` and `evolve` (Q26); today their `evolve` changes the `Map` in place, which goes.

**Tests don't pass a type argument to the message catcher (Q24).** In every Node.js test from 03 to 06, `shouldReceiveMessages` is called without a type argument, and the `ExpectedTypes` aliases in the test files are removed. The message catcher's own signature stays as it is.

## Acceptance criteria

One saga shape

1. A trainer reading the saga sees the same code shape in every repository.
   1.1. GIVEN a 03 saga solution or a 04 exercise or solution, any repository and flavour WHEN the saga is read THEN it is built with the message bus, has one handler each for `GroupCheckoutInitiated`, `GuestCheckedOut` and the guest checkout failure event, and each handler sends its commands through the bus and returns nothing.
   1.2. GIVEN the same code WHEN searched THEN there is no `SagaResult`, and the wiring subscribes the saga's handlers without unpacking results.
   1.3. (protects existing behaviour) GIVEN a group checkout for guests A, B and C WHEN `GroupCheckoutInitiated` is published THEN the saga sends three checkout commands, one per guest, with the group checkout id.
   1.4. (protects existing behaviour) GIVEN `GuestCheckedOut` for A with the group checkout id WHEN the saga handles it THEN it sends `RecordGuestCheckoutCompletion` for A; GIVEN a guest checkout failure for A with the group checkout id THEN it sends `RecordGuestCheckoutFailure` for A; GIVEN either event without a group checkout id THEN it sends nothing.
   1.5. GIVEN every 03 and 04 business process test WHEN run THEN it passes with the same expected messages as before (protects existing behaviour).

Group checkout in 03

Event names below are the JVM and Node.js ones; in .NET they are its own counterparts (`GuestCheckoutCompleted`, the group checkout's `GuestCheckOutFailed`), which this spec doesn't rename.


2. A 03 group checkout in progress records a repeated guest result, because that's 04's topic.
   2.1. GIVEN a 03 saga, process manager or choreography solution in any repository and flavour, a group checkout in progress for guests A and B AND A's completion recorded WHEN A's completion is recorded again THEN `GuestCheckoutCompletionRecorded` for A is published again.
   2.2. GIVEN the same WHEN A's failure is recorded twice THEN `GuestCheckoutFailureRecorded` for A is published twice.
3. A finished 03 group checkout ignores later results.
   3.1. GIVEN a 03 saga, process manager or choreography solution in any repository and flavour, and a group checkout for A and B that completed WHEN A's completion is recorded again THEN nothing is published and no error is thrown.
   3.4. GIVEN a 03 to-do list solution in any repository and a group checkout for A and B that completed (and so was removed from the list) WHEN `GuestCheckedOut` for A with that group checkout id is published again THEN no `GroupCheckoutCompleted` or `GroupCheckoutFailed` is published, no error is thrown, and the list is unchanged.
   3.5. GIVEN a 03 to-do list solution WHEN `GuestCheckedOut` with a group checkout id that was never on the list is published THEN no error is thrown and the list is unchanged (the existing "not on the to-do list" test, now expecting this).
   3.2. GIVEN a group checkout that failed WHEN any guest result is recorded THEN nothing is published.
   3.3. GIVEN the .NET 03 aggregates saga or the .NET 04 aggregates solution WHEN the group checkout completes or fails THEN its status is completed or failed, so 3.1 and 3.2 hold.
4. A repeated check-in or initiation before 04 is neither ignored nor rejected.
   4.1. GIVEN a checked-in guest stay account in a 02 solution or a 03 exercise or solution, any repository WHEN the same guest is checked in again THEN no error is thrown and `GuestCheckedIn` is published again.
   4.2. GIVEN an initiated group checkout in a 03 solution, any repository WHEN the same group checkout is initiated again THEN no error is thrown and `GroupCheckoutInitiated` is published again.
5. The existing tests keep passing (protects existing behaviour).
   5.1. GIVEN every 02 and 03 solution in every repository WHEN its tests run THEN they pass.

Node.js 03 aggregates saga solution

6. A Node.js attendee who chose aggregates has a 03 saga solution to compare with.
   6.1. GIVEN the Node.js 03 solutions WHEN listed THEN there is a `solution1_sagas` folder with `solution1_aggregates` and `solution2_immutableEntities` subfolders, as in JVM, and no `solution1_saga` folder.
   6.2. GIVEN the aggregates saga solution WHEN its business process, group checkout entity definition and guest stay entity definition tests run THEN all pass, with the same test names as the other 03 solutions.
   6.3. GIVEN it and the JVM aggregates saga solution WHEN compared THEN the saga handles the same events and sends the same commands, and the group checkout aggregate publishes the same events for the same commands.

04 exercise is the 03 saga solution

7. An attendee starting 04 finds the code they finished in 03.
   7.1. GIVEN a 04 exercise and the 03 saga solution of the same repository and flavour WHEN their module code is compared THEN the only differences are: no "finished" check in the group checkout, the guest list kept in the `Finished` state (Node.js immutable entities only), and charge and payment ids in commands and events (.NET, JVM).
   7.2. GIVEN a 04 exercise and the 03 saga solution of the same repository WHEN their tools are compared THEN the only difference is the message bus option to deliver every message twice.
   7.3. GIVEN a 04 exercise and its 04 solution WHEN compared THEN the tools are the same, and the module code differs only by the idempotency handling.
   7.4. GIVEN a 04 exercise in any repository WHEN the same group checkout is initiated twice THEN `GroupCheckoutInitiated` is published twice.
   7.5. GIVEN a 04 exercise WHEN the same guest is checked in twice THEN `GuestCheckedIn` is published twice and no error is thrown.
   7.6. GIVEN a 04 exercise WHEN the same charge id or the same payment id is sent twice THEN `ChargeRecorded` or `PaymentRecorded` is published twice.
   7.7. GIVEN a 04 exercise and a guest checked out for a group checkout WHEN the same checkout is sent again THEN the guest checkout failure event (guest not checked in) is published, because checking out a checked-out guest is a business rule, not a duplicate check.
   7.8. GIVEN a 04 exercise and a group checkout in progress for guests A and B WHEN A's completion is recorded twice THEN `GuestCheckoutCompletionRecorded` for A is published twice.
   7.9. GIVEN a 04 exercise and a group checkout for A and B that completed WHEN B's completion is recorded again THEN `GuestCheckoutCompletionRecorded` for B and `GroupCheckoutCompleted` are published again.
8. An attendee starting 04 sees which tests are theirs to make pass.
   8.1. GIVEN a 04 exercise WHEN all its tests run THEN the business process, group checkout entity definition and guest stay entity definition tests pass, and the idempotency tests fail.
   8.2. GIVEN a 04 solution WHEN all its tests run THEN all pass.
   8.3. GIVEN the Node.js 04 immutable solution WHEN read THEN it has no "Group checkout already initiated!" throw.

04 tests

9. Every facade method keeps its idempotency test (protects existing behaviour).
   9.1. GIVEN the group checkout idempotency tests WHEN read THEN there is one each for initiate (initiated once for the same id), record completion (recorded once), record failure (recorded once), and the last completion recorded twice (the group checkout completes once).
   9.2. GIVEN the guest stay account idempotency tests WHEN read THEN there is one each for check in (checked in once), record charge (once for the same charge id), record payment (once for the same payment id) and check out (once for the same group checkout).
   9.3. GIVEN the variant folder idempotency tests WHEN read THEN the only one is: the whole process completes once when the bus delivers every message twice, with the full list of published messages.
   9.4. GIVEN any of these tests WHEN compared before and after THEN its steps and expected messages are the same.
10. .NET aggregates has no leftover group checkout initiation on the guest stay facade.
    10.1. GIVEN the .NET 03 aggregates saga solution and the .NET 04 aggregates exercise and solution WHEN the guest stay facade is read THEN it has no group checkout initiation.
    10.2. GIVEN the .NET 04 aggregates tests WHEN read THEN "group checkout for multiple guest stay should be initiated" is gone.
11. 04 runs the group checkout entity definition tests.
    11.1. GIVEN a 04 exercise or solution in any repository and flavour WHEN the group checkout entity definition tests are read THEN they are the five from 03: initiating succeeds; recording a completion succeeds; recording a failure succeeds; the last completion completes the group checkout; the last result after a failure fails it.
    11.2. GIVEN the JVM and .NET 04 before the change WHEN listed THEN these tests are missing, and after the change they are there.
12. Tests sit next to the module they test.
    12.1. GIVEN a 04 exercise or solution in any repository and flavour WHEN listed THEN the variant folder has the business process tests and the bus-delivers-twice test; the group checkouts module has its entity definition and idempotency tests; the guest stay accounts module has its entity definition and idempotency tests.
    12.2. GIVEN any 04 test file WHEN read THEN the test cases come first, setup and helpers below them.
    12.3. GIVEN the same test in two repositories WHEN compared THEN it has the same name (apart from casing), sits in the same module, and has the same steps and expected messages.
    12.4. GIVEN a JVM 04 exercise test WHEN read THEN it has the exercise marker.

Exact message comparison in Node.js

13. A Node.js test fails when a published message differs in any field.
    13.1. GIVEN a test expecting `GuestCheckedOut` with `guestStayAccountId` and `checkedOutAt` WHEN the published `GuestCheckedOut` also carries `groupCheckoutId: undefined` or any other extra field THEN the test fails.
    13.2. GIVEN a test expecting a list of messages WHEN one published message has a field with a different value THEN the test fails.
    13.3. GIVEN the message catcher copies of Node.js 02, 03 and 04, exercises and solutions WHEN read THEN both checks use strict equality; the 05 and 06 copies are unchanged.
    13.4. GIVEN the Node.js solutions WHEN all solved tests run THEN they pass.

Bus-triggered facade methods

20. A command from the bus for a missing entity is ignored.
    20.1. GIVEN any 03 solution (saga, process manager, choreography, to-do list), a facade given in a 03 exercise, or a 04 exercise or solution, any repository and flavour, and no group checkout with id X WHEN the message that records a guest result for X arrives (`RecordGuestCheckoutCompletion` / `RecordGuestCheckoutFailure` in sagas and 04; `GuestCheckedOut` / `GuestCheckoutFailed` with group checkout id X in process managers and choreography) THEN nothing is published and no error is thrown.
    20.2. GIVEN the same and no guest stay account with id A WHEN `CheckOutGuest` for A arrives THEN nothing is published (in Node.js immutable entities also no `GuestCheckoutFailed`) and no error is thrown.

Node.js database

16. A document loaded from the Node.js database is a separate copy, like in JVM and .NET.
    16.1. GIVEN any Node.js database from 02 to 06, exercise or solution WHEN read THEN storing writes `JSONSerializer.serialize(document)` and loading returns `JSONSerializer.deserialize(json, { parseDates: true })`; when the collection has a class, the parsed data is assigned to a new object created with the class's constructor; no other copying.
    16.2. GIVEN the Node.js 06 outbox WHEN an event with `checkedOutAt` is stored and published from the outbox THEN the published event's `checkedOutAt` is a `Date` equal to the stored one (protects existing behaviour: the 06 tests compare published events exactly).
    16.3. GIVEN every Node.js facade that loads an aggregate or a process manager WHEN read THEN its collection is created with that class; facades of immutable entities create theirs without a class.
    16.5. GIVEN the Node.js 03 aggregates exercise group checkout facade WHEN read THEN it creates its collection with the `GroupCheckout` class from `groupCheckouts/groupCheckout.ts`, which extends `Aggregate<GroupCheckoutEvent>` and has only the public constructor with the comment "Public constructor without parameters, used when loading from the database" and an `evolve` that throws "TODO: Fill the implementation"; the exercise type check passes; the 03 immutable entities exercise and the 02 exercise facades create theirs without a class.
    16.6. GIVEN the Node.js 02 exercise facades (`regular` and `emmett`) and the 02 README WHEN read THEN each facade has the TODO "If your guest stay account is a class, pass it here: `database.collection('guestStayAccount', GuestStayAccount)`. It needs a public constructor without parameters" at its `database.collection(...)` call, and the README says the same.
    16.4. (protects existing behaviour) GIVEN every Node.js test from 02 to 06 WHEN run THEN the solutions pass, and in the exercises the same tests fail as before this change.

One Node.js aggregate implementation

17. Every Node.js aggregate is written the same way.
    17.1. GIVEN the Node.js aggregates from 02 to 06, exercises and solutions WHEN read THEN they extend one aggregate base class implementation with a `#` uncommitted events field and normal methods, their own methods are normal methods with `private` state fields, they have a public constructor without parameters with the comment "Public constructor without parameters, used when loading from the database", the base classes' `#` pending field has the comment "Not stored, so it's empty after loading", and their factories are static methods; no arrow-function properties. The 03 process managers extend `ProcessManager`, written the same way (a `#` uncommitted messages field, normal methods), and their factory `initiate` is a static method.
    17.3. GIVEN a Node.js aggregate or process manager with pending events or messages WHEN it is stored and loaded again THEN the stored JSON has no pending events or messages, the loaded one has none, and every facade dequeues before storing; e.g. checking in a guest and then recording a charge publishes `GuestCheckedIn` once and `ChargeRecorded` once (protects existing behaviour: the entity definition tests check exactly this with strict comparison).
    17.2. GIVEN the 02 aggregates solution, the 03 aggregates exercise and the 03 process managers WHEN their tests run THEN they pass as before (protects existing behaviour; exercise tests that fail today still fail).

Node.js group checkout guest list

18. The Node.js group checkout guest list survives JSON.
    18.1. GIVEN every Node.js group checkout from 03 to 06, both flavours, exercises and solutions, and the 03 to-do list's group checkout document WHEN read THEN its guest list is a `Record<string, CheckoutStatus>`, not a `Map`; aggregates and process managers change it in place, immutable entities create new state.
    18.2. GIVEN a group checkout for A and B stored and loaded again WHEN A's completion is recorded THEN `GuestCheckoutCompletionRecorded` for A is published and B is still in progress (protects existing behaviour: the business process and entity definition tests cover it).

Node.js expected message types

19. The Node.js tests don't type their expected message lists.
    19.1. GIVEN every Node.js test file from 03 to 06, exercises and solutions WHEN read THEN no call passes a type argument to `shouldReceiveMessages`, and no test file declares `type ExpectedTypes`.
    19.2. GIVEN the message catcher copies WHEN read THEN their `shouldReceiveMessages` signature is unchanged.
    19.3. GIVEN the Node.js workshop WHEN the type check runs THEN it passes.

README

14. An attendee reading the 04 README finds the tests.
    14.1. GIVEN the 04 README in any repository WHEN read THEN one short paragraph says the business process and bus-delivers-twice tests are in the variant folder and the module tests sit next to the module's code, and it links each test file for each variant.
    14.2. GIVEN any link in it WHEN followed THEN it opens an existing file.

Verification

15. Nothing else broke.
    15.1. GIVEN JVM WHEN the solved tests run without cache THEN all pass, and the exercises compile.
    15.2. GIVEN .NET WHEN all tests run THEN every solution project passes, and the only failures are exercise tests expected to fail.
    15.3. GIVEN Node.js WHEN the solved tests, type check and lint run THEN they pass.
    15.4. GIVEN any test run WHEN its output is read THEN it has no new warnings.

## Implementation Decisions

- The model for 04 is the JVM 04 exercise and solution; JVM is the reference for structure. The model saga is the .NET order saga sample (Q11).
- Saga: an object built with the message bus (in Node.js a function returning an object of handlers, per the module pattern), one handler per event, each sending commands through the bus. `SagaResult` is removed from 03 and 04.
- Group checkout in 03: finished ignores later results (every 03 solution, the to-do list included); in progress records every result. The 04 exercise has neither check; the 04 solutions have both.
- No other duplicate handling in 02 or 03. Node.js `evolve` status checks narrow the state type and stay (Q9).
- The 04 exercise of each flavour is the 03 saga solution of that flavour without the "finished" check (Node.js immutable: with the guest list kept in `Finished`), plus charge and payment ids where missing, the deliver-twice bus option and the 04 tests. Its tools are the 03 tools plus the deliver-twice option; the 04 solution uses the same tools. Shared code used only by the Kafka and RabbitMQ solutions isn't part of the 03 saga solution.
- The Node.js 03 aggregates saga follows the one Node.js aggregate implementation and the structure of the JVM aggregates saga (Q23).
- .NET aggregates: group checkout initiation leaves the guest stay facade in 03 and 04, with its only test.
- Node.js message catcher in 02–04: strict equality for the single-message and the message-list check.
- Node.js database in 02–06: Emmett `JSONSerializer` (`parseDates: true`), optional class per collection: the parsed data is assigned to an object created with its public constructor; no other copy. Emmett is already a workshop dependency.
- Node.js aggregates in 02–06: one base class implementation (normal methods, `private` state fields, `#` pending events or messages), a public constructor without parameters for serialization, static methods as factories; aggregates stay classes (Q15, Q33).
- Node.js collection class parameter: `type?: new () => T` (Q33).
- Node.js group checkout guest list in 03–06: `Record<string, CheckoutStatus>`.
- Node.js tests in 03–06: no type argument to `shouldReceiveMessages`, no `ExpectedTypes` aliases (Q24).
- Test layout and the group checkout entity definition tests in 04: as in 03 of the same repository.
- Work order: JVM, then .NET, then Node.js.

## Testing Decisions

- Tests check behaviour through the facades and the messages caught by the message catcher, as every workshop test does. No new seam.
- No new 03 tests (Q8): idempotency is tested per facade method in 04 (Q6). The one changed 03 test is the to-do list's "not on the to-do list" test (Q14). Acceptance criteria 1.3, 1.4, 2–4 and 20 are checked once during the work and aren't kept as tests.
- The 04 idempotency tests keep their content and move to their module. The group checkout entity definition tests in 04 are copied from the same repository's 03, same flavour.
- Test first: every 04 idempotency test fails against the 04 exercise and passes against the 04 solution.
- Prior art: the .NET order saga sample for the saga shape; Node.js 04 test files (which test goes where); each repository's 03 group checkout entity definition tests.

## Out of Scope

- Exercises 05 and 06 (Q9), including their sagas, except the Node.js database, aggregates, group checkout guest list and the type argument in tests (Q18, Q19, Q21, Q24).
- The Kafka and RabbitMQ solutions in JVM 03, including their sagas and copies of the group checkout code (Oskar, 2026-11-16: that work goes last). Acceptance criteria 1–3 don't apply to them.
- The other differences in `alignment.md`.

## Further Notes

- The other Node.js 03 solution folders (`solution2_process_managers`, `solution3_choreography`, `solution4_todo_list`) keep their names; only the saga folder is asked about (Q10).
- The step 4 review's to-do list test finding: the test stays as it is (Q16: "we test outside in").
- A dead-letter queue for messages that can't be handled is a candidate for a later exercise (Q27).
