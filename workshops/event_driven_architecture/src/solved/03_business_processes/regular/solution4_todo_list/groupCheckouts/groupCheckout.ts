export type GroupCheckoutInitiated = {
  type: 'GroupCheckoutInitiated';
  data: {
    groupCheckoutId: string;
    clerkId: string;
    guestStayAccountIds: string[];
    initiatedAt: Date;
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
  | GroupCheckoutCompleted
  | GroupCheckoutFailed;

export type CheckoutStatus = 'Initiated' | 'Completed' | 'Failed';

export type GroupCheckout = {
  id: string;
  guestStayCheckouts: Map<string, CheckoutStatus>;
  updatedAt: Date;
};

export const initiated = (
  id: string,
  guestStayIds: string[],
  initiatedAt: Date,
): GroupCheckout => ({
  id,
  guestStayCheckouts: new Map(
    guestStayIds.map((guestStayId) => [guestStayId, 'Initiated']),
  ),
  updatedAt: initiatedAt,
});

export const withCheckout = (
  groupCheckout: GroupCheckout,
  guestStayId: string,
  status: CheckoutStatus,
  at: Date,
): GroupCheckout => ({
  ...groupCheckout,
  guestStayCheckouts: new Map(groupCheckout.guestStayCheckouts).set(
    guestStayId,
    status,
  ),
  updatedAt: at,
});

export const areAnyOngoingCheckouts = ({ guestStayCheckouts }: GroupCheckout) =>
  [...guestStayCheckouts.values()].some((status) => status === 'Initiated');

export const areAnyFailedCheckouts = ({ guestStayCheckouts }: GroupCheckout) =>
  [...guestStayCheckouts.values()].some((status) => status === 'Failed');

export const checkoutsWith = (
  { guestStayCheckouts }: GroupCheckout,
  status: CheckoutStatus,
): string[] =>
  [...guestStayCheckouts]
    .filter(([, guestStayStatus]) => guestStayStatus === status)
    .map(([guestStayId]) => guestStayId);
