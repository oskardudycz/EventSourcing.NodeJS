# Exercise 05 Optimistic concurrency (brainstorm started 2026-11-18)

Idea (Oskar): "I want to now align optimistic concurrency exercises the same way we did for idempotency, could you check our spec and plan and exercises and ask on stuff that are unclear or unknown? Most should be done accordingly"

What 05 looks like today, in all three repositories: the 05 exercise is an older copy of the 04 solution. It still has the `SagaResult` saga (JVM, .NET) or the saga function returning commands (Node.js), throws "Entity not found" for a missing entity, keeps the tests in one file per kind at the variant root (JVM, .NET), has no group checkout entity definition tests next to the module, and the .NET aggregates group checkout never sets its status. The retry helper is only in the solutions, in all three.

Taken as given from the 04 work, unless Oskar corrects it: the 05 exercise of each flavour is the 04 solution of that flavour plus the 05 database (versions, expected version on store, a delay on load, `ConcurrencyException`/`ConcurrencyError`), the facades adjusted to its `get` returning the document with its version, the thread-safe message catcher with its any-order check, and the 05 tests; the 05 solution adds only the expected versions and the retry. So the 04 saga shape, "missing entity is ignored", the .NET status on finish, tests next to the module, the group checkout entity definition tests and the README links all carry over to 05.

## Q40

**Question:** The Node.js database and bus are synchronous in 02–04 and become asynchronous in 05, because in JavaScript two handlers can only overlap at an `await`. So the Node.js 05 exercise changes every facade, the wiring and the tests to `async`, not only adds `.document`, as JVM and .NET do. a) keep it so, async comes with 05; b) make the Node.js database async from 02, so 05 only adds versions.

**Answer (Oskar, 2026-11-18):** "I don't understand why in 05 they will become async", then, after the explanation: "Can't we make it async since the beginning?"

Reading (stated to Oskar for correction): b). From 02 (01 has no database), the Node.js database (`get`, `store`, `delete`) and message bus (`publish`, awaiting each handler) return promises, as the .NET ones do and the Node.js 06 ones already do. Every facade method, the wiring and the tests in 02–04, exercises and solutions, are async and await them. The 05 database then only adds versions and the expected version on store; the 05 exercise facades differ from the 04 solution facades only by reading the document from the versioned result.

Follow-up (Oskar, 2026-11-18): "how introduction to event sourcing does it and .NET with async methods? to this quesions b)". Shown: .NET in-memory tools (EDA 02 and Introduction 20) return `ValueTask.CompletedTask` / `ValueTask.FromResult(...)`, so they are async from the start and finish at once; Node.js Introduction 09–10 are async through KurrentDB, while its in-memory 16–17 are synchronous. So b) in Node.js EDA follows .NET: in 02–04 the database and bus return already-resolved promises; 05 adds versions.

Asked whether b) also covers the Node.js Introduction to Event Sourcing 16–17. **Answer (Oskar, 2026-11-18):** "No, leave introduction untouched"

## Q41

**Question:** Today 05 has five concurrency tests (initiation, completions, completions with a failure, charges, charge racing a checkout); check-in and record payment have none, record failure and checkout only in combination. a) keep the five; b) add a test for check-in and record payment, so each of the seven facade methods has at least one.

**Answer (Oskar, 2026-11-18):** "I told you that B"

So b): every facade method has at least one concurrency test, as every facade method has an idempotency test in 04 (Q6). Added in all three repositories, both flavours: checking in the same guest stay at once checks in once; payments recorded at once all count towards the balance.

## Q42

**Question:** 04 has a whole-process test with the bus delivering every message twice. Should 05 get a bus option to run handlers in parallel and a whole-process test with it? a) no, 05 keeps facade-level tests only; b) yes.

**Answer (Oskar, 2026-11-18):** "a)"

## Q43

**Question:** Shall I write the spec? `spec.md` holds the 04 spec, so I'd rename the 04 spec, plan and todo with a `-04-idempotency` suffix and write the 05 spec as `spec.md`.

**Answer (Oskar, 2026-11-18):** "no, you should keep it in a dedicated folder, so the qa etc"

Done: the 04 files (`qa.md` Q1–Q39, `spec.md`, `plan.md`, `todo.md`, `progress.md`) are in `specs/eda-04-idempotency/`; this Q&A is in `specs/eda-05-optimistic-concurrency/`, where the 05 spec, plan and reviews will go. The empty `reviews/` folder in the repository root is removed.

## Q44

**Question:** Ready for me to write the 05 spec in `specs/eda-05-optimistic-concurrency/spec.md`?

**Answer (Oskar, 2026-11-18):** "yes"

## Q45 (spec r2)

