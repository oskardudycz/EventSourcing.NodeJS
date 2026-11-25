import { WorkflowHandler, type Workflow } from '@event-driven-io/emmett';
import {
  evolve,
  initialShipment,
  isStockHeld,
  ShipmentId,
  type Shipment,
  type ShipmentEvent,
} from './shipment';
import { shipmentCommandTypes, type ShipmentCommand } from './shipmentCommand';

export const shipmentWorkflowName = 'shipments';

export type ShipmentWorkflowInput = ShipmentCommand;
export type ShipmentWorkflowOutput = ShipmentEvent;

export const shipmentEventTypes: ShipmentEvent['type'][] = [
  'shipments.StockCheckRequested',
  'shipments.StockReserved',
  'shipments.ProductWasOutOfStock',
  'shipments.FulfillmentRequested',
  'shipments.FulfillmentRejected',
  'shipments.PackageWasSent',
  'shipments.PackageWasDelivered',
  'shipments.StockReleased',
];

export const isShipmentEvent = (message: {
  type: string;
}): message is ShipmentEvent =>
  shipmentEventTypes.some((type) => type === message.type);

const decideShipment = (
  input: ShipmentWorkflowInput,
  shipment: Shipment,
  now: () => Date,
): ShipmentEvent[] => {
  const at = now().toISOString();

  switch (input.type) {
    case 'shipments.ReserveStock': {
      if (shipment.status !== undefined) return [];

      const { referenceId, productItems } = input.data;

      return [
        {
          type: 'shipments.StockCheckRequested',
          data: {
            shipmentId: ShipmentId.derivedFrom(referenceId),
            referenceId,
            productItems,
            requestedAt: at,
          },
        },
      ];
    }
    case 'shipments.ConfirmStockAvailability': {
      if (shipment.status !== 'StockCheckRequested') return [];

      const { id: shipmentId, referenceId, productItems } = shipment;

      return input.data.productsAvailable && productItems.length > 0
        ? [
            {
              type: 'shipments.StockReserved',
              data: { shipmentId, referenceId, productItems, reservedAt: at },
            },
          ]
        : [
            {
              type: 'shipments.ProductWasOutOfStock',
              data: {
                shipmentId,
                referenceId,
                productItems,
                availabilityCheckedAt: at,
              },
            },
          ];
    }
    case 'shipments.RequestFulfillment':
      return shipment.status !== 'Reserved'
        ? []
        : [
            {
              type: 'shipments.FulfillmentRequested',
              data: {
                shipmentId: shipment.id,
                productItems: shipment.productItems,
                requestedAt: at,
              },
            },
          ];
    case 'shipments.ConfirmPackageSent':
      return shipment.status !== 'FulfillmentRequested'
        ? []
        : [
            {
              type: 'shipments.PackageWasSent',
              data: {
                shipmentId: shipment.id,
                carrier: input.data.carrier,
                trackingNumber: input.data.trackingNumber,
                sentAt: at,
              },
            },
          ];
    case 'shipments.RejectFulfillment':
      return shipment.status !== 'FulfillmentRequested'
        ? []
        : [
            {
              type: 'shipments.FulfillmentRejected',
              data: { shipmentId: shipment.id, rejectedAt: at },
            },
          ];
    case 'shipments.DeliverPackage':
      return shipment.status !== 'Sent'
        ? []
        : [
            {
              type: 'shipments.PackageWasDelivered',
              data: { shipmentId: shipment.id, deliveredAt: at },
            },
          ];
    case 'shipments.ReleaseStock':
      return !isStockHeld(shipment)
        ? []
        : [
            {
              type: 'shipments.StockReleased',
              data: { shipmentId: shipment.id, releasedAt: at },
            },
          ];
  }
};

export const evolveShipmentWorkflow = (
  shipment: Shipment,
  message: { type: string },
): Shipment =>
  isShipmentEvent(message) ? evolve(shipment, message) : shipment;

export const shipmentWorkflow = (
  now: () => Date,
): Workflow<ShipmentWorkflowInput, Shipment, ShipmentWorkflowOutput> => ({
  name: shipmentWorkflowName,
  decide: (input, shipment) => decideShipment(input, shipment, now),
  evolve: evolveShipmentWorkflow,
  initialState: initialShipment,
});

export const shipmentWorkflowOptions = (now: () => Date) => ({
  workflow: shipmentWorkflow(now),
  mapWorkflowId: ShipmentId.workflowStreamNameOf,
  getWorkflowId: ShipmentId.ofCommand,
  inputs: { commands: [...shipmentCommandTypes], events: [] },
  outputs: { commands: [], events: shipmentEventTypes },
});

export const shipmentWorkflowInbox = (now: () => Date) =>
  WorkflowHandler<ShipmentWorkflowInput, Shipment, ShipmentWorkflowOutput>({
    ...shipmentWorkflowOptions(now),
    separateInputInboxFromProcessing: true,
  });
