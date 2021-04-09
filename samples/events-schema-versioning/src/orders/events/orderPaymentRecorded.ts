import { Event } from '../../core/events';

export type ORDER_PAYMENT_RECORDED = 'order-payment-recorded';

export type OrderPaymentRecorded = Event<
  ORDER_PAYMENT_RECORDED,
  {
    readonly orderId: string;
    readonly paymentId: string;
    readonly paymentRecordedAt: Date;
  }
>;

function isOrderPaymentRecorded(event: any): event is OrderPaymentRecorded {
  return (
    event.orderId instanceof String &&
    event.paymentId instanceof String &&
    event.paymentRecordedAt instanceof Date
  );
}

export type OrderPaymentRecordedV2 = Event<
  ORDER_PAYMENT_RECORDED,
  {
    readonly orderId: string;
    readonly paymentId: string;
    readonly recordedAt: Date;
  }
>;

export type OrderPaymentRecordedV3 = Event<
  ORDER_PAYMENT_RECORDED,
  {
    readonly orderId: string;
    readonly paymentId: string;
    readonly recordedAt: Date;
    readonly gatewayId: string;
  }
>;

export type OrderPaymentRecordedV3_1 = Event<
  ORDER_PAYMENT_RECORDED,
  {
    readonly gatewayId?: string;
  }
>;
