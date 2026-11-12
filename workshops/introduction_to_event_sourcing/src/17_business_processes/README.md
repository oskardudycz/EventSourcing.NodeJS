# Exercise 17 - Business Processes

Having the group checkout modelled in the [previous exercise](../16_processes_entities_definition/), and defined as:

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

- Choose one path: [Aggregates](./regular/solution1_aggregates/) or [Immutable Entities](./regular/solution2_immutableEntities/),
- Guest Stay Account logic is already there, together with [guestStayAccountFacade.ts](./regular/solution1_aggregates/guestStayAccounts/guestStayAccountFacade.ts),
- Define the Group Checkout entity in `groupCheckouts/groupCheckout.ts` and fill application logic in [groupCheckoutFacade.ts](./regular/solution1_aggregates/groupCheckouts/groupCheckoutFacade.ts), using the [in-memory event store](./tools/eventStore.ts) to append events and the [in-memory command bus](./tools/commandBus.ts) to send commands,
- Configure message handling in `configureGroupCheckouts` (`groupCheckouts/index.ts`) and `configureGuestStayAccounts` (`guestStayAccounts/index.ts`) by subscribing to events from the event store and commands from the command bus (think about them as setup called once upon application startup),
- You can use any preferred style of implementing process coordination,
- Use `businessProcess.exercise.test.ts` to guide you and verify if you implemented it correctly.
