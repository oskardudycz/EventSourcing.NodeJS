import { removeSQLiteFolder, temporarySQLiteFolder } from '@e-commerce/core';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createModuleStores,
  storesOf,
  type EventStoreLocation,
  type ModuleStores,
} from './eventStore';
import { OrderId } from './orders/order';
import { ShipmentId } from './shipments/shipment';
import type { ReserveStock } from './shipments/shipmentCommand';
import { registerShipmentsProcessors } from './shipments/shipmentsProcessors';
import { shipmentWorkflowInbox } from './shipments/shipmentWorkflow';
import { warehouse, type WarehouseFake } from './shipments/warehouse';
import { ShoppingCartId } from './shoppingCarts/shoppingCart';
import { startPostgreSQL, until } from './testInfrastructure';

const now = () => new Date('2026-01-01T10:00:00.000Z');

const shipmentsConsumerOn = (stores: ModuleStores, stock: WarehouseFake) => {
  const consumer = stores.shipments.consumer();

  registerShipmentsProcessors(consumer, {
    warehouse: stock,
    logger: pino({ level: 'silent' }),
    now,
    retry: { forever: false, retries: 0 },
  });

  return consumer;
};

const aFailedOutputHandlerRunsAgainAfterRestartAndTheInputIsDecidedOnce = (
  location: () => EventStoreLocation,
) =>
  it('aFailedOutputHandlerRunsAgainAfterRestartAndTheInputIsDecidedOnce', async () => {
    const stores = createModuleStores(location(), 'none', {
      pullingFrequencyInMs: 20,
      batchSize: 1,
    });
    await stores.shipments.store.schema.migrate();
    const referenceId = OrderId.derivedFrom(
      ShoppingCartId.of(crypto.randomUUID(), 1),
    );
    const shipmentId = ShipmentId.derivedFrom(referenceId);
    const reserve: ReserveStock = {
      type: 'shipments.ReserveStock',
      data: {
        referenceId,
        productItems: [{ productId: crypto.randomUUID(), quantity: 1 }],
      },
    };
    const decisionsOf = async (type: string) =>
      (
        await stores.shipments.store.readStream(
          ShipmentId.workflowStreamNameOf(shipmentId),
        )
      ).events.filter((event) => event.type === type);
    const stock = warehouse();
    await stock.stockCheckFails(1).run();
    await shipmentWorkflowInbox(now)(stores.shipments.store, reserve);

    const failing = shipmentsConsumerOn(stores, stock);
    await failing.start().catch(() => undefined);
    await failing.close();
    const stockChecksAfterTheFailure = stock.stockChecks();
    const checksRequestedAfterTheFailure = await decisionsOf(
      'shipments.StockCheckRequested',
    );

    const restarted = shipmentsConsumerOn(stores, stock);
    void restarted.start();
    await restarted.whenStarted();
    await until(
      async () => (await decisionsOf('shipments.StockReserved')).length > 0,
      10_000,
    );
    const checksRequestedAfterTheRestart = await decisionsOf(
      'shipments.StockCheckRequested',
    );
    const reservedAfterTheRestart = await decisionsOf(
      'shipments.StockReserved',
    );
    await restarted.close();
    for (const database of storesOf(stores)) await database.close();

    expect(stockChecksAfterTheFailure).toBe(1);
    expect(stock.stockChecks()).toBe(2);
    expect(checksRequestedAfterTheFailure).toHaveLength(1);
    expect(checksRequestedAfterTheRestart).toHaveLength(1);
    expect(reservedAfterTheRestart).toHaveLength(1);
  });

describe('a workflow whose output handler fails after the decision was appended', () => {
  describe('on SQLite', () => {
    const folders: string[] = [];

    afterAll(async () => {
      for (const folder of folders) await removeSQLiteFolder(folder);
    });

    aFailedOutputHandlerRunsAgainAfterRestartAndTheInputIsDecidedOnce(() => {
      const folder = temporarySQLiteFolder();
      folders.push(folder);
      return { type: 'sqlite', folder };
    });
  });

  describe('on PostgreSQL', () => {
    let postgreSQL: Awaited<ReturnType<typeof startPostgreSQL>>;

    beforeAll(async () => {
      postgreSQL = await startPostgreSQL();
    }, 120_000);

    afterAll(async () => {
      await postgreSQL.stop();
    });

    aFailedOutputHandlerRunsAgainAfterRestartAndTheInputIsDecidedOnce(() => ({
      type: 'postgresql',
      connectionString: postgreSQL.connectionString,
    }));
  });
});
