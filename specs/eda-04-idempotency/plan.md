# Plan: EDA workshop exercise 04 Idempotency aligned in Node.js, .NET and JVM

Revision: 6. Built from spec r14.

Spec: `spec.md`. Q&A: `qa.md`.

## Terms

- **JVM workshop**: `/home/oskar/repos/EventSourcing.JVM/workshops/event-driven-architecture`. Exercises under `exercises/src/test/java/io/eventdriven/eventdrivenarchitecture/` (below `JX/`), solutions under `solved/src/test/java/io/eventdriven/eventdrivenarchitecture/` (below `JS/`). JVM is the reference.
- **.NET workshop**: `/home/oskar/repos/EventSourcing.NetCore/Workshops/EventDrivenArchitecture`. Exercises in `0X-*` (below `NX/`), solutions in `Solutions/0X-*` (below `NS/`).
- **Node.js workshop**: `/home/oskar/repos/EventSourcing.NodeJS/workshops/event_driven_architecture/src`. Exercises in `0X_*` (below `DX/`), solutions in `solved/0X_*` (below `DS/`).
- **Flavour**: aggregates or immutable entities. JVM `solution1_aggregates` / `solution2_immutableentities`, .NET `Version1-Aggregates` / `Version2-ImmutableEntities`, Node.js `solution1_aggregates` / `solution2_immutableEntities`.
- **03 saga solution**: the 03 solution that coordinates the group checkout with a saga, one per flavour: `JS/e03_businessprocesses/sagas/<flavour>`, `NS/03-BusinessProcesses/Sagas/<flavour>`, Node.js `DS/03_business_processes/regular/solution1_sagas/<flavour>` (today only `solution1_saga`, immutable entities).
- **Saga shape**: the saga is built with the message bus, has one handler per event it reacts to, and each handler sends its commands through the bus and returns nothing, as in `/home/oskar/repos/EventSourcing.NetCore/Sample/ECommerce/Orders/Orders/Orders/OrderSaga.cs` (Q11). No `SagaResult`.
- **"Finished" check**: the group checkout ignores a guest result once it has completed or failed.
- **"Same result twice" check**: the group checkout ignores a guest result it already has for that guest.
- **Idempotency handling**: what the 04 solutions add: ignore a repeated initiation and check-in, the same charge or payment id, a repeated checkout for the same group checkout, the "same result twice" and the "finished" checks.
- **Module code**: the group checkouts and guest stay accounts code, the saga and the wiring. **Tools**: database, message bus, message catcher and the shared core.
- **Throwaway test**: a test written to prove a 03 rule red then green and deleted before the step ends; the spec keeps no new 03 tests (Q8, Testing Decisions).

Steps 1–8 are implemented (see `todo.md`, `progress.md`); steps 9–11 implement the criteria added in spec r9–r14 (groups 16–20).

Every spec criterion says "any repository" where it applies to all three, so each step works in all three repositories, in the order JVM, .NET, Node.js, and keeps every criteria group whole. Out of scope: 05, 06, the JVM Kafka and RabbitMQ solutions, everything else in `alignment.md`.

---

## Step 1. Node.js tests compare published messages exactly

```text
Use the `implement-step` skill.

What to build
A Node.js workshop test fails when a published message differs from the expected one in any field, including an extra field set to undefined, as JVM and .NET tests already do.

Context
`DX/02_entities_definition/tools/messageCatcher.ts`, `DX/03_business_processes/tools/messageCatcher.ts`, `DX/04_idempotency/tools/messageCatcher.ts` and the same files under `DS/02_entities_definition/tools`, `DS/03_business_processes/tools`, `DS/04_idempotency/tools`. Today `shouldReceiveSingleMessage` uses `toEqual` and `shouldReceiveMessages` uses a length check plus `toMatchObject`, a partial match. The 05 and 06 copies stay as they are (Q9). All 239 solution tests were checked to pass with `toStrictEqual` on a copy of the workshop.

Similar code
JVM `JX/e02_entities_definition/core/MessageCatcher.java` (`assertEquals`, recursive comparison); .NET `NX/02-EntitiesDefinition/Core/MessageCatcher.cs` (`ShouldBe`, `ShouldBeEquivalentTo`).

Blocked by
None

Acceptance criteria
- 13.1. GIVEN a test expecting `GuestCheckedOut` with `guestStayAccountId` and `checkedOutAt` WHEN the published `GuestCheckedOut` also carries `groupCheckoutId: undefined` or any other extra field THEN the test fails.
- 13.2. GIVEN a test expecting a list of messages WHEN one published message has a field with a different value THEN the test fails.
- 13.3. GIVEN the message catcher copies of Node.js 02, 03 and 04, exercises and solutions WHEN read THEN both checks use strict equality; the 05 and 06 copies are unchanged.
- 13.4. GIVEN the Node.js solutions WHEN all solved tests run THEN they pass.

Tests
- Throwaway tests in this step go in `DS/03_business_processes/tools/messageCatcher.solved.test.ts`, importing `./messageCatcher`, run with `npm run test:file -- <path>`.
- 13.1: throwaway test `single message with an extra undefined field doesn't match` - asserts `shouldReceiveSingleMessage` throws when the caught `GuestCheckedOut` has `groupCheckoutId: undefined` and the expected one doesn't; red before, green after, then deleted (the catcher is test tooling, no product test file exists for it)
- 13.2: throwaway test `message list with a different field value doesn't match` - asserts `shouldReceiveMessages` throws when one caught message has a different `amount`; deleted after green
- 13.3: check - every 02–04 `messageCatcher.ts` uses `toStrictEqual` in both checks; `git diff` shows no change under 05 and 06
- 13.4: `npm run test:solved` - all solved tests pass (protects existing behaviour)
- extra: throwaway test `message list with an extra message doesn't match` - asserts `shouldReceiveMessages` throws when one more message was caught than expected
- extra: `npm run build:ts` and `npm run lint` pass

Existing tests broken: none expected (checked on a copy). If an exercise test changes result, report it.
```

## Step 2. .NET aggregates guest stay facade without group checkout initiation

```text
Use the `implement-step` skill.

What to build
In .NET aggregates, the guest stay facade only handles guest stays; group checkout initiation is only on the group checkout facade, in 03 and 04.

Context
`NS/03-BusinessProcesses/Sagas/Version1-Aggregates/GuestStayAccounts/GuestStayFacade.cs` (line ~52), `NX/04-Idempotency/Version1-Aggregates/GuestStayAccounts/GuestStayFacade.cs`, `NS/04-Idempotency/Version1-Aggregates/GuestStayAccounts/GuestStayFacade.cs` each have `InitiateGroupCheckout`, a leftover from 02. The only test using it is `GroupCheckoutForMultipleGuestStay_ShouldBeInitiated` in `NX/04-Idempotency/Version1-Aggregates/EntityDefinitionTests.cs` and `NS/04-Idempotency/Version1-Aggregates/EntityDefinitionTests.cs`. 05 and 06 stay as they are (Q9). 02 keeps it (agreed 2026-11-11).

