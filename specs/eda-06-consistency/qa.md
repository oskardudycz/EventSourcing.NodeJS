# Exercise 06 Consistency (brainstorm started 2026-11-21)

Idea (Oskar): "ok, now, could we do the /brainstorm on the 06 consistency? It should be done accordingly to 05, only ask what's unclear"

What 06 looks like today, in all three repositories: the 06 exercise starts from a version older than the 04 solution. The guest stay account doesn't ignore repeated commands, the idempotency tests are the 3 old group checkout ones, there is no "bus delivers twice" test, and .NET and JVM have no charge or payment ids. JVM still has `SagaResult`, and .NET and JVM keep the tests in one file per kind at the variant root. Node.js has only immutable entities, in two solutions (publish right away, publish asynchronously). .NET and JVM have both flavours but one solution each: aggregates publish asynchronously, immutable entities publish right away. The Node.js 06 message catcher doesn't compare exactly, and its tests still use `Promise.allSettled`.

Taken as given from the 04 and 05 work, unless Oskar corrects it: the 06 exercise of each flavour is a 05 solution of that flavour plus the 06 tools (random database and bus failures, background jobs, `getAll` with positions, the transaction), as 05 is the 04 solution plus the versioned database. So everything 04 and 05 settled carries over to 06 in all three repositories: the 04 guards and ids, the 04 saga shape, the missing-entity rule, the "not existing" status, async Node.js with `MaybePromise`, the exact message catcher, tests next to the module they test with `// Given`, `// When`, `// Then`, the README links, the 05 concurrency tests and the one set of names. Both flavours exist in every repository, so Node.js gets an aggregates variant (`alignment.md` item 7).

## Q1

**Question:** Which 05 solution does the 06 exercise start from? a) retry in the facade: the attendee adds the outbox to each facade's helper; b) retry in the infrastructure: the attendee adds the outbox once, in the aggregate store or command handler. My pick was a), so that the dual write stays in code the attendee writes rather than being hidden in shared code.

**Answer (Oskar, 2026-11-21):** "I don't understand why a? The b is the go to imho, but I don't understand what a changes not to be hidden"

Explained: a) doesn't hide less. In b) the store happens in the aggregate store or command handler and the publish in the facade. That code sits in the variant's own `core/`, next to the domain code, not with the tools, so the attendee sees and changes it there. The argument for a) was wrong. Reading (stated to Oskar for correction): b). The 06 exercise of each flavour is the 05 "retry in the infrastructure" solution plus the 06 tools.

## Q2

**Question:** Today .NET and JVM pair each outbox style with one flavour (aggregates publish asynchronously, immutable entities publish right away), and Node.js has only immutable entities. a) two solutions (publish asynchronously, publish right away), each in both flavours, in all three repositories, as 05; b) one style per flavour, as .NET and JVM now.

Follow-up (Oskar, 2026-11-21), on the first wording of Q2 ("each solution changes the aggregate store and the command handler"): "retry is only about the conflict in 05, so I don't understand what do you mean". Explained: "retry in the infrastructure" is only the 05 solution's name; its aggregate store and command handler are the only place that stores (load, run, store with the loaded version, on a conflict again) and the facade publishes what they return. The outbox goes where the storing happens, so 06 changes the aggregate store and command handler: publish asynchronously stores the state and the outbox messages in one transaction; publish right away stores the state, and the facade publishes and puts what failed in the outbox. The conflict retry stays as it is.

**Answer (Oskar, 2026-11-21):** "we need to have two as always for aggregates and immutableentities, then oc retry in infra, but I still don't get how does this relate to 06?"

So: both flavours (aggregates, immutable entities) in every 06 exercise and solution, and the optimistic concurrency retry stays in the aggregate store / command handler, as in the 05 "retry in the infrastructure" solution. Still open: one outbox solution or two (publish asynchronously, publish right away); asked again after explaining what 06 adds.

## Q2b

**Question:** One outbox solution or two? a) both "publish asynchronously" (state and outbox in one transaction, a background job publishes in order with a checkpoint) and "publish right away" (store, publish at once, put what failed in the outbox), as two solutions, each in both flavours; b) only "publish asynchronously".

**Answer (Oskar, 2026-11-21):** "a"

