import { v4 as uuid } from 'uuid';
import type { GroupCheckoutEvent } from './groupCheckouts';
import type { GuestStayAccountEvent } from './guestStayAccounts';

describe('Events definition', () => {
  const guestId = uuid();
  const clerkId = 'room-123';
  const roomId = 'room-123';
  const groupCheckoutId = uuid();
  const guestStayAccountId = uuid();
  const otherGuestStayAccountId = uuid();

  it('Guest Stay Account event types are defined', () => {
    const events: GuestStayAccountEvent[] = [
      {
        type: 'GuestCheckedIn',
        data: {
          guestStayAccountId,
          guestId,
          roomId,
          checkedInAt: new Date(),
        },
      },
      {
        type: 'ChargeRecorded',
        data: {
          guestStayAccountId,
          chargeId: uuid(),
          amount: 123.45,
          recordedAt: new Date(),
        },
      },
      {
        type: 'PaymentRecorded',
        data: {
          guestStayAccountId,
          paymentId: uuid(),
          amount: 123.45,
          recordedAt: new Date(),
        },
      },
      {
        type: 'GuestCheckedOut',
        data: {
          guestStayAccountId,
          checkedOutAt: new Date(),
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckoutFailed',
        data: {
          guestStayAccountId,
          reason: 'NotCheckedIn',
          failedAt: new Date(),
          groupCheckoutId,
        },
      },
    ];

    expect(events.length).toBe(5);
  });

  it('Group Checkout event types are defined', () => {
    const events: GroupCheckoutEvent[] = [
      {
        type: 'GroupCheckoutInitiated',
        data: {
          groupCheckoutId,
          clerkId,
          guestStayAccountIds: [guestStayAccountId],
          initiatedAt: new Date(),
        },
      },
      {
        type: 'GroupCheckoutCompletionRecorded',
        data: {
          guestStayAccountId,
          groupCheckoutId,
          completedAt: new Date(),
        },
      },
      {
        type: 'GuestCheckoutFailureRecorded',
        data: {
          guestStayAccountId: otherGuestStayAccountId,
          groupCheckoutId,
          failedAt: new Date(),
        },
      },
      {
        type: 'GroupCheckoutCompleted',
        data: {
          groupCheckoutId,
          completedCheckouts: [guestStayAccountId],
          completedAt: new Date(),
        },
      },
      {
        type: 'GroupCheckoutFailed',
        data: {
          groupCheckoutId,
          completedCheckouts: [guestStayAccountId],
          failedCheckouts: [otherGuestStayAccountId],
          failedAt: new Date(),
        },
      },
    ];

    expect(events.length).toBe(5);
  });
});
