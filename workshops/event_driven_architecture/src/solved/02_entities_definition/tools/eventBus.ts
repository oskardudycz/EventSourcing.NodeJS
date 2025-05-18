export type Event<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>,
> = Readonly<{
  type: Readonly<EventType>;
  data: Readonly<EventData>;
}>;

export interface EventBus {
  publish<E extends Event>(events: E[]): void;
  subscribe<E extends Event>(
    eventType: string,
    eventHandler: EventHandler<E>,
  ): void;

  use(middleware: EventHandler): void;
}

export type EventHandler<E extends Event = Event> = (event: E) => void;

export const getEventBus = (): EventBus => {
  const handlers: Map<string, EventHandler[]> = new Map();
  const middlewares: EventHandler[] = [];

  return {
    publish: <E extends Event>(events: E[]): void => {
      for (const event of events) {
        for (const middleware of middlewares) middleware(event);

        const eventHandlers = handlers.get(event.type) ?? [];

        for (const handle of eventHandlers) {
          handle(event);
        }
      }
    },
    subscribe: <E extends Event>(
      eventType: string,
      eventHandler: EventHandler<E>,
    ): void => {
      if (!handlers.has(eventType)) {
        handlers.set(eventType, []);
      }
      const eventHandlers = handlers.get(eventType) ?? [];
      eventHandlers.push(eventHandler as EventHandler);
      handlers.set(eventType, eventHandlers);
    },
    use: (middleware: EventHandler): void => {
      middlewares.push(middleware);
    },
  };
};
