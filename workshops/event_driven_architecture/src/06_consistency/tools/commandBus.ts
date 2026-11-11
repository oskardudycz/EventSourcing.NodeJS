export type Command<
  CommandType extends string = string,
  CommandData extends Record<string, unknown> = Record<string, unknown>,
> = Readonly<{
  type: Readonly<CommandType>;
  data: Readonly<CommandData>;
}>;

export interface CommandBus {
  send<C extends Command>(commands: C[]): Promise<void>;
  handle<C extends Command>(
    commandType: C['type'],
    commandHandler: CommandHandler<C>,
  ): void;

  use(middleware: CommandMiddleware): void;
}

export type CommandHandler<C extends Command = Command> = (
  command: C,
) => Promise<void> | void;

export type CommandMiddleware = (command: Command) => void;

export const getCommandBus = (): CommandBus => {
  const handlers: Map<string, CommandHandler> = new Map();
  const middlewares: CommandMiddleware[] = [];

  return {
    send: async <E extends Command>(commands: E[]): Promise<void> => {
      for (const command of commands) {
        for (const middleware of middlewares) middleware(command);

        const handle = handlers.get(command.type);

        if (handle) await handle(command);
      }
    },
    handle: <E extends Command>(
      commandType: string,
      commandHandler: CommandHandler<E>,
    ): void => {
      handlers.set(commandType, commandHandler as CommandHandler);
    },
    use: (middleware: CommandMiddleware): void => {
      middlewares.push(middleware);
    },
  };
};