Similar code
`NS/03-BusinessProcesses/Sagas/Version2-ImmutableEntities/GuestStayAccounts/GuestStayFacade.cs`, which has no such method.

Blocked by
None

Acceptance criteria
- 10.1. GIVEN the .NET 03 aggregates saga solution and the .NET 04 aggregates exercise and solution WHEN the guest stay facade is read THEN it has no group checkout initiation.
- 10.2. GIVEN the .NET 04 aggregates tests WHEN read THEN "group checkout for multiple guest stay should be initiated" is gone.

Tests
- 10.1: check - `grep InitiateGroupCheckout` finds no match in those three `GuestStayFacade.cs` files; the projects build
- 10.2: check - the test is removed from both `EntityDefinitionTests.cs`; `dotnet test --solution EventDrivenArchitecture.slnx` shows every `Solutions/` project passing and the 04 exercise failures unchanged apart from that one test
- extra: the group checkout facade's `InitiateGroupCheckout` tests (04 `IdempotencyTests` "initiated once for the same id", business process tests) still pass in the solution (protects existing behaviour)

Existing tests broken: `GroupCheckoutForMultipleGuestStay_ShouldBeInitiated` in 04 Version1, exercise and solution, is deleted.
```

## Step 3. One saga shape in 03 and 04

```text
Use the `implement-step` skill.

What to build
In every repository, the group checkout saga of the 03 saga solutions and of the 04 exercises and solutions is built with the message bus, handles `GroupCheckoutInitiated`, `GuestCheckedOut` and the guest checkout failure in one handler each, and sends its commands through the bus. `SagaResult` is gone.

Context
- JVM: `JS/e03_businessprocesses/sagas/<flavour>/groupcheckouts/GroupCheckoutSaga.java` returns `SagaResult` (`JS/e03_businessprocesses/sagas/core/SagaResult.java`); `GroupCheckoutsConfig.java` unpacks it with `instanceof SagaResult.Command(...)` and publishes. Same in `JX/e04_idempotency/<flavour>` and `JS/e04_idempotency/<flavour>` with `core/SagaResult.java`. Leave `sagas_kafka`, `sagas_rabbitmq`, e05, e06 as they are.
- .NET: `NS/03-BusinessProcesses/Sagas/<flavour>/GroupCheckouts/GroupCheckoutSaga.cs` (defines `SagaResult`) and `GroupCheckoutsConfig.cs`; same in `NX/04-Idempotency/<flavour>` and `NS/04-Idempotency/<flavour>`.
- Node.js: `DS/03_business_processes/regular/solution1_saga/groupCheckouts/groupCheckoutSaga.ts` is a function returning command arrays; `groupCheckouts/index.ts` subscribes and publishes them. Same in `DX/04_idempotency/regular/<flavour>/groupCheckouts` and `DS/04_idempotency/regular/<flavour>/groupCheckouts`.
- All three buses are synchronous and handle nested publishes before the next message, so the published message order stays the same.

Similar code
`/home/oskar/repos/EventSourcing.NetCore/Sample/ECommerce/Orders/Orders/Orders/OrderSaga.cs` (handlers send through `ICommandBus`) and its `Config.cs` registration. Node.js: module pattern (functions and closures, no classes, no `any`), e.g. `DS/03_business_processes/regular/solution1_saga/groupCheckouts/groupCheckoutFacade.ts`.

Blocked by
None

Acceptance criteria
- 1.1. GIVEN a 03 saga solution or a 04 exercise or solution, any repository and flavour WHEN the saga is read THEN it is built with the message bus, has one handler each for `GroupCheckoutInitiated`, `GuestCheckedOut` and the guest checkout failure event, and each handler sends its commands through the bus and returns nothing.
- 1.2. GIVEN the same code WHEN searched THEN there is no `SagaResult`, and the wiring subscribes the saga's handlers without unpacking results.
- 1.3. (protects existing behaviour) GIVEN a group checkout for guests A, B and C WHEN `GroupCheckoutInitiated` is published THEN the saga sends three checkout commands, one per guest, with the group checkout id.
- 1.4. (protects existing behaviour) GIVEN `GuestCheckedOut` for A with the group checkout id WHEN the saga handles it THEN it sends `RecordGuestCheckoutCompletion` for A; GIVEN a guest checkout failure for A with the group checkout id THEN it sends `RecordGuestCheckoutFailure` for A; GIVEN either event without a group checkout id THEN it sends nothing.
- 1.5. GIVEN every 03 and 04 business process test WHEN run THEN it passes with the same expected messages as before (protects existing behaviour).

Tests
- 1.1: check - in each of the 17 saga files (3 repositories × 03 saga, 04 exercise, 04 solution, × 2 flavours, minus the Node.js 03 aggregates saga that Step 5 adds) the saga takes the bus and has the three handlers returning nothing
- 1.2: check - `grep -r SagaResult` finds nothing under the 03 saga folders and the 04 exercises and solutions of all three repositories
- 1.3: existing business process tests "group checkout for multiple guest stay without payments and charges should complete" (JVM `groupCheckoutForMultipleGuestStayWithoutPaymentsAndCharges_ShouldComplete`, .NET `GroupCheckoutForMultipleGuestStayWithoutPaymentsAndCharges_ShouldComplete`) - assert three `CheckOutGuest` commands with the group checkout id after `GroupCheckoutInitiated`
- 1.4: existing business process tests "with one settled and rest unsettled should fail" - assert `RecordGuestCheckoutCompletion` after `GuestCheckedOut` and `RecordGuestCheckoutFailure` after the failure; existing guest stay entity definition tests "checking out guest with settled balance succeeds" - assert no command is sent for a guest event without a group checkout id
- 1.5: JVM `./gradlew test --rerun` in `solved/`, .NET `dotnet test --solution EventDrivenArchitecture.slnx`, Node.js `npm run test:solved` - every 03 and 04 business process test passes unchanged; 04 exercise failures unchanged
- 1.4 (no group checkout id): throwaway test `guest checkout without a group checkout id sends no group checkout command`, one per saga flavour per repository - wires both modules as the business process tests do (guest stay facade, group checkout facade, saga, catcher on the bus), checks in guest A, records charge and payment of the same amount, checks A out without a group checkout id; asserts the caught messages are exactly `GuestCheckedIn`, `ChargeRecorded`, `PaymentRecorded`, `GuestCheckedOut`, with no `RecordGuestCheckoutCompletion`; deleted after green
- extra: JVM exercises `./gradlew compileTestJava` passes; Node.js `npm run build:ts` and `npm run lint` pass

Existing tests broken: none; the business process tests are the guard and don't change.
```

## Step 4. 03 group checkout rules and no duplicate handling before 04

```text
Use the `implement-step` skill.

What to build
In 03, a group checkout in progress records every guest result it gets, even the same one twice; a finished group checkout ignores later results, in every 03 solution including the to-do list, which no longer throws for a group checkout it doesn't track. A repeated check-in or initiation in 02 and 03 is neither ignored nor rejected.

