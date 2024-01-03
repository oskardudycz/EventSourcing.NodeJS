export class Command {}

export interface CommandBus {
  send<C extends Command>(command: C): Promise<void>;
}

export interface CommandHandler<C extends Command> {
  handle(command: C): Promise<void>;
}

type RegisteredHandler =
  | {
      canHandle: true;
      handle: (command: Command) => Promise<void>;
    }
  | { canHandle: false };

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
type Constructor<T> = new (...args: any[]) => T;

let commandBus: CommandBus | undefined;
const commandHandlers: ((command: Command) => RegisteredHandler)[] = [];

export const CommandBusFactory = (): CommandBus => {
  if (commandBus === undefined) {
    commandBus = {
      send: <C extends Command>(command: C): Promise<void> => {
        const handler = commandHandlers
          .map((handler) => handler(command))
          .find((handler) => handler.canHandle);

        if (handler === undefined || !handler.canHandle) {
          return Promise.reject(
            new Error(
              `Command handler for ${JSON.stringify(command)} not found!`,
            ),
          );
        }
        return handler.handle(command);
      },
    };
  }

  return commandBus;
};

export const registerCommandHandler = <C extends Command>(
  commandType: Constructor<C>,
  commandHandler: CommandHandler<C>,
) => {
  return commandHandlers.push((command: Command) => {
    if (!(command instanceof commandType)) {
      return {
        canHandle: false,
      };
    }

    return {
      canHandle: true,
      handle: () => commandHandler.handle(command),
    };
  });
};
