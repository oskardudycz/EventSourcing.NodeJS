import { Event } from '../../tools/events';
import { Command } from '../../tools/commands';

export type Decider<
  State,
  CommandType extends Command,
  StreamEvent extends Event,
> = {
  decide: (command: CommandType, state: State) => StreamEvent | StreamEvent[];
  evolve: (currentState: State, event: StreamEvent) => State;
  getInitialState: () => State;
};
