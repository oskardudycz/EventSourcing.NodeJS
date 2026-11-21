# EDA workshop alignment: Q&A

## Q1 (spec r1)

**Question:** What does each exercise teach?

- 01 Events definition: describe what happens in guest stay accounts and group checkouts as events.
- 02 Entities definition: turn a command into events through an entity (aggregate or immutable entity); the facade loads, decides, stores and publishes.
- 03 Business processes: coordinate two modules through messages on one bus (saga, process manager, choreography, to-do list).
- 04 Idempotency: a message delivered twice gives the same result as once.
- 05 Optimistic concurrency: concurrent handlers don't lose updates; store with the loaded version and retry on conflict.
- 06 Consistency: storing and publishing can fail separately; an outbox keeps published messages matching stored state.

**Answer (Oskar, 2026-11-17):** Yes, it's fine.

## Q2 (spec r1)

**Question:** Should the 04 exercise start exactly from the 03 solution, so the attendee only adds duplicate handling?

**Answer (Oskar, 2026-11-17):** Yes. The 04 exercise starts from the 03 saga solution, split by flavour: the 04 aggregates exercise from the 03 aggregates saga solution, the 04 immutable entities exercise from the 03 immutable entities saga solution.

Consequence: Node.js needs a 03 aggregates saga solution, because it has only the immutable entities one (`solution1_saga`).

## Q3 (spec r1)

**Question:** JVM 03 saga solutions and the message bus: should they use the bus as .NET does?

**Answer (Oskar, 2026-11-17):** They already do (the config subscribes on the `MessageBus`, calls the saga and publishes its commands, as in .NET). Fine as it is.

## Q4 (spec r1)

**Question:** In the 03 solutions, how should the group checkout handle (case 1) the same guest result arriving twice and (case 2) a guest result arriving after the group checkout finished?

**Answer (Oskar, 2026-11-17):** The JVM 03 solutions are correct: they ignore both. Node.js and .NET 03 solutions follow JVM. The 04 exercise must not handle the idempotency cases, because fixing them is the goal of 04.

Refines Q2: the 04 exercise is the 03 saga solution of the same flavour with its idempotency handling taken out.

## Q5 (spec r1)

**Question:** In the 04 exercise, is "ignore a guest result after the group checkout finished" kept from 03 or taken out?

**Answer (Oskar, 2026-11-17):** Leave all idempotency unhandled in the 04 exercise.

Reading (stated to Oskar for correction): both checks are taken out of the 04 exercise (the same guest result twice, and a result after the group checkout finished), as the JVM 04 exercise does today. The 04 exercise also has no handling for a repeated initiation, check-in, charge id, payment id or checkout. Node.js 02/03 stop throwing on a repeated check-in or initiation, following JVM (Q4).

## Q6 (spec r1)

**Question:** Are the 04 tests right?

**Answer (Oskar, 2026-11-17):** Every facade method has an idempotency test.

Checked against the code: the 04 facades have seven methods in every repository and flavour (group checkout: initiate, record completion, record failure; guest stay account: check in, record charge, record payment, check out), and each has a test today (tests 1–7). Exception: .NET Version1 `GuestStayFacade` in 04–06 still has `InitiateGroupCheckout` from 02, used only by the old `GroupCheckoutForMultipleGuestStay_ShouldBeInitiated` test; both go, as agreed on 2026-11-11, so no facade method is left without an idempotency test.

## Q7 (spec r1)

**Question:** Should Node.js compare published messages exactly, like JVM and .NET?

**Answer (Oskar, 2026-11-17):** Already decided: JVM is the reference, and the other repositories follow it. So yes, Node.js `shouldReceiveMessages` compares exactly, as JVM does.

## Q8 (spec r3)

**Question:** Should the 03 solutions get their own tests for the two group checkout rules (repeated guest result, result after the group checkout finished)?

**Answer (Oskar, 2026-11-17):** No separate 03 tests. Idempotency is tested per facade method (Q6), in 04: the 04 tests for record completion, record failure and the last result recorded twice cover these rules.

