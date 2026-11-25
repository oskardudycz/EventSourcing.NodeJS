import { brokerBodyOf, brokerHeadersOf } from '@e-commerce/core';
import { JSONSerializer, type Command } from '@event-driven-io/emmett';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { channelFlows } from './channelFlows';
import type { BodyContract, MessageContract } from './messageContract';

type Variant = { name: string; data: Record<string, unknown> };

const variantsOf = (contract: {
  allFields: Record<string, unknown>;
  requiredOnly?: Record<string, unknown>;
  earlierForms?: Variant[];
}): Variant[] => [
  { name: 'all-fields', data: contract.allFields },
  ...(contract.requiredOnly === undefined
    ? []
    : [{ name: 'required-only', data: contract.requiredOnly }]),
  ...(contract.earlierForms ?? []),
];

const asJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const parsed = (json: string): unknown => JSON.parse(json);

const isSent = (contract: MessageContract) =>
  channelFlows.some(({ contracts }) => contracts.includes(contract));

const storedFormOf = ({ type }: MessageContract, data: Variant['data']) =>
  asJson({ type, data: parsed(JSONSerializer.serialize(data)) });

const sentHeadersOf = (
  { type, kind }: MessageContract,
  data: Variant['data'],
) => {
  const metadata = { messageId: 'message-1' };

  return kind === 'command'
    ? brokerHeadersOf<Command>({
        type,
        kind: 'Command',
        data,
        metadata: { ...metadata, now: new Date(0) },
      })
    : brokerHeadersOf({ type, kind: 'Event', data, metadata });
};

const sentFormOf = (contract: MessageContract, data: Variant['data']) =>
  asJson({
    headers: sentHeadersOf(contract, data),
    body: parsed(brokerBodyOf(data).toString('utf-8')),
  });

const writtenFormOf = (contract: MessageContract, { data }: Variant) =>
  isSent(contract) ? sentFormOf(contract, data) : storedFormOf(contract, data);

const isOptionalOrNullable = (field: z.ZodType) =>
  field.safeParse(undefined).success || field.safeParse(null).success;

const hasOptionalFields = (schema: z.ZodType) =>
  schema instanceof z.ZodObject &&
  Object.values(schema.shape).some(
    (field) => field instanceof z.ZodType && isOptionalOrNullable(field),
  );

const snapshotFile = (name: string, variant: string) =>
  `${name}.${variant}.json`;

const filesIn = (folder: string) =>
  readdir(folder).then(
    (names) => names.sort(),
    () => [],
  );

const snapshotFilesOf = (
  contracts: { name: string; variants: Variant[] }[],
): string[] =>
  contracts
    .flatMap(({ name, variants }) =>
      variants.map((variant) => snapshotFile(name, variant.name)),
    )
    .sort();

export const contractSnapshotTests = ({
  module,
  messages,
  bodies,
}: {
  module: string;
  messages: MessageContract[];
  bodies: BodyContract[];
}) => {
  const snapshots =
    process.env.CONTRACT_SNAPSHOTS ??
    join(import.meta.dirname, '..', module, 'contracts');

  describe(`${module} message contracts`, () => {
    describe.each(messages)('$type', (contract) => {
      it.each(variantsOf(contract))(
        '$name keeps the form it is written in',
        (variant) =>
          expect(writtenFormOf(contract, variant)).toMatchFileSnapshot(
            join(
              snapshots,
              'messages',
              snapshotFile(contract.type, variant.name),
            ),
          ),
      );
    });
  });

  describe.runIf(bodies.length > 0)(`${module} HTTP body contracts`, () => {
    describe.each(bodies)('$name', (contract) => {
      it.each(variantsOf(contract))(
        '$name keeps the form it is written in',
        ({ name, data }) =>
          expect(asJson(data)).toMatchFileSnapshot(
            join(snapshots, 'http', snapshotFile(contract.name, name)),
          ),
      );
    });
  });

  describe(`${module} contract snapshots`, () => {
    it('optionalFieldsHaveAllFieldsAndRequiredOnlySnapshots', async () => {
      const written = new Set([
        ...(await filesIn(join(snapshots, 'messages'))),
        ...(await filesIn(join(snapshots, 'http'))),
      ]);
      const withOptionalFields = [
        ...messages.map((contract) => ({ name: contract.type, contract })),
        ...bodies.map((contract) => ({ name: contract.name, contract })),
      ].filter(({ contract }) => hasOptionalFields(contract.schema));

      expect(
        withOptionalFields.map(({ name, contract }) => ({
          name,
          requiredOnly: contract.requiredOnly !== undefined,
          files: [
            written.has(snapshotFile(name, 'all-fields')),
            written.has(snapshotFile(name, 'required-only')),
          ],
        })),
      ).toEqual(
        withOptionalFields.map(({ name }) => ({
          name,
          requiredOnly: true,
          files: [true, true],
        })),
      );
    });

    it('noSnapshotIsLeftWithoutAContract', async () => {
      expect(await filesIn(join(snapshots, 'messages'))).toEqual(
        snapshotFilesOf(
          messages.map((contract) => ({
            name: contract.type,
            variants: variantsOf(contract),
          })),
        ),
      );
      expect(await filesIn(join(snapshots, 'http'))).toEqual(
        snapshotFilesOf(
          bodies.map((contract) => ({
            name: contract.name,
            variants: variantsOf(contract),
          })),
        ),
      );
    });
  });
};
