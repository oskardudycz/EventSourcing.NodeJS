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
  type GroupCheckoutToDoListEvent,
} from './groupCheckouts';
import {
  configureGuestStayAccounts,
  type GuestStayAccountFacade,
} from './guestStayAccounts';
import { beforeEach, describe, expect, it } from 'vitest';

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
      messageBus.subscribe<GroupCheckoutToDoListEvent>(
        eventType,
        async (event) => {
          await groupCheckoutProjection.handle(event);
        },
      );
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

  it('group checkout for multiple guest stay should complete once time has passed', async () => {
    const guestStayAccountIds = [uuid(), uuid()];

    for (const guestStayAccountId of guestStayAccountIds) {
      await guestStayFacade.checkInGuest({
        type: 'CheckInGuest',
        data: {
          guestStayAccountId,
          now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        },
      });
    }
    publishedMessages.reset();
    const groupCheckoutId = uuid();
    const clerkId = uuid();

    await groupCheckoutFacade.initiateGroupCheckout({
      type: 'InitiateGroupCheckout',
      data: {
        groupCheckoutId,
        clerkId,
        guestStayAccountIds: guestStayAccountIds,
        now,
      },
    });

    const initiatedAndCheckedOut = [
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
        type: 'CheckOutGuest',
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
          completedAt: now,
          groupCheckoutId,
        },
      },
      {
        type: 'CheckOutGuest',
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
          completedAt: now,
          groupCheckoutId,
        },
      },
    ];
    publishedMessages.shouldReceiveMessages(initiatedAndCheckedOut);

    await scheduledToDoList.handleAll();
    await scheduledToDoList.handleAll();

    publishedMessages.shouldReceiveMessages([
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
    expect(await groupCheckouts.get(groupCheckoutId)).toBeNull();
  });
});
