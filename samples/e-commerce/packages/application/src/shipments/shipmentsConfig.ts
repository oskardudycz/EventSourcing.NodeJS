import {
  messageRoutes,
  routeChannel,
  routeKey,
  Urns,
  type ForwardedMessage,
} from '@e-commerce/core';
import {
  shipmentExternalEventTypes,
  type ShipmentExternalEvent,
} from './external/shipmentExternalEvent';
import { shipmentRequestTypes, type ShipmentRequest } from './shipmentCommand';

export const shipmentsRequestsChannel = 'shipments-requests';
export const shipmentsResponsesChannel = 'shipments-responses';

export const shipmentsChannels = [
  shipmentsRequestsChannel,
  shipmentsResponsesChannel,
];

export const shipmentsRequestsQueue = 'shipments-requests';

export const shipmentsSubscriptions = {
  requests: {
    channel: shipmentsRequestsChannel,
    queue: shipmentsRequestsQueue,
  },
};

const isShipmentRequest = (message: { type: string }) =>
  shipmentRequestTypes.some((type) => type === message.type);

const isShipmentResponse = (message: { type: string }) =>
  shipmentExternalEventTypes.some((type) => type === message.type);

export const shipmentsRequestRoutes = messageRoutes<
  ForwardedMessage<ShipmentRequest>
>(
  routeChannel<ForwardedMessage<ShipmentRequest>>(
    isShipmentRequest,
    shipmentsRequestsChannel,
  ),
  routeKey<ForwardedMessage<ShipmentRequest>>(isShipmentRequest, (message) =>
    Urns.routingKeyOf(
      'referenceId' in message.data
        ? message.data.referenceId
        : message.data.shipmentId,
    ),
  ),
);

export const shipmentsResponseRoutes = messageRoutes<
  ForwardedMessage<ShipmentExternalEvent>
>(
  routeChannel<ForwardedMessage<ShipmentExternalEvent>>(
    isShipmentResponse,
    shipmentsResponsesChannel,
  ),
  routeKey<ForwardedMessage<ShipmentExternalEvent>>(
    isShipmentResponse,
    (message) => Urns.routingKeyOf(message.data.referenceId),
  ),
);