So the 06 solutions are laid out like 05: JVM `e06_consistency/publish_asynchronously|publish_right_away/{solution1_aggregates,solution2_immutableentities}`, .NET `Solutions/06-Consistency/PublishAsynchronously|PublishRightAway/{Version1-Aggregates,Version2-ImmutableEntities}`, Node.js `solved/06_consistency/publish_asynchronously|publish_right_away/{solution1_aggregates,solution2_immutableEntities}`, each with the aggregate store / command handler in its own `core/`.

## Q3

**Question:** The Node.js 06 exercise, run 8 times: check-in and initiation tests pass every run (one or two calls; the first failure comes after 2 to 4 calls); six tests pass in 1 to 7 runs, depending on where the failure lands (recording a charge, a payment, a payment after a charge, recording a guest completion, failure and last completion, the charge racing a checkout); the rest fail every run. 05 requires exercise tests to fail every time and solutions to pass every time. a) the first write and the first publish always fail, then after 2 to 4 calls at random as now, so every exercise test fails every run, checked with 50 runs as in 05; b) keep it, some exercise tests pass by luck.

**Answer (Oskar, 2026-11-21):** "a + next tries fail randomly, so people can't just do double"

So: the first database write and the first bus publish always fail, in all three repositories. After that, failures stay random, and today's "never twice in a row" goes: a call right after a failure can fail again, so trying twice isn't enough and the code has to retry until it succeeds. Every exercise test fails every run, every solution test passes every run (50-run check, as in 05). How often a later call fails is asked in Q4.

## Q4

**Question:** After the first failure, how often does a call fail? a) each call fails with a 1 in 3 chance (about as often as now; twice in a row about 1 in 9); b) 1 in 2 (more retries, slower tests).

**Answer (Oskar, 2026-11-21):** "a"

So: after the first failure, every database write and bus publish fails with a 1 in 3 chance, independently of the call before, in all three repositories.

## Q5

**Question:** The 06 tests don't require an outbox: the bus fails before delivering, so a facade that retries the store until it succeeds and then retries the publish until it succeeds passes them all. a) add an outage test per module in all three repositories: given the bus is down, when a command is handled, then it finishes without an error and nothing is published yet; when the bus is back and the background jobs run, then the events are published once each (the bus gets a test switch to go down and come back; retrying the publish never finishes, both outbox solutions pass); b) no new test, the README explains why the outbox is still needed.

Follow-ups (Oskar, 2026-11-21): "I don't understand what do you mean", "And how would you do it?!", "And how would someone understand such test?". Shown: the bus gets `stop()` / `start()`; the test stops the bus, checks in a guest, expects no message, starts the bus, runs the background jobs and expects `GuestCheckedIn` once. Exercise code fails with "Message bus not available!"; the "retry the publish" shortcut fails only by the test framework's timeout, which doesn't tell the attendee why; the README would need a new rule ("a command must not wait for the message bus") for the test to make sense.

**Answer (Oskar, 2026-11-21):** "b"

So: no outage test and no bus switch. The tests prove that nothing is lost while the database and bus fail now and then; the README explains that the outbox is what keeps events safe when the bus stays down for longer or the process stops between storing and publishing, which the tests don't simulate.

## Q6

**Question:** Write the spec in `specs/eda-06-consistency/spec.md`, then spec review, plan, plan review and a run with Sonnet subagents, as in 05?

**Answer (Oskar, 2026-11-21):** "ok"

## Q7

**Question:** With the 04 saga shape the saga publishes its commands itself, so today's retry in the wiring (`retryUntilSucceeds` around the saga's publish) has no home. a) the saga's handlers retry their own publish; b) no retry, the event is redelivered (outbox job or "publish right away" fallback) and the 04 guards ignore the repeats; c) the saga stores its commands in the group checkout outbox. Follow-ups: "what is "publish right away" fallback for saga?" (explained; b) also publishes the event twice, which the tests count, so the recommendation moved to a)); "Where would that live?" (in the wiring, wrapping each saga handler in `retryUntilSucceeds`, the saga stays the 04 code).

**Answer (Oskar, 2026-11-21):** "In general messaging bus should be retrying until ack, as regular bus, I don't want any retryUntilSucceed in code, that's not acceptable. We should simulate message bus outage and database not cheat."

