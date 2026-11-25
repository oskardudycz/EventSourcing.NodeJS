import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { asyncApiDocument } from '../packages/application/src/documentation/asyncApiDocument.ts';
import { buildApplication } from '../packages/application/src/buildApplication.ts';
import { readSettings } from '../packages/application/src/settings.ts';

const folder = process.argv[2];

if (!folder) throw new Error('Usage: exportSpecs <folder>');

await mkdir(folder, { recursive: true });

const write = (name, document) =>
  writeFile(join(folder, name), `${JSON.stringify(document, null, 2)}\n`);

const { application, stop } = buildApplication(
  readSettings({ EVENTSTORE_TYPE: 'sqlite', MESSAGING_BUS: 'none' }),
  {},
);

try {
  for (const module of ['shopping_carts', 'orders']) {
    const response = await application.fetch(
      new Request(`http://localhost/openapi/modules/${module}`),
    );

    await write(`openapi-${module}.json`, await response.json());
  }
} finally {
  await stop();
}

for (const module of ['shopping_carts', 'orders', 'payments', 'shipments'])
  await write(`asyncapi-${module}.json`, asyncApiDocument(module));
