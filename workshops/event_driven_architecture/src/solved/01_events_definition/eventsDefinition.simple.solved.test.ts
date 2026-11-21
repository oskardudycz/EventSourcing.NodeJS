import { v4 as uuid } from 'uuid';
import { describe, expect, it } from 'vitest';

////////////////////////////////////////
///// Guest Stay Account Events ////////
////////////////////////////////////////

export type FailureReason = 'InvalidState' | 'BalanceNotSettled';

export type GuestStayAccountEvent =
  | {
      type: 'GuestCheckedIn';
      data: {
        guestStayAccountId: string;
        openedAt: Date;
      };
    }
  | {
      type: 'ChargeRecorded';
      data: {
        guestStayAccountId: string;
        amount: number;
        recordedAt: Date;
      };
    }
  | {
      type: 'PaymentRecorded';
      data: {
        guestStayAccountId: string;
        amount: number;
        recordedAt: Date;
      };
    }
  | {
      type: 'GuestCheckedOut';
      data: {
        guestStayAccountId: string;
        completedAt: Date;
        groupCheckoutId?: string;
      };
    }
  | {
      type: 'GuestCheckoutFailed';
      data: {
        guestStayAccountId: string;
        reason: FailureReason;
        failedAt: Date;
        groupCheckoutId?: string;
      };
    };

////////////////////////////////////////
///// Group Checkout Account Events ////
////////////////////////////////////////

export type GroupCheckoutEvent =
  | {
      type: 'GroupCheckoutInitiated';
      data: {
        groupCheckoutId: string;
        clerkId: string;
        guestStayAccountIds: string[];
        initiatedAt: Date;
      };
    }
  | {
      type: 'GuestCheckoutCompletionRecorded';
      data: {
        groupCheckoutId: string;
        guestStayAccountId: string;
        completedAt: Date;
      };
    }
  | {
      type: 'GuestCheckoutFailureRecorded';
      data: {
        groupCheckoutId: string;
        guestStayAccountId: string;
        failedAt: Date;
      };
    }
  | {
      type: 'GroupCheckoutCompleted';
      data: {
        groupCheckoutId: string;
        completedCheckouts: string[];
        completedAt: Date;
      };
    }
  | {
      type: 'GroupCheckoutFailed';
      data: {
        groupCheckoutId: string;
        completedCheckouts: string[];
        failedCheckouts: string[];
        failedAt: Date;
      };
    };

describe('Events definition', () => {
  const clerkId = 'room-123';
  const groupCheckoutId = uuid();
  const guestStayAccountId = uuid();
  const otherGuestStayAccountId = uuid();

  it('Guest Stay Account event types are defined', () => {
    const events: GuestStayAccountEvent[] = [
      {
        type: 'GuestCheckedIn',
        data: {
          guestStayAccountId,
          openedAt: new Date(),
        },
      },
      {
        type: 'ChargeRecorded',
        data: {
          guestStayAccountId,
          amount: 123.45,
          recordedAt: new Date(),
        },
      },
      {
        type: 'PaymentRecorded',
        data: {
          guestStayAccountId,
          amount: 123.45,
          recordedAt: new Date(),
        },
      },
      {
        type: 'GuestCheckedOut',
        data: {
          guestStayAccountId,
          completedAt: new Date(),
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckoutFailed',
        data: {
          guestStayAccountId,
          reason: 'InvalidState',
          failedAt: new Date(),
          groupCheckoutId,
        },
      },
    ];

    expect(events.length).toBe(5);
    expect(new Set(events.map((event) => event.type)).size).toBe(5);
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
        type: 'GuestCheckoutCompletionRecorded',
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
    expect(new Set(events.map((event) => event.type)).size).toBe(5);
  });
});