Reading (stated to Oskar for correction): the message bus behaves like a regular one. Publishing can fail during an outage, and the publisher gets the error. Once a message is accepted, the bus delivers it to each subscriber and keeps redelivering it to a subscriber whose handler fails, until that handler succeeds (acknowledges); other subscribers, the message catcher included, get it once. No module or solution code has `retryUntilSucceeds` (or `Retry.untilSucceeds` / `Retry.UntilSucceeds`); the saga stays the 04 code and its failed publish is retried by the bus redelivering the event to the saga. The optimistic concurrency retry from 05 stays. The database fails honestly too: a failed write throws, and nothing in the code retries it in a loop.

## Q8

**Question:** Confirm the Q7 reading (bus fails on publish during an outage and redelivers to a failing handler until it succeeds, others get it once; saga unchanged; no `retryUntilSucceeds` in code; conflict retry stays; database writes fail honestly; failed background jobs run again on the next run).

Follow-ups (Oskar, 2026-11-21): "Why like 04, not lik 05? The database concurrency should be retried as in 05 solutions, right?" and "What background jobs? LIke in solutions or what?". Explained: the saga is the same in 04 and 05 (the 05 exercise is the 04 solution), so "the 04 code" meant the 05 saga; the conflict retry stays as in the 05 "retry in the infrastructure" solution, in the aggregate store / command handler. Background jobs: the 06 tools have `BackgroundJobs`; a facade registers a job (in the solutions: publishing from its outbox), and the tests run the registered jobs until they stop publishing, as an application's scheduler would run them all the time. In the exercise the attendee registers their own job.

**Answer (Oskar, 2026-11-21):** "ok"

So the Q7 reading holds with the follow-ups: the saga is the 05 one, unchanged; the conflict retry stays in the aggregate store / command handler, as in the 05 "retry in the infrastructure" solution; `BackgroundJobs` stays as in the 06 tools, a failed job throws and is run again on the next run, with no `retryUntilSucceeds` inside it. This replaces the Q5 reasoning about "retry the publish until it works": no code retries on outages.

## Q9

**Question:** Tests call some facade methods directly, as the clerk would (check-in, charge, payment, initiation). The bus redelivers only what it delivers; a direct call that hits a database failure throws `TimeoutError` to the test, and with Q3 every test's first write fails. a) the tests act as a client that calls again after a `TimeoutError` (a test helper next to `runBackgroundJobsUntilIdle`); b) the clerk's commands go through the bus too; c) each test catches the error and calls again.

**Answer (Oskar, 2026-11-21):** "we should check with deadlinge if messages were published. so same as we had"

Then: "So be checking on the expecte doutcome". My first reading tied this to the JVM 03 Kafka and RabbitMQ message catcher, which waits with a deadline; Oskar: "Are you joking about checking kafka?" That reading is withdrawn. Checked: no 06 test waits with a deadline today; the tests run the background jobs until they stop publishing (`runBackgroundJobsUntilIdle`, at most 100 runs) and then check the messages. What "same as we had" means is asked again.

Then (Oskar, 2026-11-21): "Dude, just check business process tests". Checked (Node.js 06 `businessProcess.solved.test.ts`): each test calls the facades directly (check-in for each guest, then `initiateGroupCheckout`), runs the background jobs until they stop publishing (`runBackgroundJobsUntilIdle`, which gives up after 100 runs: that is the deadline), and then checks the expected outcome, the published messages in any order. Reading: the 06 tests keep this shape. Still open: in that test the first line, `checkInGuest`, hits the first database write, which always fails (Q3), and with no retry in code it throws `TimeoutError` to the test.

**Answer to Q9d (Oskar, 2026-11-21):** "just message catcher should wait with deadline"

So: the message catcher's checks wait until the expected messages are published, and fail when a deadline passes, in all three repositories. Asked again, only the part this doesn't cover: the test's own direct facade call that throws `TimeoutError`.

Follow-ups (Oskar, 2026-11-21): "Why would it send it again?", "Dude, why would test send it again? What's the value of doing that in test?" Agreed: no value. Asked (Q9f): the database and bus fail only inside the system (while a bus handler or a background job runs), never on a call straight from the test; the exercise still fails every run, because the first checkout the saga triggers stores and then fails to publish.

