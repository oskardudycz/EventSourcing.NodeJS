export type Route = { channel: string | undefined; key: string | undefined };
export type DeclaredRoute = { channel: string; key: string | undefined };

type RoutedMessage = { type: string };
type Selector<Message extends RoutedMessage> =
  string | ((message: Message) => boolean);

export type RouteRule<Message extends RoutedMessage = RoutedMessage> = {
  matches(message: Message): boolean;
  route(message: Message): Partial<Route>;
};

export type MessageRoutes<Message extends RoutedMessage = RoutedMessage> =
  readonly RouteRule<Message>[];

const matcherOf = <Message extends RoutedMessage>(
  selector: Selector<Message>,
) =>
  typeof selector === 'string'
    ? (message: Message) => message.type === selector
    : selector;

export const routeChannel = <Message extends RoutedMessage>(
  selector: Selector<Message>,
  channel: string | ((message: Message) => string | undefined),
): RouteRule<Message> => ({
  matches: matcherOf(selector),
  route: (message) => ({
    channel: typeof channel === 'string' ? channel : channel(message),
  }),
});

export const routeKey = <Message extends RoutedMessage>(
  selector: Selector<Message>,
  key: (message: Message) => string | undefined,
): RouteRule<Message> => ({
  matches: matcherOf(selector),
  route: (message) => ({ key: key(message) }),
});

export const messageRoutes = <Message extends RoutedMessage>(
  ...rules: RouteRule<Message>[]
): MessageRoutes<Message> => rules;

export const messageRouter = <Message extends RoutedMessage>(
  routes: readonly MessageRoutes<Message>[],
  declaredChannels: Iterable<string>,
) => {
  const rules = routes.flat();
  const declared = new Set(declaredChannels);

  const routeFor = (message: Message): Route => {
    let channel: string | undefined;
    let key: string | undefined;

    for (const rule of rules) {
      if (channel !== undefined && key !== undefined) break;
      if (!rule.matches(message)) continue;

      const route = rule.route(message);
      channel ??= route.channel;
      key ??= route.key;
    }

    return { channel, key };
  };

  const declaredRouteFor = (message: Message): DeclaredRoute => {
    const { channel, key } = routeFor(message);

    if (channel === undefined)
      throw new Error(`No route for message type '${message.type}'`);

    if (!declared.has(channel))
      throw new Error(
        `Channel '${channel}' of message type '${message.type}' is not declared`,
      );

    return { channel, key };
  };

  return { routeFor, declaredRouteFor };
};

export type MessageRouter<Message extends RoutedMessage = RoutedMessage> =
  ReturnType<typeof messageRouter<Message>>;
