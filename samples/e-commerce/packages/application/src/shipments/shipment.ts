import { Urns } from '@e-commerce/core';
import type { Event } from '@event-driven-io/emmett';
import type { ShipmentCommand, ShipmentProductItem } from './shipmentCommand';

const shipmentType = 'shipment';

export const ShipmentId = {
  require: (id: string): string => Urns.requireType(id, shipmentType),
  of: (tail: string): string => Urns.of('ecommerce', shipmentType, tail),
  tailOf: Urns.tailOf,
  numberOf: (id: string): string => {
    const tail = Urns.tailOf(id);
    return tail.substring(tail.lastIndexOf('-') + 1);
  },
  ofCommand: ({ data }: Pick<ShipmentCommand, 'data'>): string =>
    'referenceId' in data
      ? Urns.derive(data.referenceId, shipmentType)
      : data.shipmentId,
  derivedFrom: (sourceUrn: string): string =>
    Urns.derive(sourceUrn, shipmentType),
  workflowStreamNameOf: (id: string): string => `shipments_workflow-${id}`,
};

export type ShipmentStatus =
  | 'StockCheckRequested'
  | 'Reserved'
  | 'FulfillmentRequested'
  | 'FulfillmentRejected'
  | 'Sent'
  | 'Delivered'
  | 'Released'
  | 'ProductsOutOfStock';

export type StockCheckRequested = Event<
  'shipments.StockCheckRequested',
  {
    shipmentId: string;
    referenceId: string;
    productItems: ShipmentProductItem[];
    requestedAt: string;
  }
>;

export type StockReserved = Event<
  'shipments.StockReserved',
  {
    shipmentId: string;
    referenceId: string;
    productItems: ShipmentProductItem[];
    reservedAt: string;
  }
>;

export type ProductWasOutOfStock = Event<
  'shipments.ProductWasOutOfStock',
  {
    shipmentId: string;
    referenceId: string;
    productItems: ShipmentProductItem[];
    availabilityCheckedAt: string;
  }
>;

export type FulfillmentRequested = Event<
  'shipments.FulfillmentRequested',
  {
    shipmentId: string;
    productItems: ShipmentProductItem[];
    requestedAt: string;
  }
>;

export type FulfillmentRejected = Event<
  'shipments.FulfillmentRejected',
  { shipmentId: string; rejectedAt: string }
>;

export type PackageWasSent = Event<
  'shipments.PackageWasSent',
  {
    shipmentId: string;
    carrier: string;
    trackingNumber: string;
    sentAt: string;
  }
>;

export type PackageWasDelivered = Event<
  'shipments.PackageWasDelivered',
  { shipmentId: string; deliveredAt: string }
>;

export type StockReleased = Event<
  'shipments.StockReleased',
  { shipmentId: string; releasedAt: string }
>;

export type ShipmentEvent =
  | StockCheckRequested
  | StockReserved
  | ProductWasOutOfStock
  | FulfillmentRequested
  | FulfillmentRejected
  | PackageWasSent
  | PackageWasDelivered
  | StockReleased;

export type Shipment = {
  id: string;
  referenceId: string;
  productItems: ShipmentProductItem[];
  status?: ShipmentStatus;
};

export const initialShipment = (): Shipment => ({
  id: '',
  referenceId: '',
  productItems: [],
});

export const isStockHeld = (shipment: Shipment) =>
  shipment.status === 'Reserved' ||
  shipment.status === 'FulfillmentRequested' ||
  shipment.status === 'FulfillmentRejected';

export const evolve = (shipment: Shipment, event: ShipmentEvent): Shipment => {
  switch (event.type) {
    case 'shipments.StockCheckRequested':
      return {
        id: event.data.shipmentId,
        referenceId: event.data.referenceId,
        productItems: event.data.productItems,
        status: 'StockCheckRequested',
      };
    case 'shipments.StockReserved':
      return {
        referenceId: event.data.referenceId,
        id: event.data.shipmentId,
        productItems: event.data.productItems,
        status: 'Reserved',
      };
    case 'shipments.ProductWasOutOfStock':
      return {
        referenceId: event.data.referenceId,
        id: event.data.shipmentId,
        productItems: event.data.productItems,
        status: 'ProductsOutOfStock',
      };
    case 'shipments.FulfillmentRequested':
      return { ...shipment, status: 'FulfillmentRequested' };
    case 'shipments.FulfillmentRejected':
      return { ...shipment, status: 'FulfillmentRejected' };
    case 'shipments.PackageWasSent':
      return { ...shipment, status: 'Sent' };
    case 'shipments.PackageWasDelivered':
      return { ...shipment, status: 'Delivered' };
    case 'shipments.StockReleased':
      return { ...shipment, status: 'Released' };
  }
};
