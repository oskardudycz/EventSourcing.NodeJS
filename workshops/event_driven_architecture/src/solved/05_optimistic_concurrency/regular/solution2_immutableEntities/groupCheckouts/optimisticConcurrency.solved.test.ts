import { v4 as uuid } from 'uuid';
import {
  getDatabase,
  getMessageBus,
  getMessageCatcher,
  type MessageCatcher,
} from '../../../tools';
import {
  GroupCheckoutFacade,
  type GroupCheckoutEvent,
  type InitiateGroupCheckout,
} from '.';

describe('Group Checkout Optimistic Concurrency Tests', () => {
  let publishedMessages: MessageCatcher;
  let groupCheckoutFacade: GroupCheckoutFacade;
  let now: Date;

  beforeEach(() => {
    const database = getDatabase();
    const messageBus = getMessageBus();
    publishedMessages = getMessageCatcher();
    groupCheckoutFacade = GroupCheckoutFacade({
      database,
      messageBus,
    });
    now = new Date();

    messageBus.use(publishedMessages.catchMessage);
  });

  const initiateGroupCheckout = async (guestStayIds: string[]) => {
    const groupCheckoutId = uuid();
    await groupCheckoutFacade.initiateGroupCheckout({
      type: 'InitiateGroupCheckout',
      data: {
        groupCheckoutId,
        clerkId: uuid(),
        guestStayIds,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    publishedMessages.reset();

    return groupCheckoutId;
  };

  it('group checkout initiated concurrently is initiated once', async () => {
    const groupCheckoutId = uuid();
    const clerkId = uuid();
    const guestStayIds = [uuid(), uuid(), uuid()];
    const command: InitiateGroupCheckout = {
      type: 'InitiateGroupCheckout',
      data: { groupCheckoutId, clerkId, guestStayIds, now },
    };

    await Promise.all(
      [1, 2, 3, 4, 5].map(() =>
        groupCheckoutFacade.initiateGroupCheckout(command),
      ),
    );

    publishedMessages.shouldReceiveSingleMessage({
      type: 'GroupCheckoutInitiated',
      data: {
        groupCheckoutId,
        clerkId,
        guestStayAccountIds: guestStayIds,
        initiatedAt: now,
      },
    });
  });

  it('guest checkout completions recorded concurrently complete group checkout', async () => {
    const guestStayIds = [uuid(), uuid(), uuid(), uuid(), uuid()];
    const groupCheckoutId = await initiateGroupCheckout(guestStayIds);

    await Promise.all(
      guestStayIds.map((guestStayAccountId) =>
        groupCheckoutFacade.recordGuestCheckoutCompletion({
          type: 'RecordGuestCheckoutCompletion',
          data: { groupCheckoutId, guestStayAccountId, now },
        }),
      ),
    );

    publishedMessages.shouldReceiveMessagesInAnyOrder<GroupCheckoutEvent>([
      ...guestStayIds.map<GroupCheckoutEvent>((guestStayAccountId) => ({
        type: 'GuestCheckoutCompletionRecorded',
        data: { groupCheckoutId, guestStayAccountId, checkedOutAt: now },
      })),
      {
        type: 'GroupCheckoutCompleted',
        data: {
          groupCheckoutId,
          completedCheckouts: guestStayIds,
          completedAt: now,
        },
      },
    ]);
  });

  it('guest checkout completions and failure recorded concurrently fail group checkout', async () => {
    const guestStayIds = [uuid(), uuid(), uuid(), uuid(), uuid()];
    const [failedGuestStayId, ...completedGuestStayIds] = guestStayIds;
    const groupCheckoutId = await initiateGroupCheckout(guestStayIds);

    await Promise.all([
      groupCheckoutFacade.recordGuestCheckoutFailure({
        type: 'RecordGuestCheckoutFailure',
        data: { groupCheckoutId, guestStayAccountId: failedGuestStayId!, now },
      }),
      ...completedGuestStayIds.map((guestStayAccountId) =>
        groupCheckoutFacade.recordGuestCheckoutCompletion({
          type: 'RecordGuestCheckoutCompletion',
          data: { groupCheckoutId, guestStayAccountId, now },
        }),
      ),
    ]);

    publishedMessages.shouldReceiveMessagesInAnyOrder<GroupCheckoutEvent>([
      {
        type: 'GuestCheckoutFailureRecorded',
        data: {
          groupCheckoutId,
          guestStayAccountId: failedGuestStayId!,
          failedAt: now,
        },
      },
      ...completedGuestStayIds.map<GroupCheckoutEvent>(
        (guestStayAccountId) => ({
          type: 'GuestCheckoutCompletionRecorded',
          data: { groupCheckoutId, guestStayAccountId, checkedOutAt: now },
        }),
      ),
      {
        type: 'GroupCheckoutFailed',
        data: {
          groupCheckoutId,
          completedCheckouts: completedGuestStayIds,
          failedCheckouts: [failedGuestStayId!],
          failedAt: now,
        },
      },
    ]);
  });
});
