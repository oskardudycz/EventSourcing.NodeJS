import { Command } from './command';
import { Event } from './event';

/// Inspired by https://blog.bittacklr.be/the-workflow-pattern.html

export type WorkflowEvent<Output extends Command | Event> = Extract<
  Output,
  { __brand?: 'Event' }
>;

export type Workflow<
  Input extends Event | Command,
  State,
  Output extends Event | Command,
> = {
  decide: (command: Input, state: State) => Output[];
  evolve: (currentState: State, event: WorkflowEvent<Output>) => State;
  getInitialState: () => State;
};
