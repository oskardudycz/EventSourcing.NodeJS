import { v4 as uuid } from 'uuid';
import {
  getDatabase,
  getMessageBus,
  getMessageCatcher,
  type Database,
  type DocumentsCollection,
  type MessageCatcher,
} from '../../tools';
import {
  GroupCheckoutFacade,
  GroupCheckoutProjection,
  GroupCheckoutToDoList,
  ScheduledGroupCheckoutToDoList,
  type GroupCheckout,
  type GroupCheckoutEvent,
  type GroupCheckoutToDoListEvent,
} from './groupCheckouts';
import {
  configureGuestStayAccounts,
  type GuestStayAccountCommand,
  type GuestStayAccountEvent,
  type GuestStayAccountFacade,
} from './guestStayAccounts';
import { beforeEach, describe, expect, it } from 'vitest';

type ExpectedTypes =
  GroupCheckoutEvent | GuestStayAccountEvent | GuestStayAccountCommand;

describe('Scheduled Business Process Tests', () => {
  let database: Database;
  let publishedMessages: MessageCatcher;
  let guestStayFacade: GuestStayAccountFacade;
  let groupCheckoutFacade: GroupCheckoutFacade;
  let scheduledToDoList: ScheduledGroupCheckoutToDoList;
  let groupCheckouts: DocumentsCollection<GroupCheckout>;
  let now: Date;

  beforeEach(() => {
    database = getDatabase();
    const messageBus = getMessageBus();
    publishedMessages = getMessageCatcher();
    now = new Date();

    messageBus.use(publishedMessages.catchMessage);

    groupCheckouts = database.collection<GroupCheckout>('groupCheckout');
    const groupCheckoutProjection = GroupCheckoutProjection(groupCheckouts);
    for (const eventType of groupCheckoutProjection.canHandle) {
      messageBus.subscribe<GroupCheckoutToDoListEvent>(eventType, (event) => {
        groupCheckoutProjection.handle(event);
      });
    }
    groupCheckoutFacade = GroupCheckoutFacade({ messageBus });
    scheduledToDoList = ScheduledGroupCheckoutToDoList({
      groupCheckouts,
      groupCheckoutToDoList: GroupCheckoutToDoList({
        projection: groupCheckoutProjection,
        messageBus,
      }),
    });
    guestStayFacade = configureGuestStayAccounts({
      messageBus,
      database,
    }).guestStayAccountFacade;
  });

  it('group checkout for multiple guest stay should complete once time has passed', () => {
    const guestStayAccountIds = [uuid(), uuid()];

    for (const guestStayAccountId of guestStayAccountIds) {
      guestStayFacade.checkInGuest({
        type: 'CheckInGuest',
        data: {
          guestStayAccountId,
          guestId: uuid(),
          roomId: uuid(),
          now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        },
      });
    }
    publishedMessages.reset();
    const groupCheckoutId = uuid();
    const clerkId = uuid();

    groupCheckoutFacade.initiateGroupCheckout({
      type: 'InitiateGroupCheckout',
      data: {
        groupCheckoutId,
        clerkId,
        guestStayIds: guestStayAccountIds,
        now,
      },
    });

    const initiatedAndCheckedOut: ExpectedTypes[] = [
      {
        type: 'GroupCheckoutInitiated',
        data: {
          groupCheckoutId,
          clerkId,
          guestStayAccountIds,
          initiatedAt: now,
        },
      },
      {
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStayAccountIds[0]!,
          now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckedOut',
        data: {
          guestStayAccountId: guestStayAccountIds[0]!,
          checkedOutAt: now,
          groupCheckoutId,
        },
      },
      {
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStayAccountIds[1]!,
          now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckedOut',
        data: {
          guestStayAccountId: guestStayAccountIds[1]!,
          checkedOutAt: now,
          groupCheckoutId,
        },
      },
    ];
    publishedMessages.shouldReceiveMessages(initiatedAndCheckedOut);

    scheduledToDoList.handleAll();
    scheduledToDoList.handleAll();

    publishedMessages.shouldReceiveMessages<ExpectedTypes>([
      ...initiatedAndCheckedOut,
      {
        type: 'GroupCheckoutCompleted',
        data: {
          groupCheckoutId,
          completedCheckouts: guestStayAccountIds,
          completedAt: now,
        },
      },
    ]);
    expect(groupCheckouts.get(groupCheckoutId)).toBeNull();
  });
});
