import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { orderCanceledContract } from './orderContracts';

const here = dirname(fileURLToPath(import.meta.url));
const contracts = join(here, 'contracts');
const applicationFolder = join(here, '..', '..');
const snapshotSpec = 'src/documentation/contractSnapshots.unit.spec.ts';
const vitest = join(
  applicationFolder,
  '..',
  '..',
  'node_modules',
  'vitest',
  'vitest.mjs',
);
const productItemAdded =
  'messages/shopping_carts.ProductItemAddedToShoppingCart';

const runSnapshotTests = (
  snapshots: string,
  environment: Record<string, string>,
) =>
  spawnSync(process.execPath, [vitest, 'run', snapshotSpec], {
    cwd: applicationFolder,
    env: { ...process.env, ...environment, CONTRACT_SNAPSHOTS: snapshots },
    encoding: 'utf8',
  });

describe('contract snapshots', () => {
  let copy = '';

  beforeEach(async () => {
    copy = await mkdtemp(join(tmpdir(), 'contracts-'));
    await cp(contracts, copy, { recursive: true });
  });

  afterEach(() => rm(copy, { recursive: true, force: true }));

  it('aChangedSerializedFormFailsItsSnapshot', async () => {
    const file = join(copy, `${productItemAdded}.all-fields.json`);
    const snapshot = await readFile(file, 'utf8');
    await writeFile(file, snapshot.replace('"addedAt"', '"added"'));

    const result = runSnapshotTests(copy, { CI: 'true' });

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/1 failed \| 66 passed/);
  });

  it('aMissingSnapshotFailsOnCI', async () => {
    await rm(join(copy, `${productItemAdded}.all-fields.json`));

    const result = runSnapshotTests(copy, { CI: 'true' });

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain('Snapshot');
  });

  it('theCurrentSnapshotsPassOnCI', () => {
    const result = runSnapshotTests(copy, { CI: 'true' });

    expect(result.status).toBe(0);
  });

  it('anOldOrderCanceledWithoutShipmentIdReadsUndefined', async () => {
    const snapshot: unknown = JSON.parse(
      await readFile(
        join(contracts, 'messages/orders.OrderCanceled.required-only.json'),
        'utf8',
      ),
    );

    expect(snapshot).not.toHaveProperty('data.shipmentId');

    const { shipmentId } = orderCanceledContract.schema.parse(
      typeof snapshot === 'object' && snapshot !== null && 'data' in snapshot
        ? snapshot.data
        : undefined,
    );

    expect(shipmentId).toBeUndefined();
  });
});