**Answer (Oskar, 2026-11-21):** "Use may fix it so it doesn't fail"

Reading (stated to Oskar for correction): "You may fix it so it doesn't fail": the test's own calls don't fail. The database and bus fail as Q3 and Q4 say (first write and first publish fail, then 1 in 3) only while a bus handler or a background job runs; a facade call made straight from a test, and the writes and publishes it makes, never fail.

## Q10

**Question:** With no retry in code, the outbox job can publish an event twice: it publishes, then storing the checkpoint (or removing the published message) fails, the job throws, and the next run publishes it again. The message catcher sees it twice, and the tests expect each message once. a) the catcher ignores exact repeats of a message it already saw (still fails on a missing, wrong or unexpected message; a double effect still shows as different messages); b) keep "exactly once" in the tests.

**Answer (Oskar, 2026-11-21):** "I still don't get how would this happen in our test implementation, but sure we can ignore the same"

So a): in all three repositories the message catcher ignores an exact repeat of a message it already caught; the README says the outbox delivers at least once and that the 04 idempotency handles it. Explained after: today's job (JVM `Outbox.publishFromOutbox`, the same in .NET and Node.js) publishes a message and then stores the checkpoint inside `Retry.untilSucceeds`; without that retry, a failed checkpoint write ends the job, and `runBackgroundJobsUntilIdle` runs it again from the old checkpoint.

## Q11

**Question:** Today's "publish right away" stores the state, publishes, and writes the events to the outbox only when publishing fails. Without `retryUntilSucceeds`, when that outbox write fails too, the state is stored and the events are lost (the bus redelivers the command, the 04 guard produces no events). a) change it: state and events in the outbox in one transaction, publish at once, remove what was published; b) drop it, keep only "publish asynchronously", the README explains why writing the outbox only on a failed publish loses events; c) keep it and accept failing tests. Follow-ups: "why? there shouldn't be any reason to keep exact order" (explained: a) is about not losing events, not order) and "Dude, wtf is publish right away then. Now I'm lost" (explained the two solutions side by side: with a) they differ only by who publishes on a good day).

**Answer (Oskar, 2026-11-21):** "Publish right away then is not a solution"

Then: "if it doesn't give guarantee", and: "But yes, we should show this transacitonal outbox so if publish doesn't work then store to outbox. as an alternative. but then order doesn't matter and it's not right away"

Reading (stated to Oskar for correction): today's "publish right away" goes, because it doesn't guarantee anything. 06 keeps two solutions, each in both flavours, both with a transactional outbox (the state and its events stored in one transaction): 1) the background job publishes from the outbox in the stored order and keeps a checkpoint (today's "publish asynchronously"); 2) the facade, after the transaction, tries to publish the events at once and removes the published ones from the outbox; whatever it couldn't publish stays there, and the background job publishes it later and removes it. In 2) the order isn't kept, and it isn't called "right away". This replaces Q2b's "publish right away". The names of the two solutions are asked in Q12.

## Q12

**Question:** Confirm the Q11 reading and name the two solutions: a) `publish_in_order` and `publish_in_any_order` (.NET `PublishInOrder` / `PublishInAnyOrder`); b) `publish_from_background_job` and `publish_from_facade`; c) other.

**Answer (Oskar, 2026-11-21):** "a)"

So the Q11 reading holds, and the solutions are JVM `e06_consistency/publish_in_order|publish_in_any_order/{solution1_aggregates,solution2_immutableentities}`, .NET `Solutions/06-Consistency/PublishInOrder|PublishInAnyOrder/{Version1-Aggregates,Version2-ImmutableEntities}`, Node.js `solved/06_consistency/publish_in_order|publish_in_any_order/{solution1_aggregates,solution2_immutableEntities}`.

## Q13

**Question:** Tool and test details: 1) background jobs run on their own during a test and the catcher waits up to 5 seconds; 2) the bus redelivers to a failing handler at most 10 times; 3) the database and bus know whether a call comes straight from a test (never fails) or from a bus handler or background job (fails as Q3 and Q4 say); 4) README content.

**Answer (Oskar, 2026-11-21):** "What background jobs?!", "are 1-2 about solutions?!", "3. I don't understand", then, after the explanation: "I'm lost now, I'm totally lost"

