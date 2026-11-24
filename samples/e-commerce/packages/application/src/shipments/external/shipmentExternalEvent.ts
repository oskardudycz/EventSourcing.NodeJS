import type { Event } from '@event-driven-io/emmett';

export type StockReserved = Event<
  'shipments.external.StockReserved',
  { shipmentId: string; referenceId: string; reservedAt: string }
>;

export type PackageWasSent = Event<
  'shipments.external.PackageWasSent',
  {
    shipmentId: string;
    referenceId: string;
    carrier: string;
    trackingNumber: string;
    sentAt: string;
  }
>;

export type ShipmentFailureReason =
  'ProductsOutOfStock' | 'FulfillmentRejected';

export type ShipmentFailed = Event<
  'shipments.external.ShipmentFailed',
  {
    shipmentId: string;
    referenceId: string;
    reason: ShipmentFailureReason;
    failedAt: string;
  }
>;

export type ShipmentExternalEvent =
  StockReserved | PackageWasSent | ShipmentFailed;

export const shipmentExternalEventTypes = [
  'shipments.external.StockReserved',
  'shipments.external.PackageWasSent',
  'shipments.external.ShipmentFailed',
] as const;