**Question:** The 04 tools are the 03 tools plus deliver-twice, so they carry helpers only 03 solutions use (JVM `Database.transaction`, `Collection.findAll`, `getAndUpdate`; .NET `Database.GetAll`, non-generic `MessageBus.Subscribe(Type, …)`; Node.js `findAll`). The 05 tools don't have them. a) 05 tools are the 04 tools plus what 05 adds, so these come back; b) keep them out of 05.

**Answer (Oskar, 2026-11-18):** "I don't understand, 05 should be built on top 4, so it should be able to handle and support what 04 solutions have"

Checked: no 04 solution code calls these helpers; they are only in the 04 tools. Reading (stated to Oskar for correction): a). The 05 tools are the 04 tools plus what 05 adds; everything the 04 tools offer is in 05 too, working with the versioned database (`transaction` keeps the versions; `findAll`/`GetAll` return the documents; `getAndUpdate` stores without an expected version).

## Q46 (spec r2)

Follow-up (Oskar, 2026-11-18): "Then if they're not called, I don't understand why 04 have them". Explained: all 03 solutions share one tools folder, so it carries helpers only some of them use (to-do list, JVM transactions); 04 copied the 03 tools (04 spec: "Its tools match the 03 saga solution"), so 04 has them unused.

**Question:** a) drop these helpers from 04 and keep them out of 05; b) keep them in 04 and carry them over to 05 (the Q45 reading).

**Answer (Oskar, 2026-11-18):** "ok, then carry them over"

So b): 04 is unchanged, and the 05 tools carry these helpers over, working with the versioned database, as spec r2 says.

## Q47 (spec r3): answers to the spec r2 review

**Questions:** 2) Charge and payment for a missing account: ignore in every facade method, or keep the throw as in 04? 4) Why `findAll` only where it exists? 5) Keep the helpers carried over from 03 (Q46), and Oskar's note on naming.

**Answers (Oskar, 2026-11-19):** On 5 before: "naming should be also the same, so findall instead of getall. Also why do we need it?" Then: "2. The rule is the same also for earlier, exceptions are allowed to be thrown for facade methods not triggered by message bus. I don't see why would it change now. 4. I don't understand why would this specific scenario bring this need. 5. It's fine to copy as we discussed."

So: 2) bus-triggered facade methods ignore a missing entity; the others (record charge, record payment) may throw, as in 03 and 04. 4) No tools gain `findAll`; the spec only makes the existing `findAll` async, like every other database operation. 5) The helpers are carried over (Q46), and .NET `GetAll` is renamed `FindAll`, as in JVM and Node.js, wherever it exists (03, 04, 05, 06 and callers).

## Q48 (spec r4): answers to the spec r3 review

**Questions:** 1) .NET 06 `GetAll` returns stored entries with a position, as JVM and Node.js 06 `getAll`; rename only in 03–05? 2) Node.js immutable charge and payment for a missing account throw "Guest account is already checked out!" (loaded as `initial`), not "Entity not found". 3) AC 1.8 names a scheduled to-do list test that doesn't exist. 4) Give 02–04 the separate `MessageMiddleware` type of 05?

**Answers (Oskar, 2026-11-19):** "1. Are you mad, I asked why do we even need this method, where's the answer? I asked twice. And you didn't even explain why do you want keep it consistent. This is not acceptable. 2. THen fix 04. 3. WTF is scheduled tod-list in terms of 05 exercise we're discussing. 4. WHy does it have it?"

Explained: `findAll`/`GetAll` is called only by the 03 scheduled to-do list; nothing in 04 or 05 calls it; 06 `getAll` is a different operation the outbox uses. The scheduled to-do list is in the spec only because Q40 makes every Node.js 02–04 database caller async. The bus middleware is how tests catch published messages (`messageBus.use(publishedMessages.catchMessage)`). Offered: remove the 03-only helpers from 04 and keep them out of 05, or keep copying (Q46).

**Answers (Oskar, 2026-11-19):** "1. Why would you remove subscribe? 2. ook 3. yes, we need to make all async. 4. no why does this question come up now. I was asking why 05 has to have different one"

So: 2) Node.js immutable record charge and record payment throw "Entity not found" for a missing account, in every Node.js immutable guest stay facade (02 solution, 03 exercise facade and solutions, 04, 05, 06), as JVM, .NET and Node.js aggregates do; checkout keeps ignoring it. 3) All Node.js 02–04 code that calls the database or bus becomes async, the 03 to-do list included; AC 1.8 describes the existing test.