Context
- JVM: `JS/e03_businessprocesses/sagas/<flavour>/groupcheckouts/GroupCheckout.java` and `GroupCheckoutDecider.java`, `processmanagers/groupcheckouts/GroupCheckout.java`, `choreography/groupcheckouts/GroupCheckoutDecider.java` check `status != INITIATED || <already has this status>`; remove only the second part, and remove `GroupCheckout.recordedAlreadyGuestCheckoutWithStatus` where it then has no caller (the JVM 04 exercise doesn't have it; the 04 solution adds it). `todolist/groupcheckouts/GroupCheckoutProjection.java` deletes a finished group checkout and throws "Entity not found" for one not on the list.
- .NET: `NS/03-BusinessProcesses/Sagas/Version1-Aggregates/GroupCheckouts/GroupCheckout.cs` (lines ~85, ~103) has both checks, but `status` is only set in the constructor; remove the "same result twice" part and set the status on completion and failure. `NS/04-Idempotency/Version1-Aggregates/GroupCheckouts/GroupCheckout.cs` has the same status bug; set the status there too (3.3). `Sagas/Version2-ImmutableEntities`, `ProcessManagers`, `Choreography` have no "finished" check; add it. `ToDoList/GroupCheckouts/*Projection*.cs` (lines ~41, ~46) throws for an unknown group checkout.
- Node.js: `DS/03_business_processes/regular/solution1_saga` and `solution3_choreography` have the "finished" check (`businessLogic.ts` `if (state.status !== 'Initiated') return [];`, which also narrows the state type, and stays). `solution2_process_managers/groupCheckouts/groupCheckout.ts` has no "finished" check in `onGuestCheckedOut`/`onGuestCheckoutFailed`; add it. Note: its `evolve` sets `'Failed'` on `GroupCheckoutCompleted` and `'Completed'` on `GroupCheckoutFailed` (~211–221); a check on "not Initiated" works either way. `solution4_todo_list/groupCheckouts/groupCheckoutProjection.ts` (lines ~51–63) throws "Entity not found". Throws on a repeated check-in ("Guest is already checked-in!") and initiation ("Group checkout already initiated!") in `DS/02_entities_definition/regular/*`, `DX/03_business_processes/regular/*` and every `DS/03_business_processes/regular/*` (to-do list included) go. `evolve` status checks stay (Q9).
- Each repository keeps its 03 state shape (Q13).

Similar code
For "finished" without "same result twice": the JVM 04 exercise has neither, the JVM 04 solution has both (`JX/` vs `JS/e04_idempotency/<flavour>/groupcheckouts`). For a to-do list that ignores: the saga facades returning early when there's nothing to do, e.g. Node.js `DS/03_business_processes/regular/solution1_saga/groupCheckouts/groupCheckoutFacade.ts`.

Blocked by
Step 3 (same saga folders; avoids conflicting edits).

Acceptance criteria
- 2.1. GIVEN a 03 saga, process manager or choreography solution in any repository and flavour, a group checkout in progress for guests A and B AND A's completion recorded WHEN A's completion is recorded again THEN `GuestCheckoutCompletionRecorded` for A is published again.
- 2.2. GIVEN the same WHEN A's failure is recorded twice THEN `GuestCheckoutFailureRecorded` for A is published twice.
- 3.1. GIVEN a 03 saga, process manager or choreography solution in any repository and flavour, and a group checkout for A and B that completed WHEN A's completion is recorded again THEN nothing is published and no error is thrown.
- 3.4. GIVEN a 03 to-do list solution in any repository and a group checkout for A and B that completed (and so was removed from the list) WHEN `GuestCheckedOut` for A with that group checkout id is published again THEN no `GroupCheckoutCompleted` or `GroupCheckoutFailed` is published, no error is thrown, and the list is unchanged.
- 3.5. GIVEN a 03 to-do list solution WHEN `GuestCheckedOut` with a group checkout id that was never on the list is published THEN no error is thrown and the list is unchanged (the existing "not on the to-do list" test, now expecting this).
- 3.2. GIVEN a group checkout that failed WHEN any guest result is recorded THEN nothing is published.
- 3.3. GIVEN the .NET 03 aggregates saga or the .NET 04 aggregates solution WHEN the group checkout completes or fails THEN its status is completed or failed, so 3.1 and 3.2 hold.
- 4.1. GIVEN a checked-in guest stay account in a 02 solution or a 03 exercise or solution, any repository WHEN the same guest is checked in again THEN no error is thrown and `GuestCheckedIn` is published again.
- 4.2. GIVEN an initiated group checkout in a 03 solution, any repository WHEN the same group checkout is initiated again THEN no error is thrown and `GroupCheckoutInitiated` is published again.
- 5.1. GIVEN every 02 and 03 solution in every repository WHEN its tests run THEN they pass.

Tests
(Throwaway tests per spec Testing Decisions and Q8: write, see red, fix, see green, delete. In .NET, use .NET event names. Where the rule already holds today, the run is a check of existing behaviour, not red-green: 3.1 in JVM and the Node.js saga and choreography; 2.1 and 2.2 in the Node.js saga, choreography and process manager, and in .NET Version2, ProcessManagers and Choreography.)
- 2.1: throwaway `group checkout in progress records the same guest completion twice` - group checkout for A and B, record A's completion twice; asserts two `GuestCheckoutCompletionRecorded` for A, no finish event
- 2.2: throwaway `group checkout in progress records the same guest failure twice` - same with failures; asserts two `GuestCheckoutFailureRecorded` for A
- 3.1: throwaway `completed group checkout ignores a later guest completion` - A and B completed, record A's completion; asserts nothing published, no error
- 3.2: throwaway `failed group checkout ignores a later guest result` - A failed, B completed (group failed), record A's completion and B's failure; asserts nothing published
- 3.3: throwaway in the .NET 03 aggregates saga (`NS/03-BusinessProcesses/Sagas/Version1-Aggregates`) and in the .NET 04 aggregates solution (`NS/04-Idempotency/Version1-Aggregates`), next to their group checkout entity definition tests, `failed group checkout ignores a later guest completion` - group checkout for A and B; A's failure and B's completion recorded (the group checkout fails); then A's completion recorded; asserts nothing published. Fails today in both, because the status never changes and A has no completion yet; passes once the status is set on completion and failure
- 3.4: throwaway in each to-do list `completed group checkout on the to-do list ignores a repeated guest checkout` - complete A and B, publish `GuestCheckedOut` for A again; asserts no `GroupCheckoutCompleted`/`GroupCheckoutFailed` published, no error, the list has no entry for it
- 3.5: existing to-do list test renamed to "guest checkout for group checkout not on the to-do list is ignored" (JVM `guestCheckoutForGroupCheckoutNotOnTheToDoList_IsIgnored`, .NET `GuestCheckoutForGroupCheckoutNotOnTheToDoList_IsIgnored`) - publishes `GuestCheckedOut` with a random group checkout id; asserts no error and the list unchanged; change it first, see it fail, then fix
- 4.1: throwaway `checking in the same guest again publishes GuestCheckedIn again` in Node.js 02 and 03 (JVM and .NET already pass) - asserts no error and `GuestCheckedIn` published
- 4.2: throwaway `initiating the same group checkout again publishes GroupCheckoutInitiated again` in Node.js 03 (JVM and .NET already pass) - asserts no error and the event published
- 5.1: all 02 and 03 solution tests in the three repositories pass
- extra: throwaway, process manager in each repository: completed group checkout ignores a later guest checkout failure
- extra: JVM 04 solution tests still pass (the "finished" and "same result twice" checks stay there)

Existing tests broken: the to-do list "not on the to-do list fails" test in the three repositories (see 3.5). Any 02/03 test asserting the Node.js throws: report it if found; none is known.
```

## Step 5. Node.js 03 aggregates saga solution

```text
Use the `implement-step` skill.

What to build
A Node.js attendee who chose aggregates has a 03 saga solution, next to the immutable entities one, in one sagas folder as in JVM.

Context
`DS/03_business_processes/regular/solution1_saga` (immutable entities, after Steps 3 and 4) moves to `DS/03_business_processes/regular/solution1_sagas/solution2_immutableEntities`; nothing links to `solution1_saga`. The move adds one folder level: imports such as `../../../tools` become `../../../../tools`. A new `solution1_sagas/solution1_aggregates` gets the same saga, facades, wiring and tests with the group checkout and guest stay account as aggregates. The Node.js aggregates style is in `DX/03_business_processes/regular/solution1_aggregates` (aggregate with enqueued events and `evolve`, `core.ts`) and `DS/02_entities_definition/regular/solution1_aggregates`. The group checkout aggregate has the 03 rules from Step 4: "finished" check, no "same result twice" check.

Similar code
JVM `JS/e03_businessprocesses/sagas/solution1_aggregates` (saga, `GroupCheckout` aggregate, facades, config); Node.js `DX/04_idempotency/regular/solution1_aggregates` (the same aggregates in Node.js, before 04 handling).

Blocked by
Step 3, Step 4

Acceptance criteria
- 6.1. GIVEN the Node.js 03 solutions WHEN listed THEN there is a `solution1_sagas` folder with `solution1_aggregates` and `solution2_immutableEntities` subfolders, as in JVM, and no `solution1_saga` folder.
- 6.2. GIVEN the aggregates saga solution WHEN its business process, group checkout entity definition and guest stay entity definition tests run THEN all pass, with the same test names as the other 03 solutions.
- 6.3. GIVEN it and the JVM aggregates saga solution WHEN compared THEN the saga handles the same events and sends the same commands, and the group checkout aggregate publishes the same events for the same commands.

Tests
- 6.1: check - `ls DS/03_business_processes/regular` shows `solution1_sagas` with both subfolders and no `solution1_saga`; `npm run build:ts` passes
- 6.2: `solution1_sagas/solution1_aggregates/businessProcess.solved.test.ts` (the 4 business process tests), `groupCheckouts/entityDefinitionTests.solved.test.ts` (5) and `guestStayAccounts/entityDefinitionTests.solved.test.ts` (6), copied with the same names from `solution2_immutableEntities` - all pass
- 6.3: check against JVM `sagas/solution1_aggregates` - same events handled, same commands sent; the 6.2 tests assert the published events
- extra: throwaway `completed group checkout ignores a later guest completion` and `group checkout in progress records the same guest completion twice` on the new aggregate (Step 4 rules), deleted after green
- extra: `npm run test:solved`, `npm run lint` pass

Existing tests broken: none; the moved immutable entities tests keep their names and pass.
```

## Step 6. 04 exercise is the 03 saga solution

```text
Use the `implement-step` skill.

What to build
An attendee starting 04 finds the code they finished in 03, without the obvious "finished" check and with charge and payment ids, and only the idempotency tests fail; the 04 solution is that exercise plus the idempotency handling.

Context
- The 04 exercise of each flavour is rebuilt from the 03 saga solution of that flavour (after Steps 3–5): `JS/e03_businessprocesses/sagas/<flavour>` → `JX/e04_idempotency/<flavour>`; `NS/03-BusinessProcesses/Sagas/<flavour>` → `NX/04-Idempotency/<flavour>`; `DS/03_business_processes/regular/solution1_sagas/<flavour>` → `DX/04_idempotency/regular/<flavour>`. Differences allowed: no "finished" check; Node.js immutable entities keep the guest list in the `Finished` state (Q13; today's Node.js 04 exercise already does); charge and payment ids in commands and events (.NET, JVM; copy them from today's 04 exercise).
- Tools: the 04 tools become the 03 tools plus the deliver-twice bus option. JVM: `JX/e04_idempotency/core` and `JS/e04_idempotency/core` match the e03 core the in-memory sagas use (no Kafka/RabbitMQ code). .NET: `NX/04-Idempotency/Core` and `NS/04-Idempotency/Core` match `NS/03-BusinessProcesses/Core` (adds `Database.GetAll`, `Subscribe(Type, …)`) plus `deliverTwice`; `Aggregate.cs` and `DictionaryExtensions.cs` move to the per-variant `Core` folders where 03 has them. Node.js: `DX/04_idempotency/tools` and `DS/04_idempotency/tools` match `DS/03_business_processes/tools` (adds `findAll`, `clone`) plus `deliverTwice`.
- Facade constructors: as in the 03 saga solution of the same repository.
- The 04 solutions (`JS/e04_idempotency/<flavour>`, `NS/04-Idempotency/<flavour>`, `DS/04_idempotency/regular/<flavour>`) become the new exercise plus today's idempotency handling, with the same tools. The Node.js immutable solution loses its unreachable "Group checkout already initiated!" throw (`businessLogic.ts` ~47–48).
- The existing 04 test files stay where they are in this step; only what new constructors or packages need changes. Step 7 moves them.

Similar code
Today's 04 exercises and solutions (they already differ only by idempotency in the group checkout and guest stay code); the 03 saga solutions after Steps 3–5.

Blocked by
Step 2, Step 3, Step 4, Step 5

Acceptance criteria
- 7.1. GIVEN a 04 exercise and the 03 saga solution of the same repository and flavour WHEN their module code is compared THEN the only differences are: no "finished" check in the group checkout, the guest list kept in the `Finished` state (Node.js immutable entities only), and charge and payment ids in commands and events (.NET, JVM).
- 7.2. GIVEN a 04 exercise and the 03 saga solution of the same repository WHEN their tools are compared THEN the only difference is the message bus option to deliver every message twice.
- 7.3. GIVEN a 04 exercise and its 04 solution WHEN compared THEN the tools are the same, and the module code differs only by the idempotency handling.
- 7.4. GIVEN a 04 exercise in any repository WHEN the same group checkout is initiated twice THEN `GroupCheckoutInitiated` is published twice.
- 7.5. GIVEN a 04 exercise WHEN the same guest is checked in twice THEN `GuestCheckedIn` is published twice and no error is thrown.
- 7.6. GIVEN a 04 exercise WHEN the same charge id or the same payment id is sent twice THEN `ChargeRecorded` or `PaymentRecorded` is published twice.
- 7.7. GIVEN a 04 exercise and a guest checked out for a group checkout WHEN the same checkout is sent again THEN the guest checkout failure event (guest not checked in) is published, because checking out a checked-out guest is a business rule, not a duplicate check.
- 7.8. GIVEN a 04 exercise and a group checkout in progress for guests A and B WHEN A's completion is recorded twice THEN `GuestCheckoutCompletionRecorded` for A is published twice.
- 7.9. GIVEN a 04 exercise and a group checkout for A and B that completed WHEN B's completion is recorded again THEN `GuestCheckoutCompletionRecorded` for B and `GroupCheckoutCompleted` are published again.
- 8.1. GIVEN a 04 exercise WHEN all its tests run THEN the business process, group checkout entity definition and guest stay entity definition tests pass, and the idempotency tests fail.
- 8.2. GIVEN a 04 solution WHEN all its tests run THEN all pass.
- 8.3. GIVEN the Node.js 04 immutable solution WHEN read THEN it has no "Group checkout already initiated!" throw.

Tests
- 7.1: check - `diff` of each module file between the 03 saga solution and the 04 exercise, per repository and flavour, shows only the listed items
- 7.2: check - `diff` of the tools shows only the deliver-twice option (in JVM, leave out the e03 core files used only by Kafka/RabbitMQ: MessageRouter, MessageRoutes, RoutingTarget, MessageFailureStrategy, RetryBackOff, RecordingFailureStrategy, UnreadableMessageException, CoreConfiguration, InMemorySpansConfiguration and their tests)
- 7.3: check - `diff` exercise vs solution: tools identical; module code differs only by idempotency handling
- 7.4: existing 04 idempotency test "group checkout is initiated once for the same id" - fails against the exercise because `GroupCheckoutInitiated` is published twice
- 7.5: existing "guest is checked in once for the same guest stay account" - fails against the exercise with `GuestCheckedIn` twice and no error
- 7.6: existing "charge is recorded once for the same charge id" and "payment is recorded once for the same payment id" - fail against the exercise with the event twice
- 7.7: existing "guest is checked out once for the same group checkout" - fails against the exercise; the second message is the guest checkout failure (not checked in)
- 7.8: existing "group checkout records once guest checkout completion" - fails against the exercise with two `GuestCheckoutCompletionRecorded` for A
- 7.9: existing "group checkout completes once when the last guest checkout completion is recorded twice" - fails against the exercise with `GuestCheckoutCompletionRecorded` for B and `GroupCheckoutCompleted` published again
- 8.1: run the 04 exercise tests in each repository - business process and entity definition tests pass, all 9 idempotency tests per flavour fail (JVM and .NET get the group checkout entity definition tests in Step 7; here only the guest stay and business process part is checked there)
- 8.2: run the 04 solution tests - all pass
- 8.3: check - `grep "Group checkout already initiated"` finds nothing in `DS/04_idempotency`
- extra: "the whole process completes once when the bus delivers every message twice" fails against the exercise and passes against the solution
- extra: JVM exercises compile; .NET builds without new warnings; Node.js `build:ts` and `lint` pass

Existing tests broken: none expected; the 03 saga and 04 tests build the facades the same way today (JVM `new GroupCheckoutFacade(database.collection(GroupCheckout.class), messageBus)`, .NET `new GroupCheckOutFacade(database, messageBus)`). If a package, namespace or Core move breaks a test, update imports only, not steps or expectations.
```

## Step 7. 04 tests next to the module they test

```text
Use the `implement-step` skill.

What to build
In every 04 exercise and solution, the business process and "bus delivers every message twice" tests are in the variant folder, and each module's entity definition and idempotency tests sit next to its code; JVM and .NET 04 also run the five group checkout entity definition tests from 03.

Context
- JVM `JX/e04_idempotency/<flavour>` and `JS/e04_idempotency/<flavour>`: flat `BusinessProcessTests.java`, `EntityDefinitionTests.java` (6 guest stay tests), `IdempotencyTests.java` (9 tests). 03 layout to follow: `JX/e03_businessprocesses/<flavour>/groupcheckouts/EntityDefinitionTests.java`, `gueststayaccounts/EntityDefinitionTests.java`.
- .NET `NX/04-Idempotency/<flavour>` and `NS/04-Idempotency/<flavour>`: flat `BusinessProcessTests.cs`, `EntityDefinitionTests.cs`, `IdempotencyTests.cs`. 03 layout: `NX/03-BusinessProcesses/<flavour>/GroupCheckouts/EntityDefinitionTests.cs`, `GuestStayAccounts/EntityDefinitionTests.cs`.
- Node.js `DX/04_idempotency/regular/<flavour>` and `DS/04_idempotency/regular/<flavour>` already have the layout; their helpers sit above the test cases (33 files in 04–06; change the 04 ones).
- Split: group checkout idempotency (initiated once, completion once, failure once, last completion twice) → group checkouts module; guest stay idempotency (check-in, charge, payment, checkout once) → guest stay accounts module; the root idempotency file keeps only the bus-delivers-twice test.
- Each file has its own setup built as the original file built it; test cases first, setup and helpers below. JVM exercise tests keep `@Tag("Exercise")`. .NET keeps its `[Trait]` usage as today.

Similar code
Node.js `DX/04_idempotency/regular/solution1_aggregates/groupCheckouts/idempotency.exercise.test.ts` and `guestStayAccounts/idempotency.exercise.test.ts` (which test goes where); each repository's 03 group checkout `EntityDefinitionTests` (the five tests and their setup).

Blocked by
Step 6

Acceptance criteria
- 9.1. GIVEN the group checkout idempotency tests WHEN read THEN there is one each for initiate (initiated once for the same id), record completion (recorded once), record failure (recorded once), and the last completion recorded twice (the group checkout completes once).
- 9.2. GIVEN the guest stay account idempotency tests WHEN read THEN there is one each for check in (checked in once), record charge (once for the same charge id), record payment (once for the same payment id) and check out (once for the same group checkout).
- 9.3. GIVEN the variant folder idempotency tests WHEN read THEN the only one is: the whole process completes once when the bus delivers every message twice, with the full list of published messages.
- 9.4. GIVEN any of these tests WHEN compared before and after THEN its steps and expected messages are the same.
- 11.1. GIVEN a 04 exercise or solution in any repository and flavour WHEN the group checkout entity definition tests are read THEN they are the five from 03: initiating succeeds; recording a completion succeeds; recording a failure succeeds; the last completion completes the group checkout; the last result after a failure fails it.
- 11.2. GIVEN the JVM and .NET 04 before the change WHEN listed THEN these tests are missing, and after the change they are there.
- 12.1. GIVEN a 04 exercise or solution in any repository and flavour WHEN listed THEN the variant folder has the business process tests and the bus-delivers-twice test; the group checkouts module has its entity definition and idempotency tests; the guest stay accounts module has its entity definition and idempotency tests.
- 12.2. GIVEN any 04 test file WHEN read THEN the test cases come first, setup and helpers below them.
- 12.3. GIVEN the same test in two repositories WHEN compared THEN it has the same name (apart from casing), sits in the same module, and has the same steps and expected messages.
- 12.4. GIVEN a JVM 04 exercise test WHEN read THEN it has the exercise marker.

Tests
- 9.1: the four group checkout idempotency tests in the group checkouts module - assert one `GroupCheckoutInitiated`, one `GuestCheckoutCompletionRecorded`, one `GuestCheckoutFailureRecorded`, and one `GuestCheckoutCompletionRecorded` plus one `GroupCheckoutCompleted`; pass against the solution, fail against the exercise
- 9.2: the four guest stay idempotency tests in the guest stay accounts module - assert one `GuestCheckedIn`, `ChargeRecorded`, `PaymentRecorded`, `GuestCheckedOut`
- 9.3: the root bus-delivers-twice test - asserts the full message list
- 9.4: check - a diff of each moved test body against its original shows only file and setup moves
- 11.1: `groupCheckouts`/`GroupCheckouts` entity definition tests "initiating group checkout succeeds", "recording guest checkout completion succeeds", "recording guest checkout failure succeeds", "recording last guest checkout completion completes group checkout", "recording last guest checkout after failure fails group checkout" - assert the published group checkout events; pass against the exercise and the solution
- 11.2: check - listing JVM and .NET 04 before and after
- 12.1: check - listing every 04 variant folder
- 12.2: check - every 04 test file starts with test cases; Node.js helpers moved below (references to later declarations only inside callbacks)
- 12.3: check - test names per module file compared across the three repositories (ignoring casing and separators)
- 12.4: check - every JVM 04 exercise test method has `@Tag("Exercise")`
- extra: 04 exercise run - only the idempotency tests fail; 04 solution run - all pass

Existing tests broken: none removed; files are split and moved. Update packages/namespaces and imports for the moved files.
```

## Step 8. 04 README and full verification

```text
Use the `implement-step` skill.

What to build
An attendee reading the 04 README in any repository learns where the tests are and can open each one; all three workshops are green.

Context
`JX/e04_idempotency/README.md`, `NX/04-Idempotency/README.md`, `DX/04_idempotency/README.md`. Each already has a "Use … tests" bullet; JVM and .NET link the old flat files. Keep each repository's variant labels (JVM "DDD Aggregate" / "Functional Decider", .NET "Aggregates" / "Immutable Entities", Node.js "aggregates" / "immutable entities"). No manual line breaks inside Markdown paragraphs.

Similar code
Node.js `DX/05_optimistic_concurrency/README.md` (links module test files per variant).

Blocked by
Step 7

Acceptance criteria
- 14.1. GIVEN the 04 README in any repository WHEN read THEN one short paragraph says the business process and bus-delivers-twice tests are in the variant folder and the module tests sit next to the module's code, and it links each test file for each variant.
- 14.2. GIVEN any link in it WHEN followed THEN it opens an existing file.
- 15.1. GIVEN JVM WHEN the solved tests run without cache THEN all pass, and the exercises compile.
- 15.2. GIVEN .NET WHEN all tests run THEN every solution project passes, and the only failures are exercise tests expected to fail.
- 15.3. GIVEN Node.js WHEN the solved tests, type check and lint run THEN they pass.
- 15.4. GIVEN any test run WHEN its output is read THEN it has no new warnings.

Tests
- 14.1: check - each README has the paragraph and a link per test file per variant
- 14.2: check - a script resolves every relative link in the three READMEs
- 15.1: `./gradlew test --rerun` in `solved/`, `./gradlew compileTestJava` in `exercises/`
- 15.2: `dotnet test --solution EventDrivenArchitecture.slnx` - all `Solutions/` projects pass; failures only in exercise projects
- 15.3: `npm run test:solved`, `npm run build:ts`, `npm run lint`
- 15.4: check - the outputs of 15.1–15.3 have no warnings from the workshop code; report any found
- extra: update `/home/oskar/repos/EventSourcing.NodeJS/alignment.md` 04 section with the result

Existing tests broken: none.
```

## Step 9. Node.js database serializes, one aggregate implementation, guest list as a Record

```text
Use the `implement-step` skill.

What to build
A document loaded from any Node.js workshop database is a separate copy that survives JSON, like in JVM and .NET: aggregates and process managers come back as their class with their state and no pending messages, immutable entities as plain data, dates as `Date`, the group checkout guest list as a plain object. All Node.js aggregates and process managers are written one way that works with it.

Context
- Databases: every Node.js `tools/database.ts` from 02 to 06, exercises and solutions (`DX/02…06/tools`, `DS/02…05/tools`, `DS/06_consistency/publish_asynchronously/tools`, `DS/06_consistency/publish_right_away/tools`). Today the 02, 03 and 04 databases make a shallow copy in `get` (and `findAll` in DS/03 and 04, which the to-do list uses): `Object.assign(Object.create(prototype), stored)`; the 05 and 06 databases deep-copy with `structuredClone` + `setPrototypeOf` on store and get (their comment about `structuredClone` dropping the class goes with that code); 05 adds versions; 06 adds `transaction`, `getAll` with `position`, and its outbox stores whole events (with `Date` fields). Every loading method (`get`, `findAll`, `getAll`) uses the new deserialization. The `eslint-disable` lines for `no-unsafe-*` in the copying code go with it (`JSONSerializer.deserialize<T>` is typed). New: store `JSONSerializer.serialize(document)`, load `JSONSerializer.deserialize(json, { parseDates: true })` (Emmett `@event-driven-io/emmett`, already a dependency); `collection<T>(name, type?: new () => T)`, and with a type the parsed data is assigned to `new type()`. The same signature for 06 `transaction.collection`. Nothing else copies.
- Aggregate base classes (`core.ts`): 02 aggregates solution, 03 aggregates exercise, 03 process managers (`Aggregate` and `ProcessManager`) use `#` fields and arrow-function methods; 03 aggregates saga, 04, 05 use `private uncommitedEvents`. All become one implementation: `#` pending field with the comment "Not stored, so it's empty after loading", normal methods. `ProcessManager` stays its own base class, written the same way.
- Aggregates and process managers (every class extending `Aggregate`/`ProcessManager` in 02–05: 02 aggregates solution; 03 aggregates exercise; `DS/03…/solution1_sagas/solution1_aggregates`; `DS/03…/solution2_process_managers`; 04 and 05 aggregates exercises and solutions): `private constructor()` becomes a public constructor without parameters with the comment "Public constructor without parameters, used when loading from the database"; arrow-function methods become normal methods; static arrow factories (`static checkInGuest = …`, `static initiate = …`) become static methods; state fields stay `private`.
- Facades: every facade of an aggregate or process manager passes its class, e.g. `database.collection('guestStayAccount', GuestStayAccount)`; immutable entities pass nothing. Facades that store before dequeuing (02 aggregates solution `guestStayFacade.ts`, 03 aggregates exercise `guestStayAccountFacade.ts`, 03 process managers `guestStayAccountFacade.ts` and `groupCheckoutFacade.ts`) dequeue first, as the 04 facades do.
- Guest list: every Node.js group checkout from 03 to 06 (both flavours) and the 03 to-do list's `solution4_todo_list/groupCheckouts/groupCheckout.ts` keep `guestStayCheckouts` as `Record<string, CheckoutStatus>`; aggregates and process managers change it in place (`this.guestStayCheckouts[id] = …`); immutable entities create new state in both `decide` and `evolve` (today `evolve` does `state.guestStayCheckouts.set(...)` in place).
- 03 aggregates exercise: `groupCheckouts/groupCheckout.ts` gets `export class GroupCheckout extends Aggregate<GroupCheckoutEvent>` with only the commented public constructor and `evolve(_event) { throw new Error('TODO: Fill the implementation'); }`; its facade passes it. 02 exercise facades (`regular`, `emmett`) get the TODO from 16.6 and the 02 README the same sentence.
- A throwaway round trip was checked during spec review: public constructor + `Object.assign` + `#` pending field works, `#` fields aren't serialized, `Date` comes back with `parseDates: true`, `Map` becomes `{}`.

Similar code
JVM `JS/e03_businessprocesses/core/Database.java` (`mapper.readValue(mapper.writeValueAsString(v), typeClass)`), `JS/e03_businessprocesses/processmanagers/core/AbstractProcessManager.java` (`@JsonIgnore` pending messages), JVM empty exercise class `JX/e03_businessprocesses/solution1_aggregates/groupcheckouts/GroupCheckout.java`; Node.js 04 facades for dequeue-before-store (`DS/04_idempotency/regular/solution1_aggregates/guestStayAccounts/guestStayAccountFacade.ts`).

Blocked by
None (steps 1–8 are done)

Acceptance criteria
- 16.1. GIVEN any Node.js database from 02 to 06, exercise or solution WHEN read THEN storing writes `JSONSerializer.serialize(document)` and loading returns `JSONSerializer.deserialize(json, { parseDates: true })`; when the collection has a class, the parsed data is assigned to a new object created with the class's constructor; no other copying.
- 16.2. GIVEN the Node.js 06 outbox WHEN an event with `checkedOutAt` is stored and published from the outbox THEN the published event's `checkedOutAt` is a `Date` equal to the stored one (protects existing behaviour: the 06 tests compare published events exactly).
- 16.3. GIVEN every Node.js facade that loads an aggregate or a process manager WHEN read THEN its collection is created with that class; facades of immutable entities create theirs without a class.
- 16.5. GIVEN the Node.js 03 aggregates exercise group checkout facade WHEN read THEN it creates its collection with the `GroupCheckout` class from `groupCheckouts/groupCheckout.ts`, which extends `Aggregate<GroupCheckoutEvent>` and has only the public constructor with the comment "Public constructor without parameters, used when loading from the database" and an `evolve` that throws "TODO: Fill the implementation"; the exercise type check passes; the 03 immutable entities exercise and the 02 exercise facades create theirs without a class.
- 16.6. GIVEN the Node.js 02 exercise facades (`regular` and `emmett`) and the 02 README WHEN read THEN each facade has the TODO "If your guest stay account is a class, pass it here: `database.collection('guestStayAccount', GuestStayAccount)`. It needs a public constructor without parameters" at its `database.collection(...)` call, and the README says the same.
- 16.4. (protects existing behaviour) GIVEN every Node.js test from 02 to 06 WHEN run THEN the solutions pass, and in the exercises the same tests fail as before this change.
- 17.1. GIVEN the Node.js aggregates from 02 to 06, exercises and solutions WHEN read THEN they extend one aggregate base class implementation with a `#` uncommitted events field and normal methods, their own methods are normal methods with `private` state fields, they have a public constructor without parameters with the comment "Public constructor without parameters, used when loading from the database", the base classes' `#` pending field has the comment "Not stored, so it's empty after loading", and their factories are static methods; no arrow-function properties. The 03 process managers extend `ProcessManager`, written the same way (a `#` uncommitted messages field, normal methods), and their factory `initiate` is a static method.
- 17.3. GIVEN a Node.js aggregate or process manager with pending events or messages WHEN it is stored and loaded again THEN the stored JSON has no pending events or messages, the loaded one has none, and every facade dequeues before storing; e.g. checking in a guest and then recording a charge publishes `GuestCheckedIn` once and `ChargeRecorded` once (protects existing behaviour: the entity definition tests check exactly this with strict comparison).
- 17.2. GIVEN the 02 aggregates solution, the 03 aggregates exercise and the 03 process managers WHEN their tests run THEN they pass as before (protects existing behaviour; exercise tests that fail today still fail).
- 18.1. GIVEN every Node.js group checkout from 03 to 06, both flavours, exercises and solutions, and the 03 to-do list's group checkout document WHEN read THEN its guest list is a `Record<string, CheckoutStatus>`, not a `Map`; aggregates and process managers change it in place, immutable entities create new state.
- 18.2. GIVEN a group checkout for A and B stored and loaded again WHEN A's completion is recorded THEN `GuestCheckoutCompletionRecorded` for A is published and B is still in progress (protects existing behaviour: the business process and entity definition tests cover it).

Tests
- 16.1: check - every 02–06 `database.ts` stores with `JSONSerializer.serialize` and loads with `JSONSerializer.deserialize(json, { parseDates: true })`, `Object.assign(new type(), data)` when a type is given; no other copy
- 16.2: existing 06 tests (business process, idempotency, optimistic concurrency, entity definition) compare published events exactly after the outbox round trip - pass (protects existing behaviour)
- 16.3: check - every aggregate/process manager facade passes its class; immutable facades pass none
- 16.5: check - the 03 aggregates exercise class and facade as described; `npm run build:ts` passes
- 16.6: check - the TODO text in both 02 facades and the README sentence
- 16.4: `npm run test:solved` passes; `npm run test:exercises` shows the same failing tests per exercise as before the step (record the list before, compare after)
- 17.1: check - every `Aggregate`/`ProcessManager` subclass and base class in 02–05: `#` pending field with its comment, normal methods, public commented constructor, static-method factories, no arrow-function properties
- 17.3: existing entity definition tests "recording charge for checked in guest succeeds" (and the other guest stay / group checkout entity tests) - check in, reset, then one command; assert exactly one event with strict comparison (protects existing behaviour); plus check - no stored JSON contains `uncommitedEvents` / `uncommitedMessages`
- 17.2: the 02 aggregates solution, 03 aggregates exercise and 03 process managers test files - pass as before; the 03 exercise failures unchanged
- 18.1: check - no `Map` in any group checkout state or the to-do list document in 03–06; in-place writes only in aggregates and process managers
- 18.2: existing business process tests (group checkout for A, B, C: completion recorded for A while others are in progress) - pass after the guest list is stored and loaded as JSON (protects existing behaviour)
- extra: throwaway test `a loaded document is a separate copy` - red today, green after, then deleted: (1) in `DS/04_idempotency/regular/solution2_immutableEntities`, store a group checkout for A and B, load it, record A's completion on the loaded state without storing, load again; asserts A is still in progress (today the shared `Map` leaks); (2) in `DS/03_business_processes/regular/solution2_process_managers`, store a group checkout process manager, load it, call a method on the loaded one without storing, load again; asserts the stored state is unchanged (today arrow methods change the stored instance)
- extra: `npm run build:ts`, `npm run lint` pass

Existing tests broken: none expected. Tests that build state with a `Map` (if any) change to a `Record`; report them.
```

## Step 10. Node.js tests don't pass a type argument to the message catcher

```text
Use the `implement-step` skill.

What to build
Node.js tests call `shouldReceiveMessages([...])` without a type argument; the `ExpectedTypes` aliases go.

Context
20 Node.js test files from 03 to 06 declare `type ExpectedTypes = GroupCheckoutEvent | GuestStayAccountEvent | GroupCheckoutCommand | GuestStayAccountCommand` and call `shouldReceiveMessages<ExpectedTypes>(…)`; some idempotency and entity tests call `shouldReceiveMessages<GroupCheckoutEvent>(…)`. Remove every type argument to `shouldReceiveMessages` in 03–06 test files, and the aliases. The message catchers' `shouldReceiveMessages<ExpectedTypes extends Message>(…)` signature stays.

Similar code
Node.js tests that already call `shouldReceiveMessages([...])` without a type argument (e.g. 04 guest stay idempotency tests).

Blocked by
Step 9 (both change the same Node.js test and facade folders; running them in order avoids conflicting edits)

Acceptance criteria
- 19.1. GIVEN every Node.js test file from 03 to 06, exercises and solutions WHEN read THEN no call passes a type argument to `shouldReceiveMessages`, and no test file declares `type ExpectedTypes`.
- 19.2. GIVEN the message catcher copies WHEN read THEN their `shouldReceiveMessages` signature is unchanged.
- 19.3. GIVEN the Node.js workshop WHEN the type check runs THEN it passes.

Tests
- 19.1: check - `grep -rn "shouldReceiveMessages<" src --include="*.test.ts"` and `grep -rn "type ExpectedTypes" src --include="*.test.ts"` in 03–06 find nothing
- 19.2: check - no `tools/messageCatcher.ts` changes in this step (compare with a copy taken before the step; earlier steps already changed the 02–04 copies)
- 19.3: `npm run build:ts` passes; `npm run lint` passes; `npm run test:solved` passes (protects existing behaviour)

Existing tests broken: none; only types change. Imports that become unused (event and command unions used only by `ExpectedTypes`) are removed so `npm run lint` passes.
```

## Step 11. A command from the bus for a missing entity is ignored

```text
Use the `implement-step` skill.

What to build
In every 03 solution, the facades given in the 03 exercises, and the 04 exercises and solutions of all three repositories, a message from the bus for a group checkout or guest stay account that doesn't exist does nothing and throws nothing.

Context
- Record a guest result for a missing group checkout: sagas and 04 handle `RecordGuestCheckoutCompletion` / `RecordGuestCheckoutFailure` (JVM `…/groupcheckouts/GroupCheckoutFacade.java` and .NET `…/GroupCheckouts/GroupCheckoutFacade.cs` throw "Entity not found"; Node.js returns); process managers and choreography handle `GuestCheckedOut` / `GuestCheckoutFailed` with a group checkout id (JVM `processmanagers`/`choreography` and .NET `ProcessManagers`/`Choreography` `GroupCheckoutFacade` throw; Node.js returns).
- Check out a missing guest (`CheckOutGuest` from the bus): guest stay facades in every 03 solution (saga, process manager, choreography, to-do list), the 03 exercise facades given to the attendee, and 04, in all three repositories, throw "Entity not found"; Node.js immutable entities load `?? initial` and publish `GuestCheckoutFailed` (`NotCheckedIn`) - that also becomes "do nothing".
- The 03 exercise group checkout facades the attendee completes (`recordGuestCheckoutCompletion` / `recordGuestCheckoutFailure`) start by throwing "Entity not found" for a missing group checkout in all three repositories (Node.js `DX/03_business_processes/regular/*/groupCheckouts/groupCheckoutFacade.ts` ~53, ~70; JVM `JX/e03_businessprocesses/*/groupcheckouts/GroupCheckoutFacade.java` ~29, ~44; .NET `NX/03-BusinessProcesses/*/GroupCheckouts/GroupCheckoutFacade.cs` ~22, ~41); that check returns quietly instead, the rest of the skeleton (store, publish, TODO error) stays (Q39).
- Not affected: the JVM `transactions` solution (no bus-triggered methods); 05 and 06.

Similar code
Node.js 03 saga `groupCheckoutFacade.ts` (`if (!groupCheckout) return;`); the to-do lists after Step 4 (ignore an unknown group checkout).

Blocked by
Step 9 (Node.js facades change there)

Acceptance criteria
- 20.1. GIVEN any 03 solution (saga, process manager, choreography, to-do list), a facade given in a 03 exercise, or a 04 exercise or solution, any repository and flavour, and no group checkout with id X WHEN the message that records a guest result for X arrives (`RecordGuestCheckoutCompletion` / `RecordGuestCheckoutFailure` in sagas and 04; `GuestCheckedOut` / `GuestCheckoutFailed` with group checkout id X in process managers and choreography) THEN nothing is published and no error is thrown.
- 20.2. GIVEN the same and no guest stay account with id A WHEN `CheckOutGuest` for A arrives THEN nothing is published (in Node.js immutable entities also no `GuestCheckoutFailed`) and no error is thrown.

Tests
(Checked once with throwaway tests per spec Testing Decisions, then deleted; .NET uses its own event names.)
- 20.1: throwaway `recording a guest result for a missing group checkout is ignored` - in each 03 solution, each given 03 exercise facade, and 04 exercise and solution, per repository and flavour: send the record-result message for a random group checkout id; asserts nothing published, no error; red where it throws today
- 20.2: throwaway `checking out a missing guest is ignored` - send `CheckOutGuest` (Node.js: `CheckoutGuest`) for a random account id; asserts nothing published (Node.js immutable entities: no `GuestCheckoutFailed`), no error
- extra: the 03/04 business process and idempotency tests still pass (protects existing behaviour)
- extra: JVM `./gradlew test --rerun` in `solved/` and exercises compile; .NET `dotnet test --solution EventDrivenArchitecture.slnx` (solution projects pass); Node.js `npm run test:solved`, `build:ts`, `lint`

Existing tests broken: none known; any test expecting "Entity not found" from these methods - report it.
```
