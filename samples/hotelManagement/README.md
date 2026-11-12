[<img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" height="20px" />](https://www.linkedin.com/in/oskardudycz/) [![Github Sponsors](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&link=https://github.com/sponsors/oskardudycz/)](https://github.com/sponsors/oskardudycz/) [![blog](https://img.shields.io/badge/blog-event--driven.io-brightgreen)](https://event-driven.io/?utm_source=event_sourcing_nodejs) [![blog](https://img.shields.io/badge/%F0%9F%9A%80-Architecture%20Weekly-important)](https://www.architecture-weekly.com/?utm_source=event_sourcing_nodejs)

# Implementing Distributed Processes

Distributed process management using Guest Group Checkout as the example domain.

It was modelled and explained in detail in the [Implementing Distributed Processes Webinar](https://www.architecture-weekly.com/p/webinar-3-implementing-distributed):

<a href="https://www.architecture-weekly.com/p/webinar-3-implementing-distributed" target="_blank"><img src="https://substackcdn.com/image/fetch/w_1920,h_1080,c_fill,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-video.s3.amazonaws.com%2Fvideo_upload%2Fpost%2F69413446%2F526b9100-7271-4482-99e7-9559416e9848%2Ftranscoded-00624.png" alt="Implementing Distributed Processes" width="640" border="10" /></a>

## Business scenario

**Group Checkout** is a quick way to check out all guests of the specific group. Clerk selects set of room stays based on the request from a person from the group and tries to check out all of them.

**Rules:**

1. Guest can checkout only if the financial account balance is settled.
2. Guests cannot checkout if they already checked out.
3. Guests cannot checkout if they are not checked in.

Settled means `SUM(Charges) - SUM(Payments) === 0`.

The process spans two modules:

- **Guest Stay Account**: checking in, recording charges and payments, and checking out a single guest. A checkout ends with `GuestCheckedOut` or `GuestCheckoutFailed`.
- **Group Checkout**: initiating the checkout of a group, tracking the result of each guest checkout, and finishing with `GroupCheckoutCompleted` or `GroupCheckoutFailed`.

## Implementations

The sample shows three ways to coordinate the same process. All of them use pure functions without side effects, so they're easy to test and to plug into any messaging infrastructure.

### Saga

[groupCheckoutSaga.ts](./src/sagas/groupCheckouts/groupCheckoutSaga.ts) is a stateless function that translates events into commands. It reacts to `GroupCheckoutInitiated` by sending `CheckOut` commands for each guest stay, and to `GuestCheckedOut` and `GuestCheckoutFailed` by sending commands to record the result in the group checkout:

```typescript
export const GroupCheckoutSaga = ({
  type,
  data: event,
}: GroupCheckoutSagaEvent):
  GroupCheckoutSagaCommand | GroupCheckoutSagaCommand[] => {
  switch (type) {
    case 'GroupCheckoutInitiated': {
      const checkoutGuestStays =
        event.guestStayAccountIds.map<GroupCheckoutSagaCommand>((id) => {
          return {
            type: 'CheckOut',
            data: {
              guestStayAccountId: id,
              now: event.initiatedAt,
              groupCheckoutId: event.groupCheckoutId,
            },
          };
        });

      return [
        ...checkoutGuestStays,
        {
          type: 'RecordGuestCheckoutsInitiation',
          data: {
            groupCheckoutId: event.groupCheckoutId,
            initiatedGuestStayIds: event.guestStayAccountIds,
            now: event.initiatedAt,
          },
        },
      ];
    }
    // (...) GuestCheckedOut and GuestCheckoutFailed
  }
};
```

The business rules stay in the [group checkout](./src/sagas/groupCheckouts/groupCheckout.ts) and [guest stay account](./src/sagas/guestStayAccounts/guestStayAccount.ts) `decide` functions. The saga only coordinates.

### Process manager

[groupCheckoutProcessManager.ts](./src/processManagers/groupCheckouts/groupCheckoutProcessManager.ts) gets the event together with the current group checkout state. It decides what to do next based on both: sends `CheckOut` commands, records guest checkout results as events, and finishes the group checkout when all guest checkouts are done. It also ignores duplicated or late events, e.g. when the group checkout is already finished.

### Workflow

[groupCheckoutWorflow.ts](./src/workflows/groupCheckouts/groupCheckoutWorflow.ts) uses the [Workflow pattern](https://blog.bittacklr.be/the-workflow-pattern.html). It's defined by `decide`, `evolve` and `getInitialState` functions:

```typescript
export type Workflow<
  Input extends Event | Command,
  State,
  Output extends Event | Command,
> = {
  decide: (command: Input, state: State) => WorkflowOutput<Output>[];
  evolve: (currentState: State, event: WorkflowEvent<Output>) => State;
  getInitialState: () => State;
};
```

`decide` returns explicit outputs such as `send`, `publish`, `schedule`, `complete`, `accept`, `ignore` or `error`, see [workflow.ts](./src/core/workflow.ts). Thanks to that, the infrastructure knows exactly what to do with each result. The workflow also handles the group checkout timeout with the `TimeoutGroupCheckout` command.

## Running the sample

1. Install Node.js in the version from [.nvmrc](./.nvmrc) (or better using NVM).
2. Install packages: `npm install`.
3. Build: `npm run build:ts`.
4. Run tests: `npm test`. Infrastructure tests start KurrentDB through [Testcontainers](https://testcontainers.com/), so they need Docker running.

## Read more

- [Saga and Process Manager - distributed processes in practice](https://event-driven.io/en/saga_process_manager_distributed_transactions/?utm_source=event_sourcing_nodejs)
- [Event-driven distributed processes by example](https://event-driven.io/en/event_driven_distributed_processes_by_example/?utm_source=event_sourcing_nodejs)
- [The Workflow Pattern](https://blog.bittacklr.be/the-workflow-pattern.html)
- See also the [Event-Driven Architecture workshop](../../workshops/event_driven_architecture/) built on the same domain.