Follow-up questions: 1) only three helpers are unused in 04/05 (`findAll`/`GetAll`, JVM `transaction`, JVM `getAndUpdate`; .NET `Subscribe(Type, …)` is what `Subscribe<T>` calls, so it stays): a) remove from 04 and keep out of 05, b) keep copying (Q46). 4) 05 has a separate synchronous `MessageMiddleware` type because the bus doesn't await the catcher: a) give it to 02–04, b) drop it from 05 and 06.

**Answers (Oskar, 2026-11-19):** "1 - b) 4 - it should be maybepromise and also other ones"

Reading (stated to Oskar for correction): 1) the three helpers are copied to 05 (Q46); `GetAll` becomes `FindAll` in .NET 03–05 only, because in 06 all three repositories call the outbox's different operation `getAll`. 4) Oskar added: "(or promiselike in other words)". So the `MaybePromise<T>` type that Emmett already exports (`T | PromiseLike<T>`, imported as the tools import `JSONSerializer`); message handlers and middlewares both return `MaybePromise<void>`, and the bus awaits both, in every Node.js bus from 02 to 06; "other ones" read as the other function types the bus takes (handlers as well as middlewares).

## Q49 (spec r5): answers to the spec r4 review

**Questions:** 1) Apply the bus rule to checkout of a missing account: 02 (no bus) throws "Entity not found", 06 ignores it. 2) Name the 03 "immutable saga, choreography and to-do list" guest stay facades. 3) 02–04 get `MessageMiddleware` returning `MaybePromise<void>`. 4) No test for the new "Entity not found", as 04 didn't keep one for a missing entity and JVM/.NET have none.

**Answers (Oskar, 2026-11-19):** "1.ok 2. what's immutable saga? This is nonsense 3. ok 4. DUDE, the rule is that ALL CHANGES NEED TO BE ALIGNED ALWAYS, WHY DO I NEED TO REPEAT IT? DIDN"T YOU ALREADY STORE IT IN THE MEMORY?!!!!"

So: 1) and 3) as proposed. 2) the change is described by what the code does, not by a solution name: every Node.js guest stay facade that loads a missing account as `initial` for a charge or payment. Oskar added: "(always unless I say that something is an exception)".

4) Reading (stated to Oskar for correction): every change goes to all three repositories, tests included. So the missing guest stay account rule applies from 02 to 06 in JVM, .NET and Node.js alike (in 06 the JVM and .NET checkout stops throwing for a missing account, as Node.js stops publishing `GuestCheckoutFailed`), and it gets the same new tests everywhere: record charge and record payment for a missing account fail with "Entity not found", and in 02 checkout too, next to the guest stay entity definition tests of every 02–06 exercise and solution, both flavours.

## Q50 (spec r6): answers to the spec r5 review

**Questions:** 1) Leave the JVM 03 Kafka and RabbitMQ solutions out (broker work goes last); the transactions checkout is a direct call and keeps throwing. 2) Align the JVM and .NET 06 group checkout with Node.js (ignore a missing group checkout). 3) .NET and Node.js 02 exercise stubs check for a missing account in charge, payment and checkout, as JVM's do. 4) a) add "bus command for a missing entity publishes nothing" tests in 03–06, reversing the 04 "checked once" decision, or b) no test.

**Answers (Oskar, 2026-11-19):** "1. No don't leave them out, it has to be aligned. Why would I leave them? 2. dude, wasn't I clear about the rule? Plus we're not talking now about 06. It's out of scope. 3. I don't understand. 4. wtf is this test for?"

So: 1) the JVM 03 Kafka and RabbitMQ solutions follow the missing-entity rule too, in this work. 2) 06 is out of scope: nothing in 06 changes in this spec (no missing-account change, no bus type change, no tests there).

Follow-up: 3) explained that the 02 exercise skeletons differ: JVM loads the account and throws "Entity not found" before the TODO in charge, payment and checkout; Node.js and .NET do it only in charge. 4) explained that the test would prove a bus command for a missing entity publishes nothing and throws nothing.

**Answers (Oskar, 2026-11-19):** "3. Then they need to follow the rule 4. And what's the value for such test?"

So: 3) the Node.js and .NET 02 exercise skeletons load the account and throw "Entity not found" for a missing one in record charge, record payment and check out, as JVM's do.

Follow-up: 4) explained the value is low: it only matters when the bus delivers a command for an entity that doesn't exist, which no exercise builds; recommended b).

**Answer (Oskar, 2026-11-19):** "b"

So: 4) no test for "a bus command for a missing entity publishes nothing", as decided in 04.

## Q51 (spec r7): answers to the spec r6 review

