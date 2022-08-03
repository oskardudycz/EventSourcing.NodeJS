import { Event } from './event';

export type Decider<State, Command, EventType extends Event> = {
  decide: (command: Command, state: State) => EventType[];
  evolve: (currentState: State, event: EventType) => State;
  getInitialState: () => State;
};
