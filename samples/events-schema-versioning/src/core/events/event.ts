export type Event<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>
> = {
  readonly type: EventType;
  readonly data: EventData;
};