**Questions:** 1) The JVM 03 transactions group checkout facade doesn't call the guest stay checkout; `initiateGroupCheckout` loads accounts itself with a bare `orElseThrow()`. It's called directly, so a missing account throws "Entity not found", with a JVM-only test. 2) AC 2.11's check-in clause applies to solutions and given code, not the 02 skeleton's TODO. 3) Fix the existing bug: `initiateGroupCheckout` stores each account under the group checkout id instead of its own.

**Answer (Oskar, 2026-11-19):** "ok"

## Q52 (spec r8): answers to the spec r7 review

**Questions:** 1) The JVM `Database.transaction` copies the whole storage and swaps it on commit, so collections created before never see the commit. Fix by copying back? 2) Remove the `println` in `transaction`. 3) Put the two transactions tests in a new `transactions/groupcheckouts/EntityDefinitionTests.java`. 4) The missing-account test needs a checked-in guest handled before the missing one to show the rollback.

**Answers (Oskar, 2026-11-19):** "1. Why copying? What if two transactions happen in parallel? We need to simulate transactions, not full acid but good enough/ 2. Fine 3. What tests, I don't understand. 4.WHAT ROLLBACK TEST?! Dude, could you focus on the merit?"

Explained: 3) one test per fix in the transactions solution (missing account fails with "Entity not found"; each account stored under its own id, checked through the facades by checking a guest of the group out again). 4) dropped. 1) proposed: inside a transaction `store` and `delete` are recorded and `get` sees them over the real data; on commit the recorded changes are applied to the real storage in one step under a lock; on a throw they are dropped; parallel transactions each apply only their own changes, last write wins on the same document.

**Answers (Oskar, 2026-11-19):** "4. you can add it, but only for database itself. The rest seems fine"

So: 1) the transaction works as proposed, in the JVM 03, 04 and 05 `Database`. 2) the `println` goes, the comment stays. 3) the two tests go in a new `transactions/groupcheckouts/EntityDefinitionTests.java`. 4) Reading (stated to Oskar for correction): the transaction gets its own tests on the `Database`, next to it, wherever it exists (JVM 03, 04, 05): a committed transaction's changes are visible through a collection created before it; changes of a transaction that throws are dropped; two transactions committed one after another on different documents both keep their changes.

## Q53 (spec r9): answers to the spec r8 review

**Question:** The JVM 06 `Database.transaction` already records writes, checks expected versions and applies them together under the storage lock on commit, applies nothing if the work or the check fails, bumps the version per applied store, and reads stored data (not the recorded writes) inside a transaction. a) use it as the model for the 03, 04 and 05 transaction; b) keep the Q52 design where `get` sees recorded writes.

**Answer (Oskar, 2026-11-19):** "I don't care if it's a or b as long as it's consistent and fullfiling the goal "your design" was imho wrong as it wouldn't full fill it"

So a): the JVM 06 transaction is the model, because it is consistent with existing code and handles parallel transactions. It replaces the Q52 design.

## Q54 (spec r10): answers to the spec r9 review

**Questions:** 1) Give the 03–05 `Database` the 06 shape (one storage lock for reads, writes and commits)? 2) Keep only the `transaction` method that returns nothing? 3) Add Database tests for delete, version and the thrown exception.

**Answer (Oskar, 2026-11-19):** "Dude, as 03 has transactions solution then from 04 it should have transaction. And cut the bs we're not teaching them databases transaction should just work"

So: the transaction stays in the 04 and 05 tools (Q46). The spec says what the transaction must do, not how: changes made in a transaction are all applied together or not at all, everyone sees them after the commit, two transactions at the same time don't lose each other's changes, and in 05 an expected version is respected. How to build it is the implementer's. The `Database` tests check exactly those four things.

Oskar added: "and I told you 06 is out of scope numerous times, right?" So the spec doesn't point at 06 at all, not even as prior art; Q53's choice of 06 as the model is dropped.

## Q55 (spec r11)

**Question:** Approve spec r11 and write the plan, or one more review round first?

**Answer (Oskar, 2026-11-19):** "yes, go"

So: spec r11 is approved; next is the plan.

## Q56 (plan r2): answers to the plan r1 review

**Questions (as asked):** 1) move 4.1–4.4 to step 3; 2) inside each step JVM, then .NET, then Node.js, step 1 first; 3) check 2.6 (the .NET aggregates group checkout ignores a result after it finished) "by reading", no test; 4) no test for a handler that throws inside `publish`; 5) check the 10-attempt retry limit "by reading"; 6) 9.2 (an extra field fails a Node.js test) checked once; 7) how the two transaction tests overlap; 8) `Database` tests in `solved/` only; 9) keep steps 3 and 5 big.

