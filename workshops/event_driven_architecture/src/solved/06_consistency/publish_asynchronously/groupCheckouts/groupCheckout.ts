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

export type GroupCheckout =
  | { status: 'NotExisting' }
  | {
      status: 'Initiated';
      guestStayCheckouts: Map<string, CheckoutStatus>;
    }
  | { status: 'Finished' };

export const initial: GroupCheckout = {
  status: 'NotExisting',
};

export const evolve = (
  state: GroupCheckout,
  { type, data: event }: GroupCheckoutEvent,
): GroupCheckout => {
  switch (type) {
    case 'GroupCheckoutInitiated': {
      if (state.status !== 'NotExisting') return state;

      return {
        status: 'Initiated',
        guestStayCheckouts: event.guestStayAccountIds.reduce(
          (map, id) => map.set(id, 'Initiated'),
          new Map<string, CheckoutStatus>(),
        ),
      };
    }
    case 'GuestCheckoutCompletionRecorded':
    case 'GuestCheckoutFailureRecorded': {
      if (state.status !== 'Initiated') return state;

      return {
        ...state,
        guestStayCheckouts: state.guestStayCheckouts.set(
          event.guestStayAccountId,
          type === 'GuestCheckoutCompletionRecorded' ? 'Completed' : 'Failed',
        ),
      };
    }
    case 'GroupCheckoutCompleted':
    case 'GroupCheckoutFailed': {
      if (state.status !== 'Initiated') return state;

      return {
        status: 'Finished',
      };
    }
    default: {
      const _notExistingEventType: never = type;
      return state;
    }
  }
};
