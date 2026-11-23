# EDA workshop: exercise 06 Consistency aligned in Node.js, .NET and JVM

Revision: 1

Based on `qa.md` Q1–Q14 in this folder, and on the 05 decisions in `../eda-05-optimistic-concurrency/qa.md` (Q40–Q72) and `../eda-05-optimistic-concurrency/spec.md` r27, which Oskar asked to apply to 06 "accordingly". A 05 question is cited as `05-Q<n>`, a 04 one as `04-Q<n>`.

## Problem Statement

Exercise 06 teaches that storing state and publishing messages are two separate writes that can fail separately, and that a transactional outbox keeps what is published in line with what is stored. An attendee should get the same exercise in Node.js, .NET and JVM, and it should start from the code they finished in 05.

Today 06 starts from a version older than the 04 solution, in every repository:

- the guest stay account doesn't ignore repeated commands, the idempotency tests are the 3 old group checkout ones, there is no "bus delivers every message twice" test, and .NET and JVM have no charge or payment ids;
- the saga has the old shape (JVM `SagaResult`, Node.js and .NET return commands that the wiring publishes);
- JVM and .NET keep the tests in one file per kind at the variant root;
- Node.js has only immutable entities; .NET and JVM pair each outbox style with one flavour (aggregates publish asynchronously, immutable entities publish right away);
- the Node.js message catcher doesn't compare exactly, and its race test uses `Promise.allSettled`.

The 06 tools also let the code cheat. The facades, the outbox jobs and the saga wiring retry every failed write and publish in a loop (`retryUntilSucceeds`, `Retry.untilSucceeds`, `Retry.UntilSucceeds`), so a failure never reaches anything that has to cope with it (Q7). The failures land at random, so some exercise tests pass by luck: check-in and initiation pass every run, six more pass in some runs (Q3). And today's "publish right away" solution, without that loop, loses events when the publish and the fallback outbox write both fail (Q11).

The goal: the 06 exercise of each flavour is the 05 "retry in the infrastructure" solution of that flavour plus the 06 tools; the database and the bus fail honestly and no code retries an outage; the bus redelivers like a real one; the attendee adds a transactional outbox; there are two solutions, both with the outbox, in both flavours and all three repositories.

## Solution

**The 06 exercise is the 05 "retry in the infrastructure" solution plus the 06 tools (Q1, Q2).** Its module code (group checkouts, guest stay accounts, saga, wiring) and its aggregate store (aggregates) and command handler (immutable entities), with their tests, are the 05 solution's. So everything 04 and 05 settled is there: the 04 guards and the charge and payment ids, the 04 saga shape (no `SagaResult`), the missing-entity rule, the "not existing" status of immutable entities, the conflict retry (up to 10 attempts) in the aggregate store and command handler, asynchronous Node.js with `MaybePromise`, the exact message catcher, tests next to the module they test with `// Given`, `// When`, `// Then`, and the one set of names. Both flavours exist in every repository, so Node.js gets aggregates in 06. The facades also get the background jobs tool, so the attendee can register a job.

**The 06 tools are the 05 tools plus what 06 adds,** and they behave like real infrastructure (Q3, Q4, Q7–Q10, Q14):

