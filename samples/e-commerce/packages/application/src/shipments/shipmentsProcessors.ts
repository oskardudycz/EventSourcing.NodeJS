import {
  isInAChannelStream,
  toWorkflowInbox,
  type HandlerRetryOptions,
} from '@e-commerce/core';
import type { Logger } from 'pino';
import type { ChannelReading } from '../messagingBus';
import type { ModuleConsumer } from '../moduleConsumer';
import { fulfillmentServiceClient } from './fulfillment/fulfillmentServiceClient';
import { ShipmentId, type Shipment } from './shipment';
import { shipmentRequestTypes, type ShipmentRequest } from './shipmentCommand';
import {
  shipmentWorkflowInbox,
  shipmentWorkflowOptions,
  type ShipmentWorkflowInput,
  type ShipmentWorkflowOutput,
} from './shipmentWorkflow';
import { shipmentsSubscriptions } from './shipmentsConfig';
import type { WarehouseGateway } from './warehouseGateway';

type ShipmentsConsumer = ModuleConsumer;

type ShipmentsProcessorsOptions = HandlerRetryOptions & {
  now: () => Date;
  warehouse: WarehouseGateway;
  logger: Logger;
};

export const registerShipmentsProcessors = (
  shipments: ShipmentsConsumer,
  { warehouse, logger, now, retry, signal }: ShipmentsProcessorsOptions,
) => {
  const warehouseClient = fulfillmentServiceClient({
    warehouse,
    logger,
    retry,
    signal,
  });

  shipments.workflowProcessor<
    ShipmentWorkflowInput,
    Shipment,
    ShipmentWorkflowOutput
  >({
    ...shipmentWorkflowOptions(now),
    separateInputInboxFromProcessing: true,
    processorId: 'shipments-workflow',
    getWorkflowId: (message) =>
      isInAChannelStream(message) ? null : ShipmentId.ofCommand(message),
    outputHandler: {
      canHandle: [
        'shipments.StockCheckRequested',
        'shipments.FulfillmentRequested',
      ],
      eachBatch: async (messages): Promise<ShipmentWorkflowInput[]> => {
        const answers: ShipmentWorkflowInput[] = [];

        for (const message of messages)
          if (message.type === 'shipments.StockCheckRequested')
            answers.push(...(await warehouseClient.checkStock(message)));
          else if (message.type === 'shipments.FulfillmentRequested')
            await warehouseClient.requestFulfillment(message);

        return answers;
      },
    },
  });
};

export const registerShipmentsChannelReaders = (
  read: ChannelReading,
  { now }: { now: () => Date },
) => {
  read<ShipmentRequest>({
    subscription: shipmentsSubscriptions.requests,
    canHandle: [...shipmentRequestTypes],
    handle: toWorkflowInbox(shipmentWorkflowInbox(now)),
  });
};
