import { removeSQLiteFolder, temporarySQLiteFolder } from '@e-commerce/core';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { buildApplication } from './buildApplication';
import { paymentProvider } from './payments/paymentProvider';
import { OrderId } from './orders/order';
import { isOrderEvent } from './orders/orderWorkflow';
import { readSettings } from './settings';
import { warehouse, type WarehouseFake } from './shipments/warehouse';
import { ShoppingCartId } from './shoppingCarts/shoppingCart';
import { until } from './testInfrastructure';

const build = (
  environment: Record<string, string>,
  stock: WarehouseFake = warehouse(),
) =>
  buildApplication(readSettings(environment), {
    paymentGateway: paymentProvider(),
    warehouse: stock,
    pulling: { pullingFrequencyInMs: 20, batchSize: 1 },
  });

const checkingOut = async (
  built: ReturnType<typeof build>,
  customerId: string,
) => {
  const cartUrl = `http://localhost/customers/${customerId}/shopping-carts/current`;
  await built.application.fetch(
    new Request(`${cartUrl}/product-items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: crypto.randomUUID(), quantity: 2 }),
    }),
  );
  await built.application.fetch(
    new Request(`${cartUrl}/checkout`, {
      method: 'POST',
      headers: { 'if-match': 'W/"1"' },
    }),
  );
};

const orderEventsOf = async (
  built: ReturnType<typeof build>,
  customerId: string,
) =>
  (
    await built.stores.orders.store.readStream(
      OrderId.workflowStreamNameOf(
        OrderId.derivedFrom(ShoppingCartId.of(customerId, 1)),
      ),
    )
  ).events.filter(isOrderEvent);

describe('settings build the application', () => {
  it.each([
    [
      'in-memory',
      [
        'broker.db',
        'orders.db',
        'payments.db',
        'shipments.db',
        'shopping_carts.db',
      ],
    ],
    ['none', ['orders.db', 'payments.db', 'shipments.db', 'shopping_carts.db']],
  ])(
    'settingsBuildTheChosenForwardersConsumersAndStore %s with sqlite',
    async (messagingBus, databases) => {
      const built = build({
        MESSAGING_BUS: messagingBus,
        EVENTSTORE_TYPE: 'sqlite',
        WORKERS_SCHEDULED: 'false',
      });
      const { sqliteFolder } = built;
      const customerId = crypto.randomUUID();
      await built.start();

      await checkingOut(built, customerId);
      await until(
        async () => (await orderEventsOf(built, customerId)).length > 0,
      );
      const files = readdirSync(sqliteFolder ?? '').filter((file) =>
        file.endsWith('.db'),
      );
      await built.stop();

      expect(built.stores.location.type).toBe('sqlite');
      expect(files.sort()).toEqual(databases);
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

  it('theGrafanaAndEventCatalogUrlsOfTheSettingsShowInTheShopLayout', async () => {
    const built = build({
      MESSAGING_BUS: 'none',
      EVENTSTORE_TYPE: 'sqlite',
      SHOP_GRAFANA_URL: 'http://grafana.example:4000',
      SHOP_EVENTCATALOG_URL: 'http://catalog.example:4001',
    });
    await built.start();

    const page = await built.application.fetch(
      new Request('http://localhost/shop/login'),
    );
    const html = await page.text();
    await built.stop();

    expect(html).toContain('href="http://grafana.example:4000"');
    expect(html).toContain('href="http://catalog.example:4001"');
  });

  it('aGivenSqliteFolderThatDoesNotExistIsCreatedAndKept', async () => {
    const folder = join(tmpdir(), `missing-${crypto.randomUUID()}`);

    try {
      const built = build({
        MESSAGING_BUS: 'none',
        EVENTSTORE_TYPE: 'sqlite',
        SQLITE_FOLDER: folder,
      });
      await built.start();
      const whileRunning = existsSync(folder);
      await built.stop();

      expect(whileRunning).toBe(true);
      expect(existsSync(folder)).toBe(true);
    } finally {
      await removeSQLiteFolder(folder);
    }
  });

  it('aRestartContinuesAfterTheCheckpoint', async () => {
    const folder = temporarySQLiteFolder();
    const stock = warehouse();
    const settings = {
      MESSAGING_BUS: 'none',
      EVENTSTORE_TYPE: 'sqlite',
      SQLITE_FOLDER: folder,
      WORKERS_SCHEDULED: 'false',
    };
    const firstCustomer = crypto.randomUUID();
    const secondCustomer = crypto.randomUUID();

    try {
      const first = build(settings, stock);
      await first.start();
      await checkingOut(first, firstCustomer);
      await until(() => stock.stockChecks() === 1);
      await first.stop();

      const second = build(settings, stock);
      await second.start();
      await Promise.all(
        second.application.consumers.map((consumer) =>
          consumer.whenCaughtUp({ timeout: 10_000 }),
        ),
      );
      const checksAfterTheRestart = stock.stockChecks();
      await checkingOut(second, secondCustomer);
      await until(
        async () => (await orderEventsOf(second, secondCustomer)).length > 0,
      );
      await second.stop();

      expect(checksAfterTheRestart).toBe(1);
    } finally {
      await removeSQLiteFolder(folder);
    }
  });
});