**Answers (Oskar, 2026-11-19), in order:**
- "3,5. I don't understand "by reading"? 6. WTF? Where on earth is it important? 7.I don't understand what do you mean 8. Database tests should be in core 9. If they're consistent and complete it's oaky if they're bigger"
- "Conflicts should be tested on facades, right? I don't understand 7. What threads?! Node.js doesn't have it. Also why transaction inside transaction? 8. exercises are just for people, they shouldn't bother how the sausages are made."
- "8. Are you fng nuts. That's not what I mean, I mean that the domain code and tests are for attendees, the rest should be hidden. Q3 - I still don't understand what do you want to test, didn't I ask you to ask proper questions, no shortcuts 7. in node you can use promise. all"
- "7 - I still don't understant, you should test it correctly to ensure that people won't be surprised."
- "are you storing my answers?!"

So far:
- 1), 2), 4): not objected to; applied as proposed.
- 5): conflicts are tested through the facades (the concurrency tests); the 10-attempt limit can't be forced through the facades and gets no test.
- 6): not important; no lasting test.
- 8): the `Database` tests sit in `core/` next to `Database.java`, in exercises and solutions, without the exercise tag: domain code and its tests are for attendees, the tools are hidden plumbing.
- 9): steps 3 and 5 stay as they are, being consistent and complete.
- 7): still open: the test must be deterministic, failing with today's code and passing with the fix every time. Proposed: T1 and T2 on their own threads, both open; T1 changes X and commits; T2 waits for T1's commit, stores Y and commits; X is T1's and Y exists.
- 3): still open: a test that a guest result arriving after the group checkout finished publishes nothing, in 04 and 05, all three repositories and both flavours.

**Answer (Oskar, 2026-11-19) on 3):** "A test for a guest result arriving after the group checkout finished. - this is idemptotency check"

Reading (stated to Oskar for correction): 3) it's 04's idempotency lesson, already covered by the existing idempotency test "the last completion recorded twice completes the group checkout once" (the repeated completion arrives after the group checkout finished and publishes nothing); no new test; 2.6 is checked by that test. 7) the deterministic transaction test as proposed (T1 and T2 on their own threads, both open; T1 changes X and commits; T2 waits for T1's commit, stores Y and commits; X is T1's and Y exists; in 05 the same with an expected-version conflict).

## Q57: step 3 review, Standards-1 (where the optimistic concurrency retry lives)

**Question:** In the 05 solution facades the retry is written out in some methods and wrapped in a private `handle` helper in others (JVM, .NET group checkout). a) write it out everywhere, like 04; b) the helper everywhere.

**Answer (Oskar, 2026-11-19):** "What retry do you mean?", then, after the explanation: "OC retry should be in the aggregate store or command handler (depending on scenario)"

Follow-up: asked "or not?" (Oskar) answered with agreement and the open point: does the 05 exercise give the store/handler, or does the attendee write it? Oskar: "Dude, wtf. What are you saying, I'm lost, I thought you were asking about 05", then, after a short restatement: "Then it should be as I said"

Reading (stated to Oskar for correction): in the 05 solution of all three repositories, the optimistic concurrency retry lives in one place per flavour: an aggregate store (aggregates) and a command handler (immutable entities), each loading, running the business logic, storing with the loaded version and retrying on a conflict; the facades call it and publish the returned events. The 05 exercise stays the 04 solution plus the versioned database, so writing it is the attendee's work. This changes spec 2.3 and plan step 3's solution code; it is applied after the run, as the resolution of Standards-1.

**Answer (Oskar, 2026-11-19) on the exercise:** "They can write however they want"

So: the 05 exercise gives no store or handler; the attendee solves it any way they like; only the 05 solution uses the aggregate store / command handler.

**Answer (Oskar, 2026-11-19):** "we can show them different solutions, so also retry in facade, but also in the infra"

So: 05 gets two solutions per flavour, as 03 shows several: one with the retry in the facade (today's 05 solution) and one with the retry in the infrastructure (aggregate store for aggregates, command handler for immutable entities). Layout, naming and the facade solution's shape (written out in each method or one helper) are settled in the spec update after the run.

## Q58: end of the plan run, open step-review findings

**Questions:** 1) accept no test for a delete inside a transaction; 2) accept that the 05 commit copies the storage to undo a failed commit; 3) accept the `_` lambda parameter and `null` marking a non-transactional database; 4) reject the notes that match the spec; 5–6) mark the README wording fixed; 7) add the "Settled means" note to the Node.js 05 README; plus the JVM Kafka/RabbitMQ "WARNING: Unexpected message type found" lines.

**Answer (Oskar, 2026-11-20):** "1. No we should have test for delete. 2. I don't understand what do you mean by undo. 3. I don't understand 5. OK 6Add it, it need to be aligned. error- check what's wrong"

