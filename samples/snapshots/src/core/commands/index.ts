export type Command<
  CommandType extends string = string,
  CommandData extends Record<string, unknown> = Record<string, unknown>,
  CommandMetadata extends Record<string, unknown> = Record<string, unknown>,
> = {
  readonly type: CommandType;
  readonly data: CommandData;
  metadata?: Readonly<CommandMetadata>;
};

export function isCommand<
  CommandType extends string = string,
  CommandData extends Record<string, unknown> = Record<string, unknown>,
  CommandMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  command: unknown,
): command is Command<CommandType, CommandData, CommandMetadata> {
  return (
    typeof command === 'object' &&
    command !== null &&
    'type' in command &&
    'data' in command
  );
}