- **Outages happen only while the system works on its own (Q9).** A facade call made straight from a test, with every write and publish it makes, never fails. While a bus handler runs, or a background job runs, the database and the bus fail: the first write of each document (a store, a delete, or a transaction commit that includes it) and the first publish of each message type always fail; after that each write and each publish fails with a 1 in 3 chance, independently of the one before, so the same call can fail several times in a row (Q3, Q4). A failure throws the existing `TimeoutException` / `TimeoutError` and changes nothing.
- **The bus behaves like a real bus (Q7, Q8).** During an outage `publish` fails at once, before delivering anything, and the publisher gets the error. Once a message is accepted, the bus gives it to every middleware (the message catcher) once and to every handler; when a handler throws, the bus hands the message to that handler again, until the handler succeeds, at most 10 times in all; after the 10th failure it gives up on that message for that handler, as a real bus moves it to a dead-letter queue, and the publisher doesn't get the handler's error. The "deliver every message twice" option from 04 stays.
- **Background jobs run by themselves (Q14).** A facade registers a job with the background jobs tool, and the tool runs every registered job again and again, with a short pause, from the moment the test sets it up until the test ends, as an application's scheduler does. A job that throws is run again next time. Tests never run jobs themselves; `runBackgroundJobsUntilIdle` and its calls go.
- **The message catcher waits (Q9).** Its checks wait until the expected messages have been published and fail when 5 seconds pass without them. It ignores an exact repeat of a message it already caught (Q10). Otherwise it compares as in 05: exact fields, any order where the 05 check allowed it, and it fails on a missing, wrong or unexpected message.
- **The database** keeps the 05 versioned database, its transaction and the 06 `getAll` that returns stored entries with their position.
- **No retry on outages.** The tools have no `retryUntilSucceeds` / `Retry.untilSucceeds` / `Retry.UntilSucceeds`; the conflict retry from 05 stays.

**What fails in the exercise.** The saga asks a guest stay to check out; the account is stored as checked out; publishing `GuestCheckedOut` fails (it is the first publish of that type, so it always does); the handler throws, the bus hands `CheckOutGuest` back, and the 04 guard sees an account that is already checked out and produces nothing. `GuestCheckedOut` is gone, the group checkout never completes, and the business process tests fail at the deadline, every run. That is the dual write 06 teaches. The module tests (entity definition, idempotency, concurrency) call the facades straight, so nothing fails in them and they pass in the exercise, as the 04 tests pass in the 05 exercise.

**What the attendee does.** Add a transactional outbox to the aggregate store and the command handler: store the state and its events in the module's outbox in one database transaction, and publish from the outbox. Then a failed attempt leaves nothing behind, the bus's redelivery or the next job run tries again, and no event is ever lost. Publishing from the outbox delivers at least once: a job that publishes a message and then fails to record that leaves it to be published again. The 04 guards make that harmless.

**Two solutions, each in both flavours (Q2b, Q11, Q12).** Both store the state and its events in the outbox in one transaction, inside the conflict retry, in the aggregate store or command handler; the facades no longer publish the events.

1. **Publish in order.** Only the background job publishes. It reads the module's outbox messages stored after its checkpoint, in the order they were stored (by position), publishes them one at a time, and stores the position of each published message as the checkpoint. Published messages stay in the outbox. The order is kept.
2. **Publish in any order.** Right after the transaction commits, the aggregate store or command handler publishes the events itself, one at a time, and removes each published one from the outbox. When a publish or a removal fails, it stops and leaves the rest in the outbox, without an error: the state and the events are already safe. The background job publishes whatever is left in the module's outbox and removes each published message. Events reach the bus sooner, but the order isn't kept.

Today's "publish right away" (store the state, publish, and write the outbox only when the publish fails) is not a solution, because it gives no guarantee: when the publish and the outbox write both fail, the events are lost (Q11). The solutions README says so.

```
05 "retry in the infrastructure" solution (aggregates | immutable entities)
   │  + 06 tools: failing database and bus, redelivering bus,
   │    background jobs that run by themselves, waiting catcher
   ▼
06 exercise (aggregates | immutable entities)
   │  + transactional outbox in the aggregate store / command handler (attendee)
   ▼
06 solutions: publish_in_order, publish_in_any_order (each: aggregates | immutable entities)
```

**Each module has its own outbox,** as today in JVM: a message is stored with the outbox's id, its type and its serialized data, as a database table would hold it, and the checkpoint is stored per outbox. JVM is the reference, so .NET and Node.js store it the same way.

**The READMEs.** The exercise README describes the honest failures, the redelivering bus, the background jobs that run by themselves, the waiting catcher, and the goal; it no longer mentions running background jobs from the tests or retrying until success; it says where the tests are and links them, as the 05 README does. The solutions README describes the two solutions, says why "publish, and write the outbox only on failure" is not a solution (Q11), says that the outbox delivers at least once and that the 04 idempotency handles it (Q10), and says what the tests don't simulate: a bus that stays down for a long time and a process that stops between storing and publishing; the outbox is what keeps events safe then (Q5). Its "Don't build it on your own" section stays.

