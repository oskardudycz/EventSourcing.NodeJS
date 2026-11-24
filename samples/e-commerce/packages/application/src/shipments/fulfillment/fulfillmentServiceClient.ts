import { retryInHandler, type HandlerRetryOptions } from '@e-commerce/core';
import type { Logger } from 'pino';
import type { FulfillmentRequested, StockCheckRequested } from '../shipment';
import type { ConfirmStockAvailability } from '../shipmentCommand';
import type { WarehouseGateway } from '../warehouseGateway';

export const fulfillmentServiceClient = ({
  warehouse,
  logger,
  retry,
  signal,
}: HandlerRetryOptions & {
  warehouse: WarehouseGateway;
  logger: Logger;
}) => ({
  requestFulfillment: async ({ data }: FulfillmentRequested): Promise<void> => {
    try {
      await warehouse.request(data.shipmentId, data.productItems);
    } catch (error) {
      logger.error(
        { err: error, shipmentId: data.shipmentId },
        `Requesting fulfillment for shipment ${data.shipmentId} failed`,
      );
    }
  },
  checkStock: async ({
    data,
  }: StockCheckRequested): Promise<ConfirmStockAvailability[]> => {
    try {
      const availability = await retryInHandler(
        async () => {
          try {
            return await Promise.all(
              data.productItems.map(warehouse.isProductAvailable),
            );
          } catch (error) {
            logger.error(
              { err: error, shipmentId: data.shipmentId },
              `Checking the stock for shipment ${data.shipmentId} failed`,
            );

            throw error;
          }
        },
        { retry, signal },
      );

      return [
        {
          type: 'shipments.ConfirmStockAvailability',
          data: {
            shipmentId: data.shipmentId,
            productsAvailable: availability.every(Boolean),
          },
        },
      ];
    } catch (error) {
      if (signal?.aborted) return [];

      throw error;
    }
  },
});
