export type Event<
  StreamEvent extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>
> = Readonly<{
  type: Readonly<StreamEvent>;
  data: Readonly<EventData>;
}>;

export type Command<
  CommandType extends string = string,
  CommandData extends Record<string, unknown> = Record<string, unknown>
> = Readonly<{
  type: Readonly<CommandType>;
  data: Readonly<CommandData>;
}>;

export type Decider<
  State,
  CommandType extends Command,
  StreamEvent extends Event
> = {
  decide: (command: CommandType, state: State) => StreamEvent | StreamEvent[];
  evolve: (currentState: State, event: StreamEvent) => State;
  getInitialState: () => State;
};
