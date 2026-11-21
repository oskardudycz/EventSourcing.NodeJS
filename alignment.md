# EDA workshop alignment: Node.js, .NET, JVM

For each exercise: what it teaches, what its tests prove, which implementation is the model, and where the other repositories teach something different. Differences that don't change what an attendee learns (language idioms, file layout) are only listed at the end.

Repositories: Node.js `workshops/event_driven_architecture`, .NET `../EventSourcing.NetCore/Workshops/EventDrivenArchitecture`, JVM `../EventSourcing.JVM/workshops/event-driven-architecture`. JVM is the reference, unless it teaches something the exercise isn't about.

State on 2026-11-17: Node.js `migrated_to_current_db` at `ab21cde`, .NET `migrated_to_kurrentdb` at `3c8b01ad`, JVM `migrated_to_kurrentdb` at `880b7fd`, plus today's uncommitted fixes. All solution suites pass (Node.js 239, JVM 365, every .NET solution project).

## 01 Events definition

**Teaches:** describing what happens in the two modules, guest stay accounts and group checkouts, as events.

**Tests prove:** for each module, the attendee wrote five events of five different types. They don't check names or content, which is fine for a first modelling step.

**Model:** JVM. The events go in their own files (one per module), and the test prepares the ids the attendee will need.

**Where the others teach something different:**

- Node.js puts the events in the test file, so the attendee doesn't practise giving each module its own events.

## 02 Entities definition

**Teaches:** turning a command into events through an entity, in two styles: an aggregate that records events and changes its state from them, or an immutable entity where a function decides the events and another evolves the state. The facade loads, decides, stores and publishes.

**Tests prove:** through the guest stay facade, the published events for check-in, charge, payment, payment after a charge, checkout with a settled balance, checkout with an unsettled balance (fails), and group checkout initiation.

**Model:** JVM. It gives an empty entity to fill and shows load / decide / store / publish in three facade methods, so the attendee sees the pattern before writing it. Its aggregate changes state only from events, and its immutable entity has a separate decider and evolve.

**Where the others teach something different:**

- The .NET aggregate changes its fields directly in each method and only records the events. That isn't the event-driven aggregate the exercise is about: its state doesn't come from its events.
- Node.js throws when a guest is checked in twice. That's the 04 question (what to do with a repeated command) answered in 02, and answered differently from 04, which ignores it.
- Node.js and .NET show the facade pattern in one method only.

## 03 Business processes

**Teaches:** coordinating two modules through messages on one bus. The group checkout asks each guest stay to check out, records each result, and completes when all succeed or fails when any fails. The solutions show the styles: saga, process manager, choreography, to-do list (plus transactions in JVM, as the "why not" baseline).

**Tests prove:** the four business process scenarios (no charges, all settled, one settled, none settled) produce the right sequence of commands and events. On their own, the group checkout tests prove initiation, recording a completion or failure, and completing or failing after the last guest, and the guest stay tests prove the 02 behaviour.

**Model:** JVM for the set of solutions (it has every style in both flavours), but not its group checkout guards. The JVM 03 solutions ignore a guest result that was already recorded. No 03 test needs that. It's 04's lesson, which JVM teaches in 03 and then again in 04.

**Where the others teach something different:**

- .NET records guest results even after the group checkout finished. No test catches it, but the solution shows a process that keeps changing after it ended.
- Node.js throws when a group checkout is initiated twice; .NET and JVM overwrite it. Again, that's a 04 question.
- Node.js has no aggregates saga, so an attendee who chose aggregates in 02 has no saga solution to compare with.
- .NET starts the guest checkouts in choreography from a `GroupCheckoutInitiated` handler; Node.js and JVM from the facade. Both are choreography; they just show it differently.

## 04 Idempotency

**Teaches:** a message delivered twice must give the same result as once. That means ignoring a repeated command (check-in, the same charge or payment id, a repeated checkout, a repeated guest result, a repeated initiation), so the whole process works when the bus delivers every message twice.

**Tests prove:** each repeated command is ignored, the last guest result recorded twice completes the group checkout once, and the whole process with a bus delivering everything twice publishes each effect once.

**Model:** any. All three teach the same thing, with the same tests and the same solution guards, in both flavours.

**Gaps:** none. The 04 exercise is the 03 saga solution without the idempotency handling, the solution adds it, and the tests sit next to the module they test, with READMEs that link them (checked on 2026-11-18: JVM solved tests and Node.js solved tests, type check and lint pass, every .NET `Solutions/` project passes, and the 04 exercises fail only in their 18 idempotency tests).

## 05 Optimistic concurrency

**Teaches:** handlers running at the same time must not lose each other's updates. Store with the version you loaded (0 when you create the document), and on a conflict load, decide and store again, up to 10 attempts.

**Tests prove:** seven concurrency tests per flavour, next to the module they test, each starting 10 calls together. Concurrent initiation initiates once, concurrent guest results complete or fail the group checkout correctly, concurrent check-ins check in once, concurrent charges and concurrent payments all count, and a charge racing a checkout never lets an unsettled guest check out. They fail every time in the exercise and pass every time in the solutions.

