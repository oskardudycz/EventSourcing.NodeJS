export type Command<
  CommandType extends string = string,
  CommandData extends Record<string, unknown> = Record<string, unknown>
> = {
  readonly type: CommandType;
  readonly data: CommandData;
};
