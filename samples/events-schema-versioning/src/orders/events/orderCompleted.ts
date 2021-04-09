import { Event } from '../../core/events';

export type ORDER_CONFIRMED = 'order-confirmed';

export type OrderCompleted = Event<
  ORDER_CONFIRMED,
  {
    readonly orderId: string;
    readonly completedAt: Date;
  }
>;

export type OrderCompletedV2 = Event<
  ORDER_CONFIRMED,
  {
    readonly orderId: string;
    readonly completedAt: Date;
    readonly paymentId: string;
  }
>;

export type OrderCompletedV3 = Event<
  ORDER_CONFIRMED,
  {
    readonly orderId: string;
    readonly completedAt: Date;
    readonly paymentId: string;
    readonly gatewayId: string;
  }
>;
