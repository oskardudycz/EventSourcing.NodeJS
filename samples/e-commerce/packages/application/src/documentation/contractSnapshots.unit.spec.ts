import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bodyContracts, messageContracts } from './allContracts';
import { serializedForm } from './messageContract';

const snapshotsFolder =
  process.env.CONTRACT_SNAPSHOTS ??
  join(dirname(fileURLToPath(import.meta.url)), 'contracts');

const variantsOf = (contract: {
  allFields: unknown;
  requiredOnly?: unknown;
}) => [
  { name: 'all-fields', data: contract.allFields },
  ...(contract.requiredOnly === undefined
    ? []
    : [{ name: 'required-only', data: contract.requiredOnly }]),
];

describe('message contracts', () => {
  describe.each(messageContracts)('$type', (contract) => {
    it.each(variantsOf(contract))(
      '$name matches its snapshot',
      ({ name, data }) =>
        expect(
          serializedForm(contract, contract.schema.parse(data)),
        ).toMatchFileSnapshot(
          join(snapshotsFolder, 'messages', `${contract.type}.${name}.json`),
        ),
    );
  });
});

describe('HTTP body contracts', () => {
  describe.each(bodyContracts)('$name', (contract) => {
    it.each(variantsOf(contract))(
      '$name matches its snapshot',
      ({ name, data }) =>
        expect(
          `${JSON.stringify(contract.schema.parse(data), null, 2)}\n`,
        ).toMatchFileSnapshot(
          join(snapshotsFolder, 'http', `${contract.name}.${name}.json`),
        ),
    );
  });
});