So: 1) a test for a delete inside a transaction is added. 5) the wording fixes stay. 6) (the README note) the "Settled means SUM(Charges) - SUM(Payments) === 0" note is added to the Node.js 05 README. 2) and 3) explained again. The warning is investigated.

Follow-up: explained 2) the 05 transaction copies the whole storage at start and again at commit as a backup to restore on a failed version check; proposed checking every expected version first and then applying, with no copies, in 03, 04 and 05; 3) the `_` parameter name and a `null` field telling the real database from one inside a transaction; the warning: `MessageMetadataPropagationTest` (JVM 03 Kafka and RabbitMQ) expects only part of the published messages, so the catcher prints "Unexpected message type found"; unchanged since `341186e`; fix by listing all published messages.

**Answer (Oskar, 2026-11-20):** "ok, for fixing 2, it should work like serlialable isolatuon 3. this is weird with nll, or I don't get it"

So: the warning gets fixed as proposed ("ok"). 2) the JVM `Database.transaction` behaves like serializable isolation. 3) the `null` marker is weird; it goes with the rewrite.

Asked: what a failing commit throws in 03 and 04, where only 05 has versions: a) the same `ConcurrencyException`, used only by the transaction; b) something else.

**Answer (Oskar, 2026-11-20):** "a)"

## Q59

**Question:** Where do the two 05 solutions live? As 03 sagas: one folder per solution with both flavours inside, tools shared at the 05 root. JVM `e05_optimistic_concurrency/retry_in_facade/{solution1_aggregates, solution2_immutableentities}` and `retry_in_infrastructure/...`; .NET `Solutions/05-OptimisticConcurrency/RetryInFacade/{Version1-Aggregates, Version2-ImmutableEntities}` and `RetryInInfrastructure/...`; Node.js `solved/05_optimistic_concurrency/regular/solution1_retry_in_facade/{solution1_aggregates, solution2_immutableEntities}` and `solution2_retry_in_infrastructure/...`. The 05 exercise keeps its layout.

**Answer (Oskar, 2026-11-20):** "Fine by me"

## Q60

**Question:** In the "retry in the facade" solution, how is the retry written? a) written out in every method, like 04; b) one private helper per facade.

**Answer (Oskar, 2026-11-20):** "b)"

So: every facade of the "retry in the facade" solution, in all three repositories and both flavours, has one private helper that runs load, decide, store with the loaded version inside the retry; the facade methods call it.

## Q61

**Question:** The "retry in the infrastructure" solution, after Emmett's `CommandHandler`: immutable entities get a command handler (`commandHandler.handle(id, state -> decide(command, state))`: load or `initial`, decide, evolve, store with the loaded version or 0, retry on a conflict up to 10 times, return the events); aggregates get an aggregate store (`aggregateStore.handle(id, account -> account.recordCharge(...))`: load, run, dequeue, store with the loaded version, retry, return the events; plus a create call for check-in and initiation that stores with version 0 and does nothing if it already exists). The facade publishes the returned events; the missing-entity rule stays in the facade's function.

**Answer (Oskar, 2026-11-20):** "sounds good"

## Q62 (spec r14): answers to the spec r13 review

**Questions:** 1) The aggregate store and command handler pass "nothing stored" (JVM empty `Optional`, .NET and Node.js `null`) and the facade's function decides (create, throw "Entity not found", or no events); nothing is stored when there are no events; the facade solution's helper gets the same shape. 2) The aggregate store and command handler live in the `retry_in_infrastructure` folder's own `core/`. 3) Drop AC 10.5 (README links to the solutions).

**Answer (Oskar, 2026-11-20):** "we can pass initial as in decider. 2. ok 3. ok"

Reading (stated to Oskar for correction): 1) immutable entities: the command handler passes the decider's initial state when nothing is stored (JVM `INITIAL`, .NET `Initial`, Node.js `initial`), as a decider does; the facade's function tells a missing entity by that initial state and applies the missing-entity rule; nothing is stored when the function returns no events. Aggregates have no initial state outside their factory, so the aggregate store passes "nothing stored" (JVM empty `Optional`, .NET and Node.js `null`) and the facade's function decides; the facade solution's helper takes the same shape per flavour. 2) and 3) as proposed.

## Q63 (spec r16)

**Question:** In immutable entities, how does the facade's function recognise the initial state? Node.js `initial` has `status: 'NotExisting'`; JVM `INITIAL` has `null` id and status; .NET `Initial` has a default id and an undefined status 0, and the .NET group checkout `Initial` has status `Initiated`. a) add a "not existing" status to the JVM and .NET immutable entities, as Node.js has, so the initial state carries it and every decider checks the status, from 02 on wherever an initial state exists; b) compare with the initial constant.

