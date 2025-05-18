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
