import {
  externalMessageId,
  getForwarderId,
  type ForwardedMessage,
  type ForwardingHandler,
  type ForwardTo,
  type HandlerRetryOptions,
} from '@e-commerce/core';
import type { RecordedMessage } from '@event-driven-io/emmett';
import type { ShipmentEvent } from '../shipment';
import {
  shipmentsResponseRoutes,
  shipmentsResponsesChannel,
} from '../shipmentsConfig';
import type { ShipmentExternalEvent } from './shipmentExternalEvent';
import type { ShipmentSummaries } from './shipmentSummaries';

export const shipmentsExternalForwarderId = getForwarderId({
  name: 'shipments-external',
});

export const shipmentForwarderTypes = [
  'shipments.StockReserved',
  'shipments.ProductWasOutOfStock',
  'shipments.PackageWasSent',
  'shipments.FulfillmentRejected',
] as const;

const toExternalEvents =
  (summaries: ShipmentSummaries) =>
  async (
    event: RecordedMessage<ShipmentEvent>,
  ): Promise<ForwardedMessage<ShipmentExternalEvent>[]> => {
    if (!shipmentForwarderTypes.some((forwarded) => forwarded === event.type))
      return [];

    const { shipmentId } = event.data;
    const summary = await summaries.get(shipmentId);

    if (!summary) throw new Error(`Shipment '${shipmentId}' has no summary`);

    const { referenceId } = summary;
    const metadataOf = (type: ShipmentExternalEvent['type']) => ({
      messageId: externalMessageId(event.metadata.messageId, type),
      correlationId: event.metadata.correlationId,
      causationId: event.metadata.messageId,
    });

    switch (event.type) {
      case 'shipments.StockReserved':
        return [
          {
            type: 'shipments.external.StockReserved',
            data: {
              shipmentId,
              referenceId,
              reservedAt: event.data.reservedAt,
            },
            metadata: metadataOf('shipments.external.StockReserved'),
          },
        ];
      case 'shipments.ProductWasOutOfStock':
        return [
          {
            type: 'shipments.external.ShipmentFailed',
            data: {
              shipmentId,
              referenceId,
              reason: 'ProductsOutOfStock',
              failedAt: event.data.availabilityCheckedAt,
            },
            metadata: metadataOf('shipments.external.ShipmentFailed'),
          },
        ];
      case 'shipments.PackageWasSent':
        return [
          {
            type: 'shipments.external.PackageWasSent',
            data: {
              shipmentId,
              referenceId,
              carrier: event.data.carrier,
              trackingNumber: event.data.trackingNumber,
              sentAt: event.data.sentAt,
            },
            metadata: metadataOf('shipments.external.PackageWasSent'),
          },
        ];
      case 'shipments.FulfillmentRejected':
        return [
          {
            type: 'shipments.external.ShipmentFailed',
            data: {
              shipmentId,
              referenceId,
              reason: 'FulfillmentRejected',
              failedAt: event.data.rejectedAt,
            },
            metadata: metadataOf('shipments.external.ShipmentFailed'),
          },
        ];
      default:
        return [];
    }
  };

export const shipmentExternalEventForwarder = ({
  summaries,
  forward,
  ...retry
}: HandlerRetryOptions & {
  summaries: ShipmentSummaries;
  forward: ForwardTo;
}): ForwardingHandler<ShipmentEvent> =>
  forward<ShipmentEvent, ShipmentExternalEvent>({
    channels: [shipmentsResponsesChannel],
    routes: [shipmentsResponseRoutes],
    map: toExternalEvents(summaries),
    ...retry,
  });
