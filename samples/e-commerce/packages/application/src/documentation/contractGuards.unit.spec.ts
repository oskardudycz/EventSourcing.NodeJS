import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const applicationFolder = join(import.meta.dirname, '..', '..');
const vitest = join(
  applicationFolder,
  '..',
  '..',
  'node_modules',
  'vitest',
  'vitest.mjs',
);

const runSnapshotTests = (
  module: string,
  spec: string,
  snapshots: string,
  environment: Record<string, string>,
) =>
  spawnSync(
    process.execPath,
    [vitest, 'run', `src/${module}/${spec}.unit.spec.ts`],
    {
      cwd: applicationFolder,
      env: { ...process.env, ...environment, CONTRACT_SNAPSHOTS: snapshots },
      encoding: 'utf8',
    },
  );

describe('contract snapshots', () => {
  let copy = '';

  const copyOfContractsOf = async (module: string) => {
    copy = await mkdtemp(join(tmpdir(), 'contracts-'));
    await cp(join(import.meta.dirname, '..', module, 'contracts'), copy, {
      recursive: true,
    });
  };

  afterEach(() => rm(copy, { recursive: true, force: true }));

  const productItemAdded = () =>
    join(
      copy,
      'messages',
      'shopping_carts.ProductItemAddedToShoppingCart.all-fields.json',
    );
  const shoppingCartsOnCI = () =>
    runSnapshotTests('shoppingCarts', 'shoppingCartContracts', copy, {
      CI: 'true',
    });

  it('aChangedSerializedFormFailsItsSnapshot', async () => {
    await copyOfContractsOf('shoppingCarts');
    const snapshot = await readFile(productItemAdded(), 'utf8');
    await writeFile(
      productItemAdded(),
      snapshot.replace('"addedAt"', '"added"'),
    );

    const result = shoppingCartsOnCI();

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/1 failed/);
  });

  it('aMissingSnapshotFailsOnCI', async () => {
    await copyOfContractsOf('shoppingCarts');
    await rm(productItemAdded());

    const result = shoppingCartsOnCI();

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain('Snapshot');
  });

  it('theCurrentSnapshotsPassOnCI', async () => {
    await copyOfContractsOf('shoppingCarts');

    expect(shoppingCartsOnCI().status).toBe(0);
  });

  it('aSnapshotWithoutAContractFailsOnCI', async () => {
    await copyOfContractsOf('shoppingCarts');
    await writeFile(
      join(copy, 'messages', 'shopping_carts.RemovedMessage.all-fields.json'),
      '{}\n',
    );

    const result = shoppingCartsOnCI();

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain(
      'noSnapshotIsLeftWithoutAContract',
    );
  });

  it('aMessageWithOptionalFieldsNeedsItsRequiredOnlySnapshot', async () => {
    await copyOfContractsOf('orders');
    await rm(join(copy, 'messages', 'orders.OrderCanceled.required-only.json'));

    const result = runSnapshotTests('orders', 'orderContracts', copy, {
      CI: 'true',
    });

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain(
      'optionalFieldsHaveAllFieldsAndRequiredOnlySnapshots',
    );
  });
});
