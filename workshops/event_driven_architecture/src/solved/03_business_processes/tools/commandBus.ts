export type Command<
  CommandType extends string = string,
  CommandData extends Record<string, unknown> = Record<string, unknown>,
> = Readonly<{
  type: Readonly<CommandType>;
  data: Readonly<CommandData>;
}>;

export interface CommandBus {
  send<C extends Command>(commands: C[]): void;
  handle<C extends Command>(
    commandType: string,
    commandHandler: CommandHandler<C>,
  ): void;

  use(middleware: CommandHandler): void;
}

export type CommandHandler<C extends Command = Command> = (command: C) => void;

export const getCommandBus = (): CommandBus => {
  const handlers: Map<string, CommandHandler> = new Map();
  const middlewares: CommandHandler[] = [];

  return {
    send: <E extends Command>(commands: E[]): void => {
      for (const command of commands) {
        for (const middleware of middlewares) middleware(command);

        const handle = handlers.get(command.type);

        if (handle) handle(command);
      }
    },
    handle: <E extends Command>(
      commandType: string,
      commandHandler: CommandHandler<E>,
    ): void => {
      handlers.set(commandType, commandHandler as CommandHandler);
    },
    use: (middleware: CommandHandler): void => {
      middlewares.push(middleware);
    },
  };
};
