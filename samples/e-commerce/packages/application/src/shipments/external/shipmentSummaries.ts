import type { ReadEvent } from '@event-driven-io/emmett';
import { singleStreamReadModel } from '../../readModelProjection';
import type { PongoClient } from '@event-driven-io/pongo';
import type { ShipmentEvent } from '../shipment';

export const shipmentSummariesCollection = 'shipment_summaries';

export type ShipmentSummary = { referenceId: string };

export const shipmentSummariesReadModel = singleStreamReadModel<
  ShipmentSummary,
  ShipmentEvent
>({
  collectionName: shipmentSummariesCollection,
  canHandle: ['shipments.StockReserved', 'shipments.ProductWasOutOfStock'],
  getDocumentId: (event) => event.data.shipmentId,
  evolve: (
    current: ShipmentSummary | null,
    event: ReadEvent<ShipmentEvent>,
  ): ShipmentSummary | null =>
    event.type === 'shipments.StockReserved' ||
    event.type === 'shipments.ProductWasOutOfStock'
      ? { referenceId: event.data.referenceId }
      : current,
});

export const shipmentSummaries = (pongo: PongoClient) => {
  const collection = pongo
    .db()
    .collection<ShipmentSummary>(shipmentSummariesCollection);

  return {
    get: (shipmentId: string) => collection.findOne({ _id: shipmentId }),
  };
};

export type ShipmentSummaries = ReturnType<typeof shipmentSummaries>;