## Q9 (spec r4): answers to the spec r3 review

**Answers (Oskar, 2026-11-17):**

- "We shouldn't check idempotency before 04." So no repository checks idempotency in 02 or 03, solutions included: no ignoring a repeated guest result, no ignoring a result after the group checkout finished, no throwing or ignoring on a repeated check-in or initiation. This corrects the reading recorded under Q4 ("the JVM 03 solutions are correct: they ignore both"): Oskar's "JVM is the correct one" was about the 04 solution, and the JVM 03 solutions lose these checks too. The 04 exercise is then the 03 saga solution of the same flavour, unchanged apart from what 04 adds (Q2, Q5).
- "Ignore 05 and 06 for now." Nothing in 05 or 06 changes, including the .NET leftover `InitiateGroupCheckout` and the Node.js message catcher copies there.
- Tools and module code: "they should be consistent and module code should match." The 04 tools are the 03 tools plus the deliver-twice option, in the exercise and the solution; the module code (group checkouts, guest stay accounts, saga, wiring) of the 04 exercise matches the 03 saga solution.
- A repeated initiation of the same group checkout id can only be a redelivered message, which is 04's concern; in 03 a second group checkout has its own id. Node.js `evolve` checks on status only narrow the state type and stay as they are.

## Q10 (spec r5)

**Question:** Where does the Node.js 03 aggregates saga solution go?

**Answer (Oskar, 2026-11-17):** Consistent with JVM: one sagas folder with a subfolder per flavour (JVM `sagas/solution1_aggregates`, `sagas/solution2_immutableentities`). Node.js: `solution1_saga` becomes `solution1_sagas`, with `solution1_aggregates` and `solution2_immutableEntities` inside (Node.js variant casing, as in its exercises). Reading (stated to Oskar for correction): the folder keeps its place in the numbered Node.js list, so its name is `solution1_sagas` rather than JVM's `sagas`.

## Q11 (spec r6): answers to the spec r5 review

**Answers (Oskar, 2026-11-17):**

- Saga shape: "it should be using message bus as in other places not saga result, see .NET order saga example" and "all needs to be consistent". The model is `EventSourcing.NetCore/Sample/ECommerce/Orders/Orders/Orders/OrderSaga.cs`: the saga gets the bus, has one handler per event it reacts to, and sends the commands itself; it returns nothing, and there is no `SagaResult`. All saga solutions in scope follow it, in all three repositories (03 saga solutions, the 04 exercises and solutions that start from them).
- "Result after the group checkout finished": "Why do you need this list if group checkout is done? If it makes things weird then some idempotency we can have already." So the group checkout keeps ignoring results after it finished, already in 03, in every repository; the finished state doesn't keep the guest list. This replaces the part of Q9 and Q5 that took that check out of 03 and of the 04 exercise. Ignoring the same guest result recorded twice while the group checkout is in progress stays 04's work.
- Dead throw "Group checkout already initiated!" in the Node.js 04 immutable solution: "Drop it."
- JVM `SagaResult` placement: moot, `SagaResult` goes.

## Q12 (spec r7): answers to the spec r6 review

**Answers (Oskar, 2026-11-17):**

- The "last completion recorded twice completes the group checkout once" test passed against the 04 exercise once the "finished" rule moved into 03. Answer: "You can change exercise code not to check if it's closed or opened." So the 04 exercise doesn't have the "finished" check: the 04 exercise is the 03 saga solution without it, and the attendee adds it back in 04 with the other checks. The 03 solutions keep it (Q11). The test stays as it is and fails against the 04 exercise.
- To-do list: asked whether it should also ignore results after the group checkout finished, like the other solutions, instead of throwing "Entity not found". Answer: "ok". Reading (stated to Oskar for correction): yes, the to-do list ignores them too, in all three repositories.
- Reviewer findings fixed in the spec without a question: the .NET aggregates "same result twice" check goes from 03; the .NET 04 aggregates solution gets the status fix too; the Node.js process manager gets the "finished" rule; the guest-list remark was about Node.js only (JVM and .NET keep their state as it is); the .NET 04 `Aggregate.cs` and `DictionaryExtensions.cs` move to per-variant Core folders as in 03.