**Model:** any. The 05 exercise is the 04 solution plus the versioned database (versions, optional expected version on store, a concurrency exception, a load delay), so the business process, entity definition and idempotency tests of 04 are there too. Each flavour has two solutions: retry in the facade (one private helper that every facade method calls) and retry in the infrastructure (an aggregate store or a command handler that loads, runs, stores with the loaded version and retries; the facade passes the business logic and publishes the returned events). A missing entity follows one rule from 02 to 05: a method called directly throws "Entity not found", a method triggered by the bus does nothing. Node.js is asynchronous from 02, as .NET is, and its message catcher compares exactly.

**Gaps:** none. JVM `Database.transaction` is serializable: a commit fails with `ConcurrencyException` if another commit changed a document the transaction read or wrote, and nested transactions are not supported (starting one fails at once).

## 06 Consistency

**Teaches:** storing state and publishing messages can fail separately. Use an outbox so that what is published always matches what is stored, even when the database or bus fails and work is retried.

**Tests prove:** the business process and module tests pass while the database and bus fail at random calls, with background jobs publishing from the outbox.

**Model:** none yet. 06 should start from the 05 solution, as 05 starts from 04, but in every repository it started from an earlier version:

- the guest stay account doesn't ignore repeated commands, and the idempotency tests are the 3 old group checkout ones;
- there is no "bus delivers twice" test;
- .NET and JVM have no charge or payment ids.

So 06 drops idempotency in the one exercise where failures and retries make duplicates certain. An outbox delivers at least once; without the 04 guards a repeated publish double-charges.

**Where the others differ:** Node.js has only immutable entities, in two solutions (publish right away, publish asynchronously). .NET and JVM have both flavours, with aggregates publishing asynchronously and immutable entities publishing right away.

## What I'd do, in order

1. **06 from the 05 solution, in all three:** bring back the 04 guards and tests, the charge and payment ids, and the "bus delivers twice" test, then add the outbox on top. This is the biggest teaching gap. It needs one design answer first: in 06 the background jobs publish, so the "delivers twice" bus has to be the one they publish to.
2. **Node.js 06 message catcher compares exactly,** as 02–05 do.
3. **03 teaches coordination only:** take the repeated-result guard out of the JVM 03 solutions (it stays in 04), and keep "ignore results after the group checkout finished" in every 03 solution (add it in .NET).
4. **Repeated commands are answered in 04 only:** remove the Node.js throws on a repeated check-in (02, 03) and a repeated initiation (03).
5. **.NET aggregates change state from their events,** as in JVM and Node.js, from 02.
6. **01 in Node.js:** events in their own files.
7. **Node.js aggregates saga in 03 and an aggregates variant in 06,** so both flavours have the full path.

Then the agreed layout change: in 04–06, tests go next to the module they test, as in 03 and in Node.js, and the READMEs say so and link them.

Last, after everything else (Oskar, 2026-11-16): the JVM Kafka and RabbitMQ work (`spec-spring-messaging.md`, `todo.md` steps 4–8).

## Differences that don't change what is taught

- **Layout:** in 04–06, .NET and JVM keep one test file per kind at the variant root; Node.js keeps them next to the module, as all three do in 03.
- **Test style:** Node.js tests have no `Given` / `When` / `Then` comments and keep helpers above the tests.
- **Immutable entity shape:** a JVM decider class, Node.js functions per command, .NET methods on the record.
- **JVM facade constructors** take a `Database` in some exercises and a collection in others.
- **Unused code:** JVM `EventEnvelopeBase` and `Database.Collection.getAndUpdate`, .NET 02 `DictionaryExtensions` and `SagaResult.Event`.
- **Scope extras:** JVM transactions and broker sagas; Node.js 01 `typed` / `emmett` solutions and the 02 `emmett` start; .NET `00-Modelling` (empty).

## Fixed on 2026-11-17

- .NET and JVM "all stays settled" test recorded the third guest's charge and payments on the first guest.
- .NET payment error said "charge"; .NET 02 aggregates `CheckOutGuest` didn't inherit the command type.
- JVM 03 immutable exercise commands used different field names from its solution.
- Node.js 03 and 04 READMEs link their test files.

## Fixed on 2026-11-21: one set of names

All three repositories, 01–06, exercises and solutions, use the same names (`specs/eda-naming-alignment/qa.md`): the group checkout events `GuestCheckoutCompletionRecorded` / `GuestCheckoutFailureRecorded` and the guest stay `GuestCheckoutFailed` in .NET; `guestStayAccountId` and `groupCheckoutId` in every command and event; `now` on every command; `openedAt` / `completedAt`; `CheckOutGuest`; `FailureReason` (`InvalidState`, `BalanceNotSettled`) and `GuestStayAccountStatus` (`Open`, `CheckedOut`, `NotExisting`); the group checkout status `Completed` / `Failed`; the group checkout's private `finish`; `GroupCheckout` and `GuestStayAccountFacade` (from 03) in .NET. Node.js lost `guestId` / `roomId`, and its `chargeId` / `paymentId` appear from 04, as in JVM and .NET. Language idioms stay (Node.js `businessLogic.ts` functions and saga `on*` handlers, .NET methods on records).
