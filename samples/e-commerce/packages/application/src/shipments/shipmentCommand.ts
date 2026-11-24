import type { Command } from '@event-driven-io/emmett';

export type ShipmentProductItem = { productId: string; quantity: number };

export type ReserveStock = Command<
  'shipments.ReserveStock',
  {
    referenceId: string;
    productItems: ShipmentProductItem[];
  }
>;

export type RequestFulfillment = Command<
  'shipments.RequestFulfillment',
  { shipmentId: string }
>;

export type ReleaseStock = Command<
  'shipments.ReleaseStock',
  { shipmentId: string }
>;

export type ConfirmPackageSent = Command<
  'shipments.ConfirmPackageSent',
  { shipmentId: string; carrier: string; trackingNumber: string }
>;

export type RejectFulfillment = Command<
  'shipments.RejectFulfillment',
  { shipmentId: string }
>;

export type DeliverPackage = Command<
  'shipments.DeliverPackage',
  { shipmentId: string }
>;

export type ConfirmStockAvailability = Command<
  'shipments.ConfirmStockAvailability',
  { shipmentId: string; productsAvailable: boolean }
>;

export type ShipmentRequest = ReserveStock | RequestFulfillment | ReleaseStock;

export type ShipmentAnswer =
  | ConfirmStockAvailability
  | ConfirmPackageSent
  | RejectFulfillment
  | DeliverPackage;

export type ShipmentCommand = ShipmentRequest | ShipmentAnswer;

export const shipmentRequestTypes = [
  'shipments.ReserveStock',
  'shipments.RequestFulfillment',
  'shipments.ReleaseStock',
] as const;

export const shipmentAnswerTypes = [
  'shipments.ConfirmStockAvailability',
  'shipments.ConfirmPackageSent',
  'shipments.RejectFulfillment',
  'shipments.DeliverPackage',
] as const;

export const shipmentCommandTypes = [
  ...shipmentRequestTypes,
  ...shipmentAnswerTypes,
] as const;