So: these are tool internals, which Oskar doesn't want to decide ([[tools-behaviour-not-internals]]); the spec states them as tool behaviour, from the answers above (Q3, Q4, Q7–Q10), and the spec review checks them. No further question on them.

## Q14

**Question:** Write the spec from the summary (exercise = 05 infrastructure-retry solution plus failing database and bus and a redelivering bus; attendee adds a transactional outbox; solutions `publish_in_order` and `publish_in_any_order`; no retry on outages in code; duplicates handled by the 04 guards; tests wait for the expected messages)?

Follow-up (Oskar, 2026-11-21): "Dude, if we have tests checking continously whether the messages arrived then why do we need in tests any background jobs?" Agreed: the tests don't need them. The background jobs belong to the system: the `BackgroundJobs` tool runs every registered job by itself, all the time, as an application's scheduler does; the tests only create it and pass it to the facades, as they do with the database and the bus. `runBackgroundJobsUntilIdle` and every call to it in the tests go.

**Answer (Oskar, 2026-11-21):** "yes"

## Q15 (spec r1 review, R1)

**Question:** Which calls fail first (Q&A-3, Quality-1, Quality-2 of the r1 review)? a) the first database write of each test fails, and the first publish of each message type fails, then each write and publish fails with a 1 in 3 chance; calls made straight from a test never fail and don't count. Explained with the exercise: the saga sends `CheckOutGuest`, the account is stored, the first publish of `GuestCheckedOut` fails, the bus hands the command back, the 04 guard produces nothing, `GuestCheckedOut` is never published, so the exercise fails every run instead of passing by luck 2 runs in 3; in the solution the event is already in the outbox and the job publishes it later. b) something else. Follow-up (Oskar): "I don't understand aboutThat guarantees GuestCheckedOut is lost in the exercise, doesn't make sense to me" (explained step by step, as above).

**Answer (Oskar, 2026-11-21):** "a)"

## Q16 (spec r1 review, R2)

**Question:** Which exercise tests fail? Module tests only call facades straight from the test (never fail since Q9), so they pass in the exercise; only the business process and "delivers twice" tests fail every run. Follow-up (Oskar): "Dude, I just said, that we get consistenly errors on database save and publishing so someoen could fix it by reordering publishhing and database save or repeating". Traced: with temporary failures and a redelivering bus, neither "repeat until it works" nor "publish, then save" is caught by any test; a crash test would catch both (proposed).

**Answer (Oskar, 2026-11-21):** "What crash test?! Dude, I said, we just need the business process test with failure, wtf"

So: no crash test. The failures matter only in the business process tests (and the "delivers twice" whole-process test); the module tests run without failures and pass in the exercise. The tests don't catch "repeat until it works" or "publish, then save"; that stays as it is.

Follow-ups (Oskar, 2026-11-21): "What module tests pass?! We just need the same set of tests just having the database or message bus fail and then if someone adds outbox then it'll pass, I don't understand" and "what do you mean, facades call message bus and database". The Q9f reading ("You may fix it so it doesn't fail": calls straight from a test never fail) is questioned; asked again what "Use may fix it so it doesn't fail" meant.

**Answer to Q9g (Oskar, 2026-11-21):** "Essentially, all tests must pass after implementation is done. And the conditions should happen the same way"

Asked (Q9h): the bus fails the same way everywhere, the test's own calls included (first publish of each type, then 1 in 3); the database fails only inside bus handlers and background jobs, where someone tries again; so every exercise test fails, every solution test passes.

**Answer (Oskar, 2026-11-21):** "Then for facades tests we may disable failures, right? This can be condigured by settings, right?"

Follow-ups (Oskar, 2026-11-21/22): on Q9i "OK, so what option do we have?!" (options: 1) database fails only inside bus handlers and background jobs; 2) tests send their commands through the bus; 3) tests repeat their own calls, already rejected), then "And how would you do option 1?" (shown: the bus and the background jobs mark the code they run with `AsyncLocalStorage` / `AsyncLocal` / `ThreadLocal`, and the database fails only inside that mark; a setting turns failures on).

**Answer (Oskar, 2026-11-22):** "nah, I don't like that, seems hacky"

So option 1 as shown is rejected. Asked again.