**Answer (Oskar, 2026-11-20):** "a"

## Q64 (spec r19)

**Question:** What do the JVM and .NET deciders do with the "not existing" status? a) like Node.js: every decider, check-in and initiation included, gets the state and decides from the status, and the 04 duplicate check moves from the facades into the deciders; b) the status is only read where a missing entity has to be recognised, deciders and facades stay as they are.

**Answer (Oskar, 2026-11-20):** "i meant that we can use initial state and detect and then either do idempotent behaviour or thorw if it comes not from message bus"

So b): the initial state carries the "not existing" status so the code that gets it can detect a missing entity; that code (the facade's function passed to the command handler, and the private helper of the facade solution) then either behaves idempotently (no events, for a command from the bus; for check-in and initiation, create) or throws "Entity not found" (for a method not triggered by the bus). Deciders and the 04 duplicate checks stay where they are.

## Q65 (spec r20, plan r7): step 10 planNeedsChange

**Question:** The JVM and .NET aggregate store and command handler got their own tests (12 each: the 10-attempt limit, nothing stored without events); Node.js has none. a) keep them and add the same tests in Node.js; b) drop them and test only through the facades.

**Answer (Oskar, 2026-11-20):** "a)"

## Q66 (spec r21, plan r8): end of the second run, open step-review findings

**Questions:** 1) JVM transaction: versions reset when a document is deleted and stored again; 2) `findAll` in a transaction misses documents added by others; 3) a transaction started inside another throws a false conflict; 4) .NET group checkout record still defaults to `Initiated`; 5) .NET aggregate facades publish an empty event list, immutable ones skip it; 6) the JVM test run prints "OpenJDK 64-Bit Server VM warning: Sharing is only supported for boot loader classes because bootstrap classpath has been appended".

**Answers (Oskar, 2026-11-20):** "1-2, 4-5 - fix. 3 - can we fix it easily? 6 - I don't know what's this warning", then, after the explanation (3: a nested transaction joins the outer one; 6: the build files attach the Mockito agent with `-javaagent`, which no test uses, and the runtime reports it): "1 ok 6. ok remove mockito"

So: 1), 2), 4), 5) fixed; 3) a transaction started inside a transaction joins it (read as covered by "1 ok", the fix list; stated to Oskar for correction); 6) the unused Mockito agent is removed from the JVM build files, so the line goes away because its cause is gone. 5) every facade of both 05 solutions, in all three repositories, skips publishing when there are no events.

## Q67 (step 13 review blocked)

**Questions:** 1) tests for the empty-events skip and the .NET starting status: a) no test, b) tests below the facades; 2) an inner transaction joining the outer one throws and the outer code catches it: a) the inner's writes are dropped, b) leave it; 3) make the flaky .NET 05 exercise concurrency test fail every time, in all three repositories.

**Answers (Oskar, 2026-11-20):** "1. a) 2. I don't understand, if inner throw then none should be recorded what I missing? 3. ok, but I'm not sure how do you make it, so hard to tell"

So: 1) no test; both are kept by reading the code. 2) Reading (stated to Oskar for correction): when an inner transaction throws, none of its writes are recorded; if the exception isn't caught, the whole transaction fails and nothing is applied (as today). 3) wanted, but the approach needs explaining.

## Q68 (spec r22, plan r9): reliable concurrency tests

Follow-up on Q67 3): a database that holds every load until the test's N calls have loaded. **Oskar:** "that sounds like an ugly hack to me". Offered a longer load delay or leaving it. **Oskar:** "we can make more parallel calls also. But do we even check if we don't have sideeffects if no OC is applied?" Explained 3.1/5.5 and what each test sees without optimistic concurrency. **Oskar:** "how do you test it?" Explained the 50-runs check before and after. **Oskar:** "and how attendee is expect to fix it?", "I'm asking what person does need to implementnd?!" Explained (expected version, retry on a conflict, publish after the retry) and that the parallel calls must fit the 10-attempt retry limit.

**Answer (Oskar, 2026-11-20):** "ok"

So: the concurrency tests that run 5 calls at once run 10 (the retry limit of 10 attempts covers the worst case of 9 conflicts); the charge-racing-checkout test runs the race for 10 guest stays at once and checks none is checked out with an unsettled balance; the load delay stays 1 ms; a one-off check runs the 05 exercise and solution concurrency tests 50 times before and after in all three repositories (exercise: every test fails every run; solutions: every test passes every run), with the counts in `progress.md`.

## Q69 (step 14 planNeedsChange): the remaining lucky pass

