import { Flavour } from './typing';

export type Command<
  CommandType extends string = string,
  CommandData extends Record<string, unknown> = Record<string, unknown>,
> = Flavour<
  Readonly<{
    type: Readonly<CommandType>;
    data: Readonly<CommandData>;
  }>,
  'Command'
>;
