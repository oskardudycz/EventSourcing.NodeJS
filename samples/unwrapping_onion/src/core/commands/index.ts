export class Command {}

export interface CommandBus {
  send<C extends Command>(command: C): Promise<void>;
}

let commandBus: CommandBus | undefined;

export const CommandBusFactory = (): CommandBus => {
  if (commandBus === undefined) {
    commandBus = {
      send: <C extends Command>(_command: C): Promise<void> => {
        return Promise.resolve();
      },
    };
  }

  return commandBus;
};

export default CommandBus;
