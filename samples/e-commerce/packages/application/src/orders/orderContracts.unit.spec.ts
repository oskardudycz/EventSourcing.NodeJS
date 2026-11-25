import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contractSnapshotTests } from '../documentation/contractSnapshotTests';
import { orderBodyContracts, orderStoredContracts } from './orderContracts';
import { isOrderEvent, requestsOf } from './orderWorkflow';

contractSnapshotTests({
  module: 'orders',
  messages: orderStoredContracts,
  bodies: orderBodyContracts,
});

const storedMessageIn = async (
  file: string,
): Promise<{ type: string; data: unknown }> => {
  const snapshot: unknown = JSON.parse(
    await readFile(
      join(import.meta.dirname, 'contracts', 'messages', file),
      'utf8',
    ),
  );

  if (
    typeof snapshot === 'object' &&
    snapshot !== null &&
    'type' in snapshot &&
    typeof snapshot.type === 'string' &&
    'data' in snapshot
  )
    return { ...snapshot, type: snapshot.type };

  throw new Error(`${file} is not a stored message`);
};

describe('stored orders.OrderCanceled', () => {
  it('anOrderCanceledStoredBeforeTheShipmentIdWasWrittenReleasesNoStock', async () => {
    const stored = await storedMessageIn(
      'orders.OrderCanceled.before-shipment-id.json',
    );

    expect(stored).not.toHaveProperty('data.shipmentId');
    expect(stored).toHaveProperty('data.shipmentStatus', 'Reserved');
    if (!isOrderEvent(stored)) throw new Error('Not an order event');

    expect(requestsOf(stored)).toEqual([
      expect.objectContaining({ type: 'payments.CancelPayment' }),
    ]);
  });
});
