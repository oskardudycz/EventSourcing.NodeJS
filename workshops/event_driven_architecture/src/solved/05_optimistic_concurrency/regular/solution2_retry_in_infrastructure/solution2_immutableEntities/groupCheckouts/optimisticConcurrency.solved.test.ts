import { v4 as uuid } from 'uuid';
import {
  getDatabase,
  getMessageBus,
  getMessageCatcher,
  type MessageCatcher,
} from '../../../../tools';
import {
  GroupCheckoutFacade,
  type GroupCheckoutEvent,
  type InitiateGroupCheckout,
} from '.';
import { beforeEach, describe, it } from 'vitest';

describe('Group Checkout Optimistic Concurrency Tests', () => {
  it('group checkout initiated concurrently is initiated once', async () => {
    // Given
    const groupCheckoutId = uuid();
    const clerkId = uuid();
    const guestStayIds = [uuid(), uuid(), uuid()];
    const command: InitiateGroupCheckout = {
      type: 'InitiateGroupCheckout',
      data: { groupCheckoutId, clerkId, guestStayIds, now },
    };

    // When
    await Promise.all(
      Array.from({ length: 10 }).map(() =>
        groupCheckoutFacade.initiateGroupCheckout(command),
      ),
    );

    // Then
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
    // Given
    const guestStayIds = Array.from({ length: 10 }).map(() => uuid());
    const groupCheckoutId = await initiateGroupCheckout(guestStayIds);

    // When
    await Promise.all(
      guestStayIds.map((guestStayAccountId) =>
        groupCheckoutFacade.recordGuestCheckoutCompletion({
          type: 'RecordGuestCheckoutCompletion',
          data: { groupCheckoutId, guestStayAccountId, now },
        }),
      ),
    );

    // Then
    publishedMessages.shouldReceiveMessagesInAnyOrder([
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
    // Given
    const guestStayIds = Array.from({ length: 10 }).map(() => uuid());
    const [failedGuestStayId, ...completedGuestStayIds] = guestStayIds;
    const groupCheckoutId = await initiateGroupCheckout(guestStayIds);

    // When
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

    // Then
    publishedMessages.shouldReceiveMessagesInAnyOrder([
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
});