After step 14, one .NET 05 exercise test (`Version2_ImmutableEntities` `GroupCheckoutInitiatedConcurrently_IsInitiatedOnce`) passed once in 50 runs. Discussed (Oskar, verbatim, in order): "I asked how you're testing it and I don't understand what you're saying and I want you to answer me finally precisely", "That's why I asked you if you couldn't race that 10 to more to make the risk much less likely", "I don't understand why you want to make different numbers, it's super weird and smelly", "Tbt, I'm now lost to how and what are you trying to teach attendee and how those tests look like.", "Where's the issue, and how are you sure that 10 would be enough to ensure the race condition happens. Plus why are you calling checkout right after that. Where's the Given where's whena dna where's then?", "Dude, then as I said, 10 and 50 is too risky. What's the issue in raising them to e.g. 100, wouldn't that be enough? Also tests should have a clear //given //when //then as they had", "ok, so what are you suggesting to do differently?", "I don't understand how would you implement this, tell me precisely", "And how would that help? This seem to me like a hacking."

Explained: the lucky pass comes from the JVM and .NET test helpers starting calls one after another; 100 calls would force the retry limit to 100 and slow the solutions; proposed a start gate in the test helpers (`inParallel` / `InParallel`: every call waits at a shared barrier and all are released together, as Goetz's `TestHarness` `startGate`), with the database, solutions, retry limit and 10 calls unchanged. a) the start gate; b) leave it.

**Answer (Oskar, 2026-11-21):** "a)"

So: the JVM and .NET concurrency test helpers start all calls together with a start gate (JVM `CyclicBarrier`, .NET a shared `TaskCompletionSource` released by the last call); Node.js keeps `Promise.all`. Every concurrency test, in all three repositories, gets clear `// Given`, `// When`, `// Then` comments. The 50-run check is run again.

## Q70

**Question:** An inner transaction throws, the outer catches it and continues. Its writes are dropped, but its reads stay on the outer transaction's read list, so another commit changing such a document fails the outer commit. a) drop everything from the inner transaction, reads included; b) keep the reads.

**Answer (Oskar, 2026-11-21):** "Dude just behave like any other database"

So b): a nested transaction behaves like a savepoint in a real database. Rolling back to a savepoint undoes the writes made after it but keeps what was read and locked (PostgreSQL: "locks acquired after the savepoint are not released"; under serializable isolation the read tracking stays), so a later conflict on such a read still fails the commit. The code already does this; nothing changes.

Correction (Oskar, 2026-11-21): "Dude, are you fng bs me, where on earth the default behaviour is to use save points?"

He is right: savepoints are opt-in, not the default. By default a database has no nested transactions: PostgreSQL treats a `BEGIN` inside a transaction as part of the outer one, and after an error the whole transaction is aborted ("current transaction is aborted, commands ignored until end of transaction block"), so its `COMMIT` rolls back; Spring's default propagation `REQUIRED` joins the outer transaction and an exception marks it rollback-only, so the outer commit fails (`UnexpectedRollbackException`). So Q70 is: an inner transaction joins the outer one; if its work throws, the whole transaction is doomed: even if the outer code catches the exception, the commit applies nothing and fails. This replaces the step 14 behaviour (only the inner writes dropped) and the savepoint reading above.

Follow-up (Oskar, 2026-11-21): "Nested transaction: it's simply part of the outer one. - I don't think that's a default databases behaviour either". Checked: there is no common default; most databases don't support nested transactions (PostgreSQL warns and ignores the inner `BEGIN`, the next `COMMIT` commits all; MySQL implicitly commits the open transaction; SQL Server counts nesting, an inner `COMMIT` commits nothing and any `ROLLBACK` rolls back all). Proposed: our database doesn't support nested transactions; starting one inside a transaction throws at once ("Nested transactions are not supported"); the step 13 joining and step 14 undo code go.

**Answer (Oskar, 2026-11-21):** "yes."

So this replaces Q66 3) (join) and Q67 2) / Q70: nested transactions are not supported.

## Q71

**Question:** Add a step 17: final verification after steps 13–16 and the `alignment.md` 05 update.

**Answer (Oskar, 2026-11-21):** "ok, but can't you merge those into one step?"

So: step 16 holds the nested-transaction change, the `alignment.md` 05 update and the final verification.

## Q72 (spec r27, plan r14): end of the third run, open step-review findings

**Questions:** 1) Node.js charge-racing-checkout test uses `Promise.allSettled` (swallows every error); JVM and .NET ignore one expected error type: fix Node.js to ignore only that type. 2) The same test checks in its 10 guest stays one after another in JVM and .NET, at once in Node.js: fix Node.js to check them in one after another. 3) The JVM start gate overlaps only as many calls as there are cores; on 10 cores all 10, and the 50-run check held: accept.

**Answer (Oskar, 2026-11-21):** "ok"
