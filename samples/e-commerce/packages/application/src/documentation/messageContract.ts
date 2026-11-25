import type { z } from 'zod';

export type MessageKind = 'command' | 'event';

export type EarlierForm = { name: string; data: Record<string, unknown> };

export type MessageContract = {
  type: string;
  kind: MessageKind;
  description: string;
  schema: z.ZodType<Record<string, unknown>>;
  allFields: Record<string, unknown>;
  requiredOnly?: Record<string, unknown>;
  earlierForms?: EarlierForm[];
};

export const messageContract = <
  Data extends Record<string, unknown>,
>(contract: {
  type: string;
  kind: MessageKind;
  description: string;
  schema: z.ZodType<Data>;
  allFields: Data;
  requiredOnly?: Data;
  earlierForms?: EarlierForm[];
}): MessageContract => contract;

export const contractsOf = (namespace: string) => {
  const contractOf =
    (kind: MessageKind) =>
    <Data extends Record<string, unknown>>(
      name: string,
      description: string,
      schema: z.ZodType<Data>,
      allFields: Data,
      variants: { requiredOnly?: Data; earlierForms?: EarlierForm[] } = {},
    ) =>
      messageContract<Data>({
        type: `${namespace}.${name}`,
        kind,
        description,
        schema,
        allFields,
        ...variants,
      });

  return { event: contractOf('event'), command: contractOf('command') };
};

export type BodyContract = {
  name: string;
  schema: z.ZodType<Record<string, unknown>>;
  allFields: Record<string, unknown>;
  requiredOnly?: Record<string, unknown>;
};

export const bodyContract = <Body extends Record<string, unknown>>(contract: {
  name: string;
  schema: z.ZodType<Body>;
  allFields: Body;
  requiredOnly?: Body;
}): BodyContract => contract;
