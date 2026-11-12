# Exercise 05 - Optimistic Concurrency

Having the group checkout modelled in the previous exercises, and defined as:

**Group Checkout** is a quick way to check out all guests of the specific group. Clerk selects set of room stay based on the request from a person from the group and tries to check out all of them.

The main goal for this feature is to speed up existing single checkouts, as they're not efficient for bigger groups and other guests need to stand in the queue.

We still need to support regular checkouts, payments, charges etc. as we do right now.

**Rules:**

1. Guest can checkout only if the financial account balance is settled.
2. Guests cannot checkout if they already checked out.
3. Guests cannot checkout if they are not checked in.

**Notes:**

1. Room Stay means room + length of the stay + main guest

## Goal

**Make the group checkout and guest stay accounts keep every change when handlers run in parallel.**

Each handler loads the state, decides and stores the new state. When two handlers do that for the same entity at the same time, both load the same state, and the one that stores last overwrites the other's change. Duplicates delivered in parallel slip through the idempotency check from the previous exercise the same way: both see that the group checkout doesn't exist yet.

The [in-memory database](./tools/database.ts) is now asynchronous, like a real one, and versions documents. `get` returns the document with its version, and `store` takes an optional `expectedVersion`. If the stored version is different, `store` fails with [ConcurrencyError](./tools/concurrencyError.ts). `expectedVersion: 0` means the document must not exist yet.

- Start from the idempotent saga of the previous exercise, now with asynchronous facades. Choose one path: [Aggregates](./regular/solution1_aggregates) or [Immutable Entities](./regular/solution2_immutableEntities),
- Store with the version you loaded, so a conflicting change fails instead of overwriting,
- Handle the conflict by loading the current state and deciding again, for a few attempts. Publish only the events of the attempt that succeeded,
- Use optimistic concurrency tests (aggregates: [group checkouts](./regular/solution1_aggregates/groupCheckouts/optimisticConcurrency.exercise.test.ts), [guest stay accounts](./regular/solution1_aggregates/guestStayAccounts/optimisticConcurrency.exercise.test.ts); immutable entities: [group checkouts](./regular/solution2_immutableEntities/groupCheckouts/optimisticConcurrency.exercise.test.ts), [guest stay accounts](./regular/solution2_immutableEntities/guestStayAccounts/optimisticConcurrency.exercise.test.ts)) to guide you and verify if you implemented it correctly. Business process, entity definition and idempotency tests should stay green.
