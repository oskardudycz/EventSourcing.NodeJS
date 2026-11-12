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

## Solution

1. Saga: [groupCheckoutSaga.ts](./regular/solution1_saga/groupCheckouts/groupCheckoutSaga.ts), see [businessProcess.solved.test.ts](./regular/solution1_saga/businessProcess.solved.test.ts).
2. Process manager: [solution2_process_managers](./regular/solution2_process_managers/), see [businessProcess.solved.test.ts](./regular/solution2_process_managers/businessProcess.solved.test.ts).
3. Choreography: [solution3_choreography](./regular/solution3_choreography/), see [businessProcess.solved.test.ts](./regular/solution3_choreography/businessProcess.solved.test.ts).

Read more in my article:

- [Saga and Process Manager - distributed processes in practice](https://event-driven.io/en/saga_process_manager_distributed_transactions/?utm_source=event_sourcing_nodejs&utm_campaign=workshop)