## Q13 (spec r8): answers to the spec r7 review

**Answers (Oskar, 2026-11-17):**

- Node.js state shape: "Yes, you can keep in 03 some idempotence check that are obvious, but drop them in 04." So the Node.js 03 solutions keep their state as it is (a finished group checkout has no guest list) and keep the "finished" check. The 04 exercise drops the check and keeps the guest list when the group checkout finishes, as Node.js 04 does today; the 04 solution adds the check back.
- To-do list: "I don't understand why todolist would behave differently." The to-do list follows the same rule as the other 03 solutions: a finished group checkout ignores later guest results. How it tells a finished group checkout from an unknown one: asked, see Q14.

## Q14 (spec r8)

**Question:** The to-do list deletes a group checkout when it finishes, so it can't tell a finished group checkout from an unknown one. Keep finished ones on the list marked as finished, or ignore every result for a group checkout not on the list?

**Answer (Oskar, 2026-11-17):** "It shouldn't throw anything as this won't help in async world." So the to-do list ignores a guest result for a group checkout that isn't on its list, in all three repositories. The existing test "guest checkout for group checkout not on the to-do list fails" changes to expect that the result is ignored (nothing published, no error). Finished group checkouts are still removed from the list.

## Q15 (plan r3)

**Question:** The new Node.js 03 aggregates saga follows the existing Node.js aggregates, which use an `Aggregate` base class (`GroupCheckout extends Aggregate`), while AGENTS.md prefers functions and closures over classes. Keep classes for aggregates?

**Answer (Oskar, 2026-11-18):** Yes, keep classes.

## Q16 (brainstorm after plan r3): answers to the step 4 and step 5 reviews

**Answers (Oskar, 2026-11-18):**

- To-do list test (step 4 review, Step-1): "Don't add, we test outside in." The renamed test stays as it is.
- Node.js aggregate base class (step 5 review, Standards-1): "we shouldn't be doing shallow copy then, and I didn't agree to take it out of scope. And the implementation should be aligned." So the Node.js `Database` returns a deep copy on load, as JVM and .NET do (JSON round trip), and the Node.js aggregates use one implementation.

Checked on a copy of the workshop: with a deep copy (`structuredClone` into an object with the stored prototype) in the 02–04 databases, every solution test passes except those whose aggregates keep methods as arrow-function properties (02 aggregates solution, 03 process managers), which fail with `DataCloneError`, and the 03 aggregates exercise has the same arrow style. The 04 style (normal methods, TypeScript `private` fields) works with the deep copy.

## Q17 (brainstorm after plan r3)

**Question:** The Node.js tests use `type ExpectedTypes = GroupCheckoutEvent | GuestStayAccountEvent | GroupCheckoutCommand | GuestStayAccountCommand` as the type argument of `shouldReceiveMessages`. Keep it?

**Answer (Oskar, 2026-11-18):** "Then type it should be as close to the expectations as possible and better if it was named in a more meaningful way." So each such alias lists only the message types its tests expect, and has a name that says what those messages are.

Correction to Q16 (2026-11-18): the `DataCloneError` came from cloning whole aggregates. A deep copy that creates a fresh instance with the document's constructor and copies only the data fields with `structuredClone` passes all solution tests with no aggregate change, and leaves the exercise failures unchanged (checked on a copy of the workshop).

## Q18 (brainstorm after plan r3)

**Question:** Where should the Node.js database deep copy go: a) 02, 03 and 04 only, with 05 and 06 later along with the rest of their alignment, or b) every copy from 02 to 06 now?

**Answer (Oskar, 2026-11-18):** b

## Q19 (brainstorm after plan r3)

**Question:** Which aggregate base class should every Node.js aggregate use, from 02 to 06: the 02/03 version (`#uncommitedEvents`, arrow-function properties) or the 04 version (`private uncommitedEvents`, normal methods)?

