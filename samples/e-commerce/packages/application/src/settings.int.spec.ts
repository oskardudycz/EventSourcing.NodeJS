import { removeSQLiteFolder, temporarySQLiteFolder } from '@e-commerce/core';
import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildApplication } from './buildApplication';
import { paymentProvider } from './payments/paymentProvider';
import { OrderId } from './orders/order';
import { isOrderEvent } from './orders/orderWorkflow';
import { readSettings } from './settings';
import { warehouse } from './shipments/warehouse';
import { ShoppingCartId } from './shoppingCarts/shoppingCart';
import { until } from './testInfrastructure';

const build = (environment: Record<string, string>) =>
  buildApplication(readSettings(environment), {
    paymentGateway: paymentProvider(),
    warehouse: warehouse(),
    pulling: { pullingFrequencyInMs: 20, batchSize: 1 },
  });

describe('settings build the application', () => {
  it.each([
    ['rabbitmq', 'postgresql', 11],
    ['kafka', 'postgresql', 13],
    ['in-memory', 'sqlite', 7],
    ['none', 'sqlite', 4],
    ['kafka', 'sqlite', 13],
  ])(
    'settingsBuildTheChosenForwardersConsumersAndStore %s with %s',
    async (messagingBus, eventStoreType, consumers) => {
      const built = build({
        MESSAGING_BUS: messagingBus,
        EVENTSTORE_TYPE: eventStoreType,
      });

      expect({
        messagingBus: built.stores.messagingBus,
        eventStoreType: built.stores.location.type,
        consumers: built.application.consumers.length,
      }).toEqual({ messagingBus, eventStoreType, consumers });

      await built.stop();
    },
  );

  it('withoutSqliteFolderATemporaryFolderIsCreatedAndRemoved', async () => {
    const built = build({
      MESSAGING_BUS: 'in-memory',
      EVENTSTORE_TYPE: 'sqlite',
    });
    const { sqliteFolder } = built;
    if (!sqliteFolder) throw new Error('No SQLite folder');

    await built.start();
    const whileRunning = readdirSync(sqliteFolder).filter((file) =>
      file.endsWith('.db'),
    );
    await built.stop();

    expect(whileRunning.sort()).toEqual([
      'broker.db',
      'orders.db',
      'payments.db',
      'shipments.db',
      'shopping_carts.db',
    ]);
    expect(existsSync(sqliteFolder)).toBe(false);
  });

  it('aGivenSqliteFolderKeepsDataAcrossRestarts', async () => {
    const folder = temporarySQLiteFolder();
    const customerId = crypto.randomUUID();
    const cartUrl = `http://localhost/customers/${customerId}/shopping-carts/current`;
    const settings = {
      MESSAGING_BUS: 'none',
      EVENTSTORE_TYPE: 'sqlite',
      SQLITE_FOLDER: folder,
    };

    try {
      const first = build(settings);
      await first.start();
      const added = await first.application.fetch(
        new Request(`${cartUrl}/product-items`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ productId: crypto.randomUUID(), quantity: 2 }),
        }),
      );
      await first.stop();

      const second = build(settings);
      await second.start();
      const cart = await second.application.fetch(new Request(cartUrl));
      const body: unknown = await cart.json();
      await second.stop();

      expect({ added: added.status, cart: cart.status }).toEqual({
        added: 200,
        cart: 200,
      });
      expect(body).toMatchObject({ lines: [{ quantity: 2 }] });
      expect(existsSync(folder)).toBe(true);
    } finally {
      await removeSQLiteFolder(folder);
    }
  });

  it('aRestartContinuesAfterTheCheckpoint', async () => {
    const folder = temporarySQLiteFolder();
    const customerId = crypto.randomUUID();
    const cartUrl = `http://localhost/customers/${customerId}/shopping-carts/current`;
    const orderId = OrderId.derivedFrom(ShoppingCartId.of(customerId, 1));
    const settings = {
      MESSAGING_BUS: 'none',
      EVENTSTORE_TYPE: 'sqlite',
      SQLITE_FOLDER: folder,
    };
    const orderEventsOf = async (built: ReturnType<typeof build>) =>
      (
        await built.stores.orders.store.readStream(
          OrderId.workflowStreamNameOf(orderId),
        )
      ).events.filter(isOrderEvent);

    try {
      const first = build(settings);
      await first.start();
      await first.application.fetch(
        new Request(`${cartUrl}/product-items`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ productId: crypto.randomUUID(), quantity: 2 }),
        }),
      );
      await first.application.fetch(
        new Request(`${cartUrl}/checkout`, {
          method: 'POST',
          headers: { 'if-match': 'W/"1"' },
        }),
      );
      await until(async () => (await orderEventsOf(first)).length > 0);
      const beforeTheRestart = (await orderEventsOf(first)).length;
      await first.stop();

      const second = build(settings);
      await second.start();
      await Promise.all(
        second.application.consumers.map((consumer) =>
          consumer.whenCaughtUp({ timeout: 10_000 }),
        ),
      );
      const afterTheRestart = (await orderEventsOf(second)).length;
      await second.stop();

      expect(afterTheRestart).toBe(beforeTheRestart);
    } finally {
      await removeSQLiteFolder(folder);
    }
  });
});
