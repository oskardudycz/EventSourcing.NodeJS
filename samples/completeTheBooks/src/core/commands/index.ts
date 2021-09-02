export type CommandMetadata = {
  $expectedRevision?: string;
};

export type Command<
  CommandType extends string = string,
  CommandData extends Record<string, unknown> = Record<string, unknown>,
  Metadata extends CommandMetadata & Record<string, unknown> = CommandMetadata &
    Record<string, unknown>
> = {
  readonly type: CommandType;
  readonly data: CommandData;
  metadata?: Readonly<Metadata>;
};

export function isCommand<
  CommandType extends string = string,
  CommandData extends Record<string, unknown> = Record<string, unknown>,
  Metadata extends CommandMetadata & Record<string, unknown> = CommandMetadata &
    Record<string, unknown>
>(event: any): event is Command<CommandType, CommandData, Metadata> {
  return typeof event.type !== 'undefined' && typeof event.data !== 'undefined';
}
