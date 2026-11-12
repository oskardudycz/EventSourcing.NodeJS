# Exercise 16 - Processes Entities Definition

Having the group checkout modelled in the [previous exercise](../15_processes_events_definition/), and defined as:

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

**Model the entity and business logic of the Guest Stay Account.**

## Solution

1. Aggregates: [solution1_aggregates](./regular/solution1_aggregates/), see [entityDefinitionTests.solved.test.ts](./regular/solution1_aggregates/entityDefinitionTests.solved.test.ts).
2. Immutable entities: [solution2_immutableEntities](./regular/solution2_immutableEntities/), see [entityDefinitionTests.solved.test.ts](./regular/solution2_immutableEntities/entityDefinitionTests.solved.test.ts).