## Acceptance criteria

Event and type names are the ones all three repositories share after the naming alignment.

06 exercise is the 05 solution

1. An attendee starting 06 finds the code they finished in 05.
   1.1. GIVEN a 06 exercise and the 05 "retry in the infrastructure" solution of the same repository and flavour WHEN their module code, aggregate store and command handler are compared THEN the only differences are that the facades receive the background jobs tool and anything the 06 tools' signatures need (for example Node.js awaiting the catcher's checks).
   1.2. GIVEN a 06 exercise and the 05 solution tools of the same repository WHEN compared THEN the 06 tools have every 05 operation, plus `getAll` with positions, the background jobs tool, the failures, the redelivery and the waiting catcher; they have no `retryUntilSucceeds`, `Retry.untilSucceeds` or `Retry.UntilSucceeds`.
   1.3. GIVEN a 06 exercise or solution in any repository WHEN listed THEN it has both flavours (aggregates and immutable entities); Node.js 06 has aggregates.
   1.4. GIVEN a 06 exercise or solution WHEN the saga is read THEN it is the 05 saga: built with the message bus, one handler each for `GroupCheckoutInitiated`, `GuestCheckedOut` and `GuestCheckoutFailed`, each sending its commands through the bus; there is no `SagaResult` and the wiring subscribes the handlers with no retry around them.
   1.5. GIVEN a 06 exercise or solution and the same command sent twice one after another WHEN handled THEN it is handled once, as in 05; GIVEN no guest stay account A WHEN a charge or payment is recorded for A THEN "Entity not found" is thrown; WHEN `CheckOutGuest` for A arrives from the bus THEN nothing is published and no error is thrown; GIVEN no group checkout X WHEN a guest result for X arrives from the bus THEN nothing is published and no error is thrown.
   1.6. GIVEN the JVM and .NET immutable entities in 06 WHEN read THEN their initial state carries the "not existing" status, as in 05.

The 06 tools

2. The database and the bus fail like real ones, only while the system works on its own (Q3, Q4, Q9).
   2.1. GIVEN a facade method called straight from a test WHEN it stores, deletes, commits or publishes THEN none of those calls fail.
   2.2. GIVEN a bus handler or a background job running WHEN it writes a document for the first time (a store, a delete, or a commit that includes it) THEN the write fails with the timeout exception and changes nothing; WHEN it publishes a message type for the first time THEN the publish fails before delivering anything.
   2.3. GIVEN a bus handler or a background job running WHEN it writes or publishes after those first failures THEN each call fails with a 1 in 3 chance, independently of the one before, so two or more failures in a row happen.
   2.4. GIVEN the tools of any repository WHEN searched THEN no code retries a timeout in a loop.
3. The bus redelivers like a real bus (Q7, Q8).
   3.1. GIVEN a subscribed handler that throws on its first delivery WHEN a message is published THEN the bus hands it the same message again until it succeeds; the message catcher gets the message once; the publish doesn't throw.
   3.2. GIVEN a handler that throws every time WHEN a message is published THEN the bus hands it the message 10 times in all, then stops, and the publish doesn't throw.
   3.3. GIVEN the bus during an outage (2.2, 2.3) WHEN `publish` is called THEN it throws before any middleware or handler sees the message.
   3.4. GIVEN the "deliver every message twice" option WHEN a message is published THEN every handler gets it twice, as in 05.
4. Background jobs run by themselves (Q14).
   4.1. GIVEN a job registered with the background jobs tool WHEN the test runs THEN the tool runs the job again and again until the test ends, with no call from the test.
   4.2. GIVEN a job that throws WHEN it runs THEN the tool runs it again next time, and the error doesn't stop the other jobs.
   4.3. GIVEN any 06 test WHEN read THEN it doesn't run background jobs itself; `runBackgroundJobsUntilIdle` / `RunUntilIdle` / `runUntilIdle` doesn't exist.
   4.4. GIVEN a test that ended WHEN its background jobs tool is stopped THEN no job runs after it.
