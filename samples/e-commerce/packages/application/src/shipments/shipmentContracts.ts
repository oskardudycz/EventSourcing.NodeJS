import { z } from 'zod';
import type { ShipmentExternalEvent } from './external/shipmentExternalEvent';
import type {
  FulfillmentRejected,
  FulfillmentRequested,
  PackageWasDelivered,
  PackageWasSent,
  ProductWasOutOfStock,
  StockCheckRequested,
  StockReleased,
  StockReserved,
} from './shipment';
import type {
  ConfirmPackageSent,
  ConfirmStockAvailability,
  DeliverPackage,
  RejectFulfillment,
  ReleaseStock,
  RequestFulfillment,
  ReserveStock,
} from './shipmentCommand';
import {
  at,
  orderId,
  shipmentId,
  shipmentProductItem,
} from '../documentation/fixtures';
import { contractsOf } from '../documentation/messageContract';

const { event, command } = contractsOf('shipments');
const { event: externalEvent } = contractsOf('shipments.external');

const id = z.string();
const time = z.string();
const items = z.array(z.object({ productId: id, quantity: z.number().int() }));
const idOnly = z.object({ shipmentId: id });
const carrier = 'Sandbox Express';
const trackingNumber = 'SB-1';

export const stockCheckRequested = event<StockCheckRequested['data']>(
  'StockCheckRequested',
  'A check of the stock for a reference was requested.',
  z.object({
    shipmentId: id,
    referenceId: id,
    productItems: items,
    requestedAt: time,
  }),
  {
    shipmentId,
    referenceId: orderId,
    productItems: [shipmentProductItem],
    requestedAt: at,
  },
);

export const stockReserved = event<StockReserved['data']>(
  'StockReserved',
  'The stock was reserved.',
  z.object({
    shipmentId: id,
    referenceId: id,
    productItems: items,
    reservedAt: time,
  }),
  {
    shipmentId,
    referenceId: orderId,
    productItems: [shipmentProductItem],
    reservedAt: at,
  },
);

export const productWasOutOfStock = event<ProductWasOutOfStock['data']>(
  'ProductWasOutOfStock',
  'A product was out of stock.',
  z.object({
    shipmentId: id,
    referenceId: id,
    productItems: items,
    availabilityCheckedAt: time,
  }),
  {
    shipmentId,
    referenceId: orderId,
    productItems: [shipmentProductItem],
    availabilityCheckedAt: at,
  },
);

export const fulfillmentRequested = event<FulfillmentRequested['data']>(
  'FulfillmentRequested',
  'Fulfillment of the shipment was requested.',
  z.object({ shipmentId: id, productItems: items, requestedAt: time }),
  { shipmentId, productItems: [shipmentProductItem], requestedAt: at },
);

export const fulfillmentRejected = event<FulfillmentRejected['data']>(
  'FulfillmentRejected',
  'The fulfillment service rejected the shipment.',
  z.object({ shipmentId: id, rejectedAt: time }),
  { shipmentId, rejectedAt: at },
);

export const packageWasSent = event<PackageWasSent['data']>(
  'PackageWasSent',
  'The package was sent.',
  z.object({
    shipmentId: id,
    carrier: id,
    trackingNumber: id,
    sentAt: time,
  }),
  { shipmentId, carrier, trackingNumber, sentAt: at },
);

export const packageWasDelivered = event<PackageWasDelivered['data']>(
  'PackageWasDelivered',
  'The package was delivered.',
  z.object({ shipmentId: id, deliveredAt: time }),
  { shipmentId, deliveredAt: at },
);

export const stockReleased = event<StockReleased['data']>(
  'StockReleased',
  'The reserved stock was released.',
  z.object({ shipmentId: id, releasedAt: time }),
  { shipmentId, releasedAt: at },
);

export const reserveStock = command<ReserveStock['data']>(
  'ReserveStock',
  'Ask shipments to reserve the stock for a reference, such as an order.',
  z.object({ referenceId: id, productItems: items }),
  { referenceId: orderId, productItems: [shipmentProductItem] },
);

export const requestFulfillment = command<RequestFulfillment['data']>(
  'RequestFulfillment',
  'Ask shipments to send the package.',
  idOnly,
  { shipmentId },
);

export const releaseStock = command<ReleaseStock['data']>(
  'ReleaseStock',
  'Ask shipments to release the reserved stock.',
  idOnly,
  { shipmentId },
);

export const confirmStockAvailability = command<
  ConfirmStockAvailability['data']
>(
  'ConfirmStockAvailability',
  'The warehouse answered whether every product is available.',
  z.object({ shipmentId: id, productsAvailable: z.boolean() }),
  { shipmentId, productsAvailable: true },
);

export const confirmPackageSent = command<ConfirmPackageSent['data']>(
  'ConfirmPackageSent',
  'The fulfillment service sent the package.',
  z.object({ shipmentId: id, carrier: id, trackingNumber: id }),
  { shipmentId, carrier, trackingNumber },
);

export const rejectFulfillment = command<RejectFulfillment['data']>(
  'RejectFulfillment',
  'The fulfillment service rejected the shipment.',
  idOnly,
  { shipmentId },
);

export const deliverPackage = command<DeliverPackage['data']>(
  'DeliverPackage',
  'The carrier delivered the package.',
  idOnly,
  { shipmentId },
);

export const stockReservedExternal = externalEvent<
  Extract<
    ShipmentExternalEvent,
    { type: 'shipments.external.StockReserved' }
  >['data']
>(
  'StockReserved',
  'The stock of a reference was reserved.',
  z.object({
    shipmentId: id,
    referenceId: id,
    reservedAt: time,
  }),
  { shipmentId, referenceId: orderId, reservedAt: at },
);

export const packageWasSentExternal = externalEvent<
  Extract<
    ShipmentExternalEvent,
    { type: 'shipments.external.PackageWasSent' }
  >['data']
>(
  'PackageWasSent',
  'The package of a reference was sent.',
  z.object({
    shipmentId: id,
    referenceId: id,
    carrier: id,
    trackingNumber: id,
    sentAt: time,
  }),
  { shipmentId, referenceId: orderId, carrier, trackingNumber, sentAt: at },
);

export const shipmentFailedExternal = externalEvent<
  Extract<
    ShipmentExternalEvent,
    { type: 'shipments.external.ShipmentFailed' }
  >['data']
>(
  'ShipmentFailed',
  'The shipment of a reference failed.',
  z.object({
    shipmentId: id,
    referenceId: id,
    reason: z.enum(['ProductsOutOfStock', 'FulfillmentRejected']),
    failedAt: time,
  }),
  {
    shipmentId,
    referenceId: orderId,
    reason: 'ProductsOutOfStock',
    failedAt: at,
  },
);

export const shipmentStoredContracts = [
  stockCheckRequested,
  stockReserved,
  productWasOutOfStock,
  fulfillmentRequested,
  fulfillmentRejected,
  packageWasSent,
  packageWasDelivered,
  stockReleased,
  confirmStockAvailability,
  confirmPackageSent,
  rejectFulfillment,
  deliverPackage,
];

export const shipmentRequestContracts = [
  reserveStock,
  requestFulfillment,
  releaseStock,
];

export const shipmentResponseContracts = [
  stockReservedExternal,
  packageWasSentExternal,
  shipmentFailedExternal,
];
