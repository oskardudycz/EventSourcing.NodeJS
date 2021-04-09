import {
  OrderCompleted,
  OrderCompletedV2,
  OrderCompletedV3,
} from './orderCompleted';
import { OrderInitialised } from './orderInitialised';
import {
  OrderPaymentRecorded,
  OrderPaymentRecordedV2,
  OrderPaymentRecordedV3,
  OrderPaymentRecordedV3_1,
} from './orderPaymentRecorded';

export type OrderEvent =
  | OrderInitialised
  | OrderPaymentRecorded
  | OrderPaymentRecordedV2
  | OrderPaymentRecordedV3
  | OrderPaymentRecordedV3_1
  | OrderCompleted
  | OrderCompletedV2
  | OrderCompletedV3;

export * from './orderInitialised';
export * from './orderPaymentRecorded';
export * from './orderCompleted';