5. The message catcher waits and ignores exact repeats (Q9, Q10).
   5.1. GIVEN expected messages that are published 1 second after the check starts WHEN the check runs THEN it passes once they arrive.
   5.2. GIVEN expected messages that are never published WHEN the check runs THEN it fails after 5 seconds, listing the expected and the caught messages.
   5.3. GIVEN a message caught twice with the same content WHEN the check expects it once THEN it passes.
   5.4. GIVEN a caught message with a wrong or extra field, or a caught message nobody expected WHEN the check runs THEN it fails, as in 05.

The exercise

6. An attendee starting 06 sees which tests are theirs to make pass.
   6.1. GIVEN a 06 exercise in any repository and flavour WHEN all its tests run THEN the entity definition, idempotency, concurrency, aggregate store and command handler tests pass, and the business process tests and the "bus delivers every message twice" test fail.
   6.2. GIVEN a 06 exercise WHEN its tests run 50 times THEN the business process tests and the "bus delivers every message twice" test fail in every run; GIVEN either 06 solution WHEN its tests run 50 times THEN every test passes in every run; the counts are written down once (no lasting test), as in 05.
   6.3. GIVEN the 06 exercise WHEN a business process test fails THEN the failure says which expected messages never arrived, for example `GuestCheckedOut` and `GroupCheckoutCompleted`.

The solutions

7. Both solutions keep every state change and every event (Q11, Q12).
   7.1. GIVEN the 06 solutions in any repository WHEN listed THEN there are two solution folders, each with both flavours, the shared tools at the 06 root, and each solution's own `core/` with its aggregate store, command handler and outbox code, used by both its flavours: JVM `e06_consistency/publish_in_order/{solution1_aggregates, solution2_immutableentities}` and `publish_in_any_order/...`; .NET `Solutions/06-Consistency/PublishInOrder/{Version1-Aggregates, Version2-ImmutableEntities}` and `PublishInAnyOrder/...`; Node.js `solved/06_consistency/regular/solution1_publish_in_order/{solution1_aggregates, solution2_immutableEntities}` and `solution2_publish_in_any_order/...`, as the Node.js 05 solutions are laid out.
   7.2. GIVEN either solution WHEN a command produces events THEN the aggregate store or command handler stores the state with the loaded version and the events in the module's outbox in one transaction, inside the conflict retry; GIVEN that transaction fails THEN neither the state nor the events are stored.
   7.3. GIVEN either solution WHEN a command produces no events THEN nothing is stored and nothing goes to the outbox.
   7.4. GIVEN either solution WHEN a facade method runs THEN it doesn't publish events itself and has no retry on timeouts.
   7.5. GIVEN "publish in order" WHEN its background job runs THEN it publishes the module's outbox messages stored after its checkpoint, by position, one at a time, and stores the position of each published message as the checkpoint; published messages stay; when a publish or a checkpoint write fails, the job throws and the next run starts from the stored checkpoint.
   7.6. GIVEN "publish in any order" WHEN the transaction commits THEN the aggregate store or command handler publishes the events at once, one at a time, removing each published one from the outbox; when a publish or a removal fails it stops without an error, and the rest stays in the outbox.
   7.7. GIVEN "publish in any order" WHEN its background job runs THEN it publishes every message left in the module's outbox and removes each one after publishing it; when a publish or a removal fails, the job throws and the next run tries again.
   7.8. GIVEN either solution WHEN an outbox message is published twice (a failed checkpoint write or removal) THEN the receiving handlers ignore the repeat through the 04 guards, and the business process tests still pass.
   7.9. GIVEN each module WHEN it stores outbox messages THEN they carry that module's outbox id, the message type and the serialized data, and the background job of a module publishes only its own outbox's messages.
   7.10. GIVEN both solutions, any repository and flavour, WHEN their tests run THEN each has the full set of 06 tests and all pass, on repeated runs.

Tests

