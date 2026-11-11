# Exercise 03 - Business Processes

Having the group checkout modelled in the previous exercise, and defined as:

**Group Checkout** is a quick way to check out all guests of the specific group. Clerk selects set of room stay based on the request from a person from the group and tries to check out all of them.

The main goal for this feature is to speed up existing single checkouts, as they're not efficient for bigger groups and other guests need to stand in the queue.

We still need to support regular checkouts, payments, charges etc. as we do right now.

**Rules:**

1. Guest can checkout only if the financial account balance is settled.
2. Guests cannot checkout if they already checked out.
3. Guests cannot checkout if they are not checked in.

**Notes:**

1. Room Stay means room + length of the stay + main guest
2. Settled means SUM(Charges) - SUM(Payments) === 0

## Goal

**Based on the business logic solution from the previous exercise, model the process and business logic of the Group Checkout.**

- Choose one path: [Aggregates](./regular/solution1_aggregates) or [Immutable Entities](./regular/solution2_immutableEntities),
- Guest Stay Account logic is already there, together with [guestStayAccountFacade.ts](./regular/solution1_aggregates/guestStayAccounts/guestStayAccountFacade.ts),
- Define the Group Checkout entity in `groupCheckouts/groupCheckout.ts` and fill application logic in [groupCheckoutFacade.ts](./regular/solution1_aggregates/groupCheckouts/groupCheckoutFacade.ts), using the [in-memory database](./tools/database.ts) and [in-memory message bus](./tools/messageBus.ts) to store changes and publish events as the outcome of business logic,
- Configure message handling in `configureGroupCheckouts` (`groupCheckouts/index.ts`) and `configureGuestStayAccounts` (`guestStayAccounts/index.ts`) by subscribing to commands and events on the message bus (think about them as setup called once upon application startup),
- You can use any preferred style of implementing process coordination,
- Use `businessProcess.exercise.test.ts` to guide you and verify if you implemented it correctly.

### Commands and events on one message bus

Commands and events travel through the same [message bus](./tools/messageBus.ts). The difference is intent, not transport:

- a command asks for something to be done, e.g. `RecordGuestCheckoutCompletion`. It has one intended recipient, which may accept or reject it,
- an event records something that already happened, e.g. `GuestCheckedOut`. Any number of subscribers may react to it, or none.

The bus delivers each message to every subscriber of its type. It doesn't check that a command has exactly one handler; that's up to how you wire your subscriptions.
