import { Aggregate } from '../core';

export type GroupCheckoutInitiated = {
  type: 'GroupCheckoutInitiated';
  data: {
    groupCheckoutId: string;
    clerkId: string;
    guestStayAccountIds: string[];
    initiatedAt: Date;
  };
};

export type GuestCheckoutCompletionRecorded = {
  type: 'GuestCheckoutCompletionRecorded';
  data: {
    groupCheckoutId: string;
    guestStayAccountId: string;
    checkedOutAt: Date;
  };
};

export type GuestCheckoutFailureRecorded = {
  type: 'GuestCheckoutFailureRecorded';
  data: {
    groupCheckoutId: string;
    guestStayAccountId: string;
    failedAt: Date;
  };
};

export type GroupCheckoutCompleted = {
  type: 'GroupCheckoutCompleted';
  data: {
    groupCheckoutId: string;
    completedCheckouts: string[];
    completedAt: Date;
  };
};

export type GroupCheckoutFailed = {
  type: 'GroupCheckoutFailed';
  data: {
    groupCheckoutId: string;
    completedCheckouts: string[];
    failedCheckouts: string[];
    failedAt: Date;
  };
};

export type GroupCheckoutEvent =
  | GroupCheckoutInitiated
  | GuestCheckoutCompletionRecorded
  | GuestCheckoutFailureRecorded
  | GroupCheckoutCompleted
  | GroupCheckoutFailed;

export type CheckoutStatus =
  | 'NotExisting'
  | 'Initiated'
  | 'Completed'
  | 'Failed';

export type GroupCheckoutStatus = 'NotExisting' | 'Initiated' | 'Finished';

export class GroupCheckout extends Aggregate<GroupCheckoutEvent> {
  private groupCheckoutId: string = undefined!;
  private status: GroupCheckoutStatus = 'NotExisting';
  private guestStayCheckouts: Map<string, CheckoutStatus> = new Map();

  private constructor() {
    super();
  }

  static initiate = (data: {
    groupCheckoutId: string;
    clerkId: string;
    guestStayIds: string[];
    now: Date;
  }): GroupCheckout => {
    const groupCheckout = new GroupCheckout();

    groupCheckout.enqueue({
      type: 'GroupCheckoutInitiated',
      data: {
        groupCheckoutId: data.groupCheckoutId,
        clerkId: data.clerkId,
        guestStayAccountIds: data.guestStayIds,
        initiatedAt: data.now,
      },
    });

    return groupCheckout;
  };

  recordGuestCheckoutCompletion(data: {
    guestStayAccountId: string;
    now: Date;
  }): void {
    this.enqueue({
      type: 'GuestCheckoutCompletionRecorded',
      data: {
        groupCheckoutId: this.groupCheckoutId,
        guestStayAccountId: data.guestStayAccountId,
        checkedOutAt: data.now,
      },
    });

    if (!this.areAnyOngoingCheckouts()) this.finish(data.now);
  }

  recordGuestCheckoutFailure(data: {
    guestStayAccountId: string;
    now: Date;
  }): void {
    this.enqueue({
      type: 'GuestCheckoutFailureRecorded',
      data: {
        groupCheckoutId: this.groupCheckoutId,
        guestStayAccountId: data.guestStayAccountId,
        failedAt: data.now,
      },
    });

    if (!this.areAnyOngoingCheckouts()) this.finish(data.now);
  }

  private finish(now: Date): void {
    this.enqueue(
      this.areAllCompleted()
        ? {
            type: 'GroupCheckoutCompleted',
            data: {
              groupCheckoutId: this.groupCheckoutId,
              completedCheckouts: Array.from(this.guestStayCheckouts.keys()),
              completedAt: now,
            },
          }
        : {
            type: 'GroupCheckoutFailed',
            data: {
              groupCheckoutId: this.groupCheckoutId,
              completedCheckouts: this.checkoutsWith('Completed'),
              failedCheckouts: this.checkoutsWith('Failed'),
              failedAt: now,
            },
          },
    );
  }

  private areAnyOngoingCheckouts(): boolean {
    return [...this.guestStayCheckouts.values()].some(
      (status) => status === 'Initiated',
    );
  }

  private areAllCompleted(): boolean {
    return [...this.guestStayCheckouts.values()].every(
      (status) => status === 'Completed',
    );
  }

  private checkoutsWith(status: CheckoutStatus): string[] {
    return [...this.guestStayCheckouts]
      .filter((s) => s[1] === status)
      .map((s) => s[0]);
  }

  evolve({ type, data: event }: GroupCheckoutEvent): void {
    switch (type) {
      case 'GroupCheckoutInitiated': {
        if (this.status !== 'NotExisting') return;

        this.groupCheckoutId = event.groupCheckoutId;
        this.status = 'Initiated';
        this.guestStayCheckouts = event.guestStayAccountIds.reduce(
          (map, id) => map.set(id, 'Initiated'),
          new Map<string, CheckoutStatus>(),
        );
        return;
      }
      case 'GuestCheckoutCompletionRecorded':
      case 'GuestCheckoutFailureRecorded': {
        if (this.status !== 'Initiated') return;

        this.guestStayCheckouts.set(
          event.guestStayAccountId,
          type === 'GuestCheckoutCompletionRecorded' ? 'Completed' : 'Failed',
        );
        return;
      }
      case 'GroupCheckoutCompleted':
      case 'GroupCheckoutFailed': {
        if (this.status !== 'Initiated') return;

        this.status = 'Finished';
        return;
      }
      default: {
        const _notExistingEventType: never = type;
        return;
      }
    }
  }
}