**Answer (Oskar, 2026-11-18):** "It shouldn't have two versions, as I said. Dude, I don't care as long is consistent. This is wrong question, as you didn't tell me how it passes the deep clone"

So: one version for every Node.js aggregate, 02–06; the choice is left to the implementation, which takes the 04 version (closer to JVM `AbstractAggregate`) unless the deep copy explanation shows a reason against it.

## Q20 (brainstorm after plan r3)

**Question:** How should a Node.js collection turn stored JSON back into an aggregate: a) like JVM, the collection gets the class and gives the parsed data its prototype (aggregates need normal methods and normal fields), or b) each aggregate has a `from(state)` and the database only handles JSON?

**Answer (Oskar, 2026-11-18):** "ok, but prototype should be optional. Would it work with maps?"

Follow-up to Q20 (Oskar, 2026-11-18): "what about using records instead of maps?"

## Q21 (brainstorm after plan r3)

**Question:** Do we replace `Map` with `Record` in every Node.js group checkout state from 03 to 06, and handle `Date` with a reviver in the database's `JSON.parse`?

**Answer (Oskar, 2026-11-18):** yup

Follow-up to Q21 (Oskar, 2026-11-18): "you can use emmett serializer, it can handle dates". Checked: `JSONSerializer` from `@event-driven-io/emmett` (0.43.0-rc.2, already a workshop dependency) turns a `Date` back into a `Date` with `deserialize(json, { parseDates: true })`; without `parseDates` it returns the ISO string. So the Node.js database serializes with `JSONSerializer.serialize` and deserializes with `JSONSerializer.deserialize(json, { parseDates: true })`, instead of a hand-written reviver.

## Q22 (brainstorm after plan r3)

**Question:** The `ExpectedTypes` alias is in 20 Node.js test files from 03 to 06. Does listing only the expected messages under a meaningful name cover all of them, 03–06, or only 03 and 04 for now?

**Answer (Oskar, 2026-11-18):** yes

Reading (stated to Oskar for correction): all of them, 03–06.

## Q23 (spec r10): answers to the spec r9 review, spec findings

**Answers (Oskar, 2026-11-18):**

- Stale Implementation Decision (the 03 aggregates saga follows the 02/03 style): "Then fix this obsolete line".
- Static arrow factories (`static checkInGuest = (data) => …`) vs static methods, after hearing that static methods are the usual TypeScript way and match JVM/.NET: "Then be consistent". Reading: every Node.js aggregate factory is a static method.
- Collection class parameter typed by its prototype (`type?: { prototype: T }`), which accepts classes with a private constructor: "ok".
- The type argument of `shouldReceiveMessages`, after hearing it only matters for the type check: "Then don't pass it in run". Reading to confirm: see Q24.

## Q24 (spec r10)

**Question:** For "don't pass it": the tests call `shouldReceiveMessages([...])` without a type argument, the `ExpectedTypes` aliases in the tests go, and the check that catches a misspelled field in an expected message is lost unless a test types its messages where it builds them. Is that it?

**Answer (Oskar, 2026-11-18):** yes

This replaces Q17 and Q22 (renaming the aliases): the aliases are removed in 03–06 instead.

## Q25 (spec r10)

**Question:** Should the Node.js 03 process managers' `ProcessManager` base class stay as its own base class, like JVM's `AbstractProcessManager`, rewritten the same way as the aggregate base class (a `private` field and normal methods), or merge into the one aggregate base class?

**Answer (Oskar, 2026-11-18):** rewritten the same way as aggregate

## Q26 (spec r10)

**Question:** Should aggregates and process managers keep changing their own guest list field in place (`this.guestStayCheckouts[id] = 'Completed'`), with only immutable entities creating new objects, or should every change create a new object?

**Answer (Oskar, 2026-11-18):** yes

Reading (stated to Oskar for correction): the first option. Aggregates and process managers change their own field in place; immutable entities create new state, as they do today.

## Q27 (spec r10)