8. 06 runs the 05 tests, adapted only to the waiting catcher (Q9, Q14).
   8.1. GIVEN a 06 exercise or solution WHEN its tests are read THEN they are the 05 "retry in the infrastructure" solution's tests of the same repository and flavour (business process, "bus delivers every message twice", entity definition with the missing-account tests, idempotency, the seven concurrency tests, the aggregate store and command handler tests), with the same names, steps and expected messages; the only changes are that they don't run background jobs and that they use the waiting catcher.
   8.2. GIVEN any 06 test file WHEN listed and read THEN it sits next to the module it tests, as in 05, the test cases come first, and each test has `// Given`, `// When`, `// Then`.
   8.3. GIVEN a JVM 06 exercise test WHEN read THEN it has the exercise marker, as in 05.
   8.4. GIVEN the Node.js 06 charge-racing-checkout test WHEN read THEN it ignores only a plain `Error`, as in 05, and there is no `Promise.allSettled` in 06.
   8.5. GIVEN the Node.js 06 tests WHEN read THEN each awaits the catcher's checks, and the test framework's timeout is longer than the catcher's 5-second deadline.
9. The new behaviour has its own tests (Q65 of 05: infrastructure is tested on itself).
   9.1. GIVEN each repository's 06 tools WHEN their tests run (in the tools folder, next to the tools, without the exercise marker, the same in the exercise and solved copies) THEN they show 2.1–2.3, 3.1–3.4, 4.1, 4.2, 4.4 and 5.1–5.4, with the same names and steps in all three repositories.
   9.2. GIVEN each solution's `core/` WHEN its aggregate store and command handler tests run THEN, besides the 05 cases, they show 7.2, 7.3 and, per solution, 7.5–7.7, the same in all three repositories.
   9.3. GIVEN the JVM `Database` tests of 05 WHEN 06 is listed THEN the same tests are next to the 06 `Database`, in the exercise and solved copies.

README

10. An attendee reading the 06 READMEs knows what to do and why.
    10.1. GIVEN the 06 exercise README in any repository WHEN read THEN it describes: the failures (only while the system works on its own; first write of each document and first publish of each message type, then 1 in 3), the bus that hands a failing handler the message again, the background jobs that run by themselves, the catcher that waits; the goal (never lose a state change or an event); the transactional outbox; and it doesn't mention running background jobs from tests, `retryUntilSucceeds` or "publish right away".
    10.2. GIVEN the 06 exercise README WHEN read THEN one short paragraph says where the tests are and links each test file for each variant; every link opens an existing file.
    10.3. GIVEN the 06 solutions README WHEN read THEN it describes the two solutions, says why "publish, and write the outbox only on failure" is not a solution, says the outbox delivers at least once and the 04 idempotency handles it, says what the tests don't simulate (a long bus outage, a process stopping between store and publish), and keeps "Don't build it on your own"; every link opens an existing file.
    10.4. GIVEN the three repositories' 06 READMEs WHEN compared THEN they say the same things, apart from language and links.

Verification

11. Nothing else broke.
    11.1. GIVEN JVM WHEN the solved tests run without cache THEN all pass, and the exercises compile.
    11.2. GIVEN .NET WHEN all tests run THEN every solution project passes, and the only failures are 06 exercise tests expected to fail (6.1).
    11.3. GIVEN Node.js WHEN the solved tests, type check and lint run THEN they pass.
    11.4. GIVEN any test run WHEN its output is read THEN it has no new warnings.
    11.5. GIVEN 01–05 in every repository WHEN compared before and after THEN they are unchanged.

alignment.md

12. `alignment.md` describes 06 as it is after this work.
    12.1. GIVEN `alignment.md` WHEN its 06 section is read THEN it says what 06 teaches, what its tests prove and its model after this work (06 exercise = 05 "retry in the infrastructure" solution plus the 06 tools; two solutions per flavour: publish in order and publish in any order), and no longer lists the gaps this work closed; item 1 of "What I'd do, in order", item 2 (Node.js 06 catcher) and the 06 half of item 7 (Node.js aggregates variant in 06) are gone.

## Implementation Decisions

