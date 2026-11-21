# EDA workshop: one set of names in Node.js, .NET and JVM

Started 2026-11-21, after the 05 work (`../eda-05-optimistic-concurrency/`). Oskar: "Why naming is left outside?", then "can't you just do it?". An inventory of every naming difference (01–06, exercises and solutions, three repositories) was made by a search agent.

## Q1

**Question:** JVM is the reference, but it isn't consistent with itself, and one change reverses 04-Q13. 1) one group checkout id field: `groupCheckoutId` everywhere (JVM commands use `groupCheckOutId`); 2) one guest stay account id field: `guestStayAccountId` everywhere (JVM commands use `guestStayId`); 3) `RecordGuestCheckoutCompletion` / `Failure` time field: `now`, like every other command (JVM aggregates use `completedAt` / `failedAt`); 4) Node.js group checkout status `'Finished'` → `Completed` / `Failed` like JVM (reverses 04-Q13); 5) remove Node.js `guestId` / `roomId`, and `chargeId` / `paymentId` before 04. Everything else: plain renames to the JVM names; language idioms (Node.js `businessLogic.ts` functions and saga `on*` handlers, .NET methods on records) stay.

**Answer (Oskar, 2026-11-21):** "I mean fine, just do it, but use finish instead of finalize if it's possible"

So: 1)–5) as proposed, all renames to the JVM names, except the group checkout's private method that completes or fails it: `finish` everywhere (JVM and .NET rename `finalize` / `Finalize` to `finish` / `Finish`; Node.js keeps `finish`). Scope: 01–06, exercises and solutions, all three repositories, JVM Kafka and RabbitMQ solutions and READMEs included. Work order: JVM, then .NET, then Node.js.

## Q2

**Question:** Rename JVM test locals that still contain the old word (`lastGuestStayId`, `completedGuestStayId`, `failedGuestStayId`, `firstGuestStayId`, `secondGuestStayId`, `checkedInGuestStayId`, helper `guestStayIdOf`)?

**Answer (Oskar, 2026-11-21):** "yes, rename them"

So: every name containing `GuestStayId` / `guestStayId` becomes `GuestStayAccountId` / `guestStayAccountId`, in all three repositories (aligned).

## Q3

**Question:** C# can't use the JVM names `Reason` (an enum nested in `GuestCheckoutFailed`, which has a `Reason` property) and a nested `Status` (clashes with the entity's `Status` property). Keep .NET `FailureReason` and `GuestStayAccountStatus`?

**Answer (Oskar, 2026-11-21):** "ok, but can't we rename in java and node accordingly?"

So: the other two follow .NET here: the failure reason type is `FailureReason` and the guest stay account status type is `GuestStayAccountStatus` in JVM (renaming the nested `Reason` and `Status`) and in Node.js (naming the failure reason union `FailureReason` where it is inline, and using `GuestStayAccountStatus` for the status in both flavours). Values stay as aligned (`INVALID_STATE` / `InvalidState`, `BALANCE_NOT_SETTLED` / `BalanceNotSettled`, `OPEN` / `Open`, `CHECKED_OUT`, `NOT_EXISTING`).
