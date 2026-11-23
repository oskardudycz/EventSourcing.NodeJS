import { describe, expect, it } from 'vitest';
import {
  messageRouter,
  messageRoutes,
  routeChannel,
  routeKey,
} from './messageRoutes';

type Message = { type: string; data: { referenceId?: string } };
const message = (type: string, referenceId?: string): Message => ({
  type,
  data: { referenceId },
});

describe('messageRouter', () => {
  it('firstMatchingRuleGivesTheChannelAndAnotherTheKey', () => {
    const router = messageRouter(
      [
        messageRoutes<Message>(
          routeChannel('orders.OrderPlaced', 'orders-external'),
          routeKey('orders.OrderPlaced', (m) => m.data.referenceId),
          routeChannel('orders.OrderPlaced', 'ignored'),
        ),
      ],
      ['orders-external'],
    );

    expect(router.routeFor(message('orders.OrderPlaced', 'k-1'))).toEqual({
      channel: 'orders-external',
      key: 'k-1',
    });
  });

  it('givesNoRouteForAnUnknownType', () => {
    const router = messageRouter([messageRoutes<Message>()], []);

    expect(router.routeFor(message('x.Unknown'))).toEqual({
      channel: undefined,
      key: undefined,
    });
  });

  it('failsNamingTheTypeWhenNoRouteExists', () => {
    const router = messageRouter([messageRoutes<Message>()], ['a']);

    expect(() => router.declaredRouteFor(message('x.Unknown'))).toThrow(
      "No route for message type 'x.Unknown'",
    );
  });

  it('anUndeclaredChannelFailsNamingTheChannel', () => {
    const router = messageRouter(
      [messageRoutes<Message>(routeChannel('x.Known', 'nowhere'))],
      ['declared'],
    );

    expect(() => router.declaredRouteFor(message('x.Known'))).toThrow(
      "Channel 'nowhere' of message type 'x.Known' is not declared",
    );
  });

  it('routesByPredicate', () => {
    const router = messageRouter(
      [
        messageRoutes<Message>(
          routeChannel(
            (m) => m.type.startsWith('payments.external.'),
            'payments-external',
          ),
        ),
      ],
      ['payments-external'],
    );

    expect(
      router.declaredRouteFor(message('payments.external.PaymentFailed'))
        .channel,
    ).toBe('payments-external');
  });
});