- The model is JVM, as for 05; work order JVM, then .NET, then Node.js.
- 06 exercise of each flavour: the 05 "retry in the infrastructure" solution of that flavour (modules, saga, wiring, aggregate store, command handler and all their tests), plus the 06 tools; the facades receive the background jobs tool. The aggregate store and command handler sit where the 05 solution's own `core/` puts them relative to the flavours: JVM in the exercise's `e06_consistency/core/` with the tools, .NET in `06-Consistency/Core/`, Node.js in `06_consistency/regular/core/` next to the flavours (the Node.js exercise gets the 05 `regular/` level).
- 06 tools: the 05 tools of the same repository (versioned database with its transaction, the 05 message catcher, the conflict retry, the "deliver twice" option, JVM `Database` tests) plus `getAll` with positions, the timeout exception, the failures, the redelivery, the background jobs tool and the waiting catcher. `retryUntilSucceeds`, `Retry.untilSucceeds`, `Retry.UntilSucceeds`, JVM `SagaResult` and `runBackgroundJobsUntilIdle` / `RunUntilIdle` / `runUntilIdle` go.
- Failures: the database and bus know whether the current call runs inside a bus handler or a background job (JVM and .NET per thread / async flow, Node.js with `AsyncLocalStorage`), and fail only there. Inside: the first write of each document and the first publish of each message type fail; then each write and publish fails with a 1 in 3 chance. A transaction commit counts as a write of every document it includes. This makes Q3's "first write and first publish always fail" hold for every document and message type, so the exercise's first guest checkout always loses its `GuestCheckedOut` (6.2).
- Bus: `publish` checks the outage before anything; then for each message: each middleware once, then each handler, handing the message to a throwing handler again, up to 10 times in all, then dropping it for that handler. Handler errors don't reach the publisher.
- Background jobs tool: runs every registered job in a loop with a short pause (a few milliseconds) from its creation; a throwing job is run again next time; the test stops it when it ends (JVM `AutoCloseable` / `@AfterEach`, .NET `IAsyncDisposable`, Node.js `afterEach`).
- Message catcher: every check waits up to 5 seconds, polling what has been caught; it ignores exact repeats; Node.js checks return promises; JVM and .NET stay safe for parallel calls.
- Outbox: one per module, identified by a fixed id; each message stored with the outbox id, the message type and the serialized data; the checkpoint ("publish in order") is stored per outbox id. JVM's `OutboxMessage` / `OutboxCheckpoint` are the reference; .NET and Node.js do the same.
- "Publish in order" and "publish in any order" differ only in their `core/` (aggregate store, command handler, outbox job); their modules, saga and wiring are the same.
- No timeout retry anywhere in module, solution or tool code; the conflict retry (10 attempts) stays in the aggregate store and command handler.
- Node.js 06 follows the Node.js 05 layout (`regular/`, `solutionN_` prefixes); JVM and .NET follow their 05 layout.

## Testing Decisions

- Tests check behaviour through the facades and the messages caught by the message catcher, as every workshop test does. Infrastructure is tested on itself, as in 05 (05-Q65): the 06 tools (failures, redelivery, background jobs, catcher), the JVM `Database`, and each solution's aggregate store and command handler.
- The 05 tests carry over unchanged in names, steps and expected messages; they change only to drop `runBackgroundJobsUntilIdle` and to use the waiting catcher.
- Test first: the tools tests fail against today's 06 tools and pass after; the business process tests fail against the exercise every run and pass against both solutions every run (50-run check).
- Every new test goes to all three repositories with the same name and steps (05-Q49).
- No test for a long bus outage or a process stopping between store and publish (Q5).
- Prior art: the 05 "retry in the infrastructure" solution's tests and `core/` tests; the JVM 05 `DatabaseTest`.

## Out of Scope

- A test for a long bus outage and a switch to turn the bus off (Q5).
- 01–05, already aligned.
- The JVM Kafka and RabbitMQ work, which goes last.
- The Node.js Introduction to Event Sourcing workshop.

## Further Notes

- After this work, 06 is the last exercise of the in-memory track; the broker work follows.
- The empty `solution1_aggregates` and `solution2_immutableentities` folders at the root of the JVM solved 05 are leftovers; they hold no files and are not touched here.