**Question:** Two facade methods are called by commands from the bus: record guest completion / failure (Node.js ignores a missing group checkout, JVM and .NET throw "Entity not found") and check out guest (all three throw "Entity not found" for a missing account). Should they ignore a missing entity in all three repositories, as the to-do list now does, or keep throwing?

**Answer (Oskar, 2026-11-18):** "Ignore, we can add dlq as one of the next exercises"

## Q28 (spec r10)

**Question:** In the exercises where the attendee writes the model (02 facades; 03 group checkout), what helps with the JSON database: a TODO plus a README sentence, only the README, or nothing?

**Answer (Oskar, 2026-11-18):** "For aggregates or mutable we can add already a dummy class and pass it to database"

So: like JVM's empty `GuestStayAccount` (02) and `GroupCheckout` (03) classes, the Node.js 02 exercise and the 03 aggregates exercise get an empty class for the entity the attendee writes, already passed to `database.collection`; immutable entities need no class.

## Q29 (spec r11)

**Question:** With the pending events/messages in a TypeScript `private` field, the JSON database would write them. How should Node.js avoid storing pending events: a) every facade takes the events out before storing, as the 04 facades do, or b) the database leaves that field out of the JSON, like JVM's `@JsonIgnore`?

**Answer (Oskar, 2026-11-18):** "a) BUT WE SHOULD also ignore them just in case"

So both: every facade dequeues before it stores, and the pending events/messages are never written into the stored JSON.

## Q30 (spec r11)

**Question:** What should a `CheckOutGuest` command for a missing account do, in all three repositories: a) do nothing, as Q27 says (a group checkout that includes that account then never finishes), or b) publish `GuestCheckoutFailed` (not checked in), as Node.js immutable entities do today?

**Answer (Oskar, 2026-11-18):** a

## Q31 (spec r11)

**Question:** Should every 03 solution (saga, process manager, choreography, to-do list) and the given 03 exercise facades ignore a missing entity in the bus-triggered methods (record guest completion / failure, check out guest), in all three repositories?

**Answer (Oskar, 2026-11-18):** ok

## Q32 (spec r11)

**Question:** Where should the empty class go in the Node.js 02 exercise, which doesn't fix a flavour: a) both starting points, b) only `regular/`, c) nowhere in 02 (only the 03 aggregates exercise)?

**Answer (Oskar, 2026-11-18):** "just when it lands in solutions"

Reading (stated to Oskar for correction): c. The 02 exercise gets no empty class and creates its collection without one; the class is passed where the aggregates solution lands (the 02 aggregates solution). Q28's empty class stays in the 03 aggregates exercise, whose flavour is fixed.

Follow-up to Q32 (Oskar, 2026-11-18): "ok" to the exact places (empty `GroupCheckout` only in the 03 aggregates exercise; the class passed wherever an aggregate is stored in the solutions; immutable entities pass none) and to the four spec fixes from the r10 review (process manager static `initiate` becomes a static method; "ignore a missing entity" checked once; immutable `evolve` creates a new `Record`; Q22 citation replaced by Q24).

## Q33 (spec r12)

**Question:** To keep the pending list out of the JSON: base classes (`toJSON()` without it, "empty if missing" on read), the database (replacer plus empty list after loading), or reopen Q20 so loading runs the constructor and a `#` field works as it is? (Asked after Oskar's "if we use # private field then won't it be automatically dropped?": yes on writing, but a `#` field exists only on objects the constructor created, so loading from the prototype alone throws.)

**Answer (Oskar, 2026-11-18):** "we can make default constructor public if that helps with the comment that's for serialization"

So: every Node.js aggregate and process manager gets a public constructor without parameters, with a comment that it's for serialization (as JVM's "Default constructor for Jackson"). Loading with a class creates the object with that constructor and assigns the parsed data to it, so the pending events/messages stay `#` fields: never written into the JSON, and empty after loading. This replaces the prototype-only loading of Q20 and the `{ prototype: T }` parameter type of Q23; the collection's optional class parameter is typed as a constructor (`new () => T`).

## Q34 (spec r12)

**Question:** What should the Node.js 02 exercise give an attendee who writes an aggregate (the facades pass no class to `database.collection`): a) a TODO at the `database.collection(...)` call in both 02 facades ("If you write an aggregate class, pass it here: `database.collection('guestStayAccount', GuestStayAccount)`") plus the same sentence in the 02 README, b) only the README sentence, or c) nothing?

**Answer (Oskar, 2026-11-18):** a)

Follow-up to Q34 (Oskar, 2026-11-18): "but don't use "aggregate" in comment". The TODO and the README sentence read: "If your guest stay account is a class, pass it here: `database.collection('guestStayAccount', GuestStayAccount)`".

## Q35 (spec r13)

**Question:** Is the Q33 reading right (public constructor without parameters commented as being for serialization; loading does `Object.assign(new type(), parsed)`; `#` pending fields), and how should a facade pass its type to the collection: a) the class, `database.collection('guestStayAccount', GuestStayAccount)`; b) a named option, `{ create: () => new GuestStayAccount() }`; c) a bare factory, `() => new GuestStayAccount()`?

**Answers (Oskar, 2026-11-18):** "Dude, I just want the simplest solution that won't be cumbersome and sure it's fine." On c: "this may not be intuitive for the attendee". Then: "b is not acceptable, use a".

So the Q33 design stands, and the facade passes the class: `database.collection('guestStayAccount', GuestStayAccount)`, typed `type?: new () => T`. Immutable entities pass nothing.

## Q36 (spec r13)

**Question:** Should the 02 TODO and README sentence mention that a guest stay account class needs a public constructor without parameters?

**Answer (Oskar, 2026-11-18):** "I told you we can add public constructor"

Reading (stated to Oskar for correction): yes; the TODO and the README sentence say the class needs a public constructor without parameters, the one Q33 allowed. The four spec fixes from the r12 review are applied in r13.

## Q37 (spec r13): least-surprise check of passing the class to the collection

**Proposal:** the serialization constructor's comment says what happens ("Public constructor without parameters, used when loading from the database"); one comment on the base classes' `#` pending field ("Not stored, so it's empty after loading"); forgetting the class (plain data, "… is not a function" at the first method call) stays as decided, because only 02 has the attendee create a collection and it gets the TODO; the two call shapes (class for aggregates, angle brackets for immutable entities) stay.

**Answer (Oskar, 2026-11-18):** "ok, for 2. in 03 exercise we will already pass this constructor, so that's fine, right?" Confirmed: in 03 the attendee creates no collection: the guest stay facade is given and the group checkout facade already passes the empty `GroupCheckout` class (aggregates) or nothing (immutable entities).

## Q38 (spec r14)

**Question:** The empty `GroupCheckout` with only a constructor doesn't compile against the abstract `Aggregate`. Which shape: a) like JVM, extending nothing, with only the commented public constructor; or b) extending `Aggregate<GroupCheckoutEvent>`, with the commented public constructor and an `evolve` stub that throws "TODO: Fill the implementation"?

**Answer (Oskar, 2026-11-18):** "in 02 there's no base class in 03 they can have b)"

So: the 03 aggregates exercise gets b). The 02 exercise has no base class and no empty class (only the TODO, Q32, Q34).

## Q39 (plan r6): answers to the plan r4 review

**Questions:** 1) Should the 03 exercise group checkout skeletons (`recordGuestCheckoutCompletion` / `Failure`, all three repositories) return quietly for a missing group checkout, like the solutions, or stay as they are? 2) Use cases that fail today for the "loaded copy is separate" throwaway test (a group checkout guest list, a 03 process manager)? 3) Keep Step 9 as one step?

**Answer (Oskar, 2026-11-18):** "ok run plan with sonnett"

Reading (stated to Oskar for correction): 1) the skeletons return quietly for a missing group checkout, as Q31 makes the given 03 exercise facades do; 2) yes; 3) yes, one step.
