import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import {
  action,
  ApiE2ESpecification,
  attempt,
  expectAppended,
  expectError,
  expectNothingAppended,
  expectNothingPublished,
  expectPublished,
  expectResponse,
  htmlContaining,
  htmlNotContaining,
  redirectsTo,
  send,
  timePasses,
  type PublishedMessage,
} from './apiE2ESpecification';
import type { Worker } from '../workers';
import { manualClock } from './manualClock';

const recordingWorker = (): Worker & { handledAt: Date[] } => {
  const handledAt: Date[] = [];
  return {
    handledAt,
    handle: (now) => {
      handledAt.push(now);
    },
  };
};

const counterApp = () => {
  let count = 0;
  const app = new Hono();
  app.post('/counter', (c) => {
    count++;
    return c.body(null, 204);
  });
  app.get('/counter', (c) => c.json({ count }));
  return app;
};

describe('ApiE2ESpecification', () => {
  it('aRequestOnlySpecificationWorksAsInEmmett', async () => {
    const app = counterApp();
    const given = ApiE2ESpecification.for({ fetch: (r) => app.fetch(r) });

    await given((request) => request.post('/counter'))
      .when((request) => request.get('/counter'))
      .then(expectResponse(200, { body: { count: 1 } }));
  });

  it('aGivenRequestThatFailsDoesNotFailTheTest', async () => {
    const app = new Hono();
    app.post('/broken', (c) => c.text('broken', 500));
    app.get('/ok', (c) => c.text('ok'));
    const given = ApiE2ESpecification.for({ fetch: (r) => app.fetch(r) });

    await given((request) => request.post('/broken'))
      .when((request) => request.get('/ok'))
      .then(expectResponse(200));
  });

  it('aMessageStepIsHandedToTheConfiguredSender', async () => {
    const handedOver: unknown[][] = [];
    const given = ApiE2ESpecification.for({
      fetch: () => new Response(),
      sendMessages: (messages) => {
        handedOver.push([...messages]);
        return Promise.resolve();
      },
    });

    await given(send({ type: 'First', data: {} }, { type: 'Second', data: {} }))
      .when(send({ type: 'Third', data: {} }))
      .then();

    expect(handedOver).toEqual([
      [
        { type: 'First', data: {} },
        { type: 'Second', data: {} },
      ],
      [{ type: 'Third', data: {} }],
    ]);
  });

  it('aMessageStepWithoutASenderFailsTheTest', async () => {
    const given = ApiE2ESpecification.for({ fetch: () => new Response() });

    await expect(
      given()
        .when(send({ type: 'First', data: {} }))
        .then(),
    ).rejects.toThrow('Sending messages needs the sendMessages option');
  });

  it('aTimeStepMovesTheClockAndRunsTheWorkersOnce', async () => {
    const clock = manualClock(new Date('2026-01-01T00:00:00.000Z'));
    const first = recordingWorker();
    const second = recordingWorker();
    const given = ApiE2ESpecification.for({
      fetch: () => new Response(),
      clock,
      workers: [first, second],
    });

    await given(timePasses(1_000)).when(timePasses(60_000)).then();

    const expected = [
      new Date('2026-01-01T00:00:01.000Z'),
      new Date('2026-01-01T00:01:01.000Z'),
    ];
    expect(first.handledAt).toEqual(expected);
    expect(second.handledAt).toEqual(expected);
  });

  it('anActionStepRunsBetweenTheRequests', async () => {
    let price = 10;
    const app = new Hono();
    app.get('/price', (c) => c.json({ price }));
    const given = ApiE2ESpecification.for({ fetch: (r) => app.fetch(r) });

    await given(
      action(() => {
        price = 20;
      }),
    )
      .when((request) => request.get('/price'))
      .then(expectResponse(200, { body: { price: 20 } }));
  });

  it('aTimeStepWithoutAClockFailsTheTest', async () => {
    const given = ApiE2ESpecification.for({ fetch: () => new Response() });

    await expect(given().when(timePasses(1_000)).then()).rejects.toThrow(
      'Making time pass needs the clock option',
    );
  });

  it('aFailingAttemptInGivenDoesNotFailTheTest', async () => {
    const given = ApiE2ESpecification.for({
      fetch: (request) => {
        if (new URL(request.url).pathname === '/unreachable')
          throw new Error('Unreachable');
        return new Response(null, { status: 204 });
      },
    });

    await given(attempt((request) => request.get('/unreachable')))
      .when((request) => request.get('/reachable'))
      .then(expectResponse(204));
  });

  it('aGivenRequestThatThrowsFailsTheTest', async () => {
    const given = ApiE2ESpecification.for({
      fetch: () => {
        throw new Error('Unreachable');
      },
    });

    await expect(
      given((request) => request.get('/unreachable'))
        .when((request) => request.get('/reachable'))
        .then(),
    ).rejects.toThrow('Unreachable');
  });

  describe('expectError', () => {
    const problemDetails = {
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Shopping cart was not found',
    };
    const given = ApiE2ESpecification.for({
      fetch: () =>
        Response.json(problemDetails, {
          status: 404,
          headers: { 'content-type': 'application/problem+json' },
        }),
    });

    it('expectErrorChecksStatusAndProblemDetails', async () => {
      await given()
        .when((request) => request.get('/carts/1'))
        .then(expectError(404, { title: 'Not Found', status: 404 }));
    });

    it('expectErrorFailsWhenTheStatusDiffers', async () => {
      await expect(
        given()
          .when((request) => request.get('/carts/1'))
          .then(expectError(409)),
      ).rejects.toThrow('Response status');
    });

    it('expectErrorFailsWhenTheProblemDetailsDiffer', async () => {
      await expect(
        given()
          .when((request) => request.get('/carts/1'))
          .then(expectError(404, { detail: 'Order was not found' })),
      ).rejects.toThrow();
    });
  });

  describe('expectResponse', () => {
    const given = ApiE2ESpecification.for({
      fetch: () =>
        Response.json(
          { id: 'cart-1', items: [1, 2] },
          { headers: { etag: 'W/"2"' } },
        ),
    });

    it('expectResponseChecksStatusBodyAndHeaders', async () => {
      await given()
        .when((request) => request.get('/carts/1'))
        .then(
          expectResponse(200, {
            body: { id: 'cart-1' },
            headers: { ETag: 'W/"2"' },
          }),
        );
    });

    it('expectResponseFailsWhenTheBodyDiffers', async () => {
      await expect(
        given()
          .when((request) => request.get('/carts/1'))
          .then(expectResponse(200, { body: { id: 'cart-2' } })),
      ).rejects.toThrow();
    });

    it('expectResponseFailsWhenAHeaderDiffers', async () => {
      await expect(
        given()
          .when((request) => request.get('/carts/1'))
          .then(expectResponse(200, { headers: { etag: 'W/"3"' } })),
      ).rejects.toThrow();
    });

    it('expectResponseFailsWhenTheWhenStepIsNotARequest', async () => {
      const spec = ApiE2ESpecification.for({
        fetch: () => new Response(),
        sendMessages: () => Promise.resolve(),
      });

      await expect(
        spec()
          .when(send({ type: 'First', data: {} }))
          .then(expectResponse(200)),
      ).rejects.toThrow('The when step got no response');
    });
  });

  describe('page expectations', () => {
    const app = new Hono();
    app.get('/page', (c) => c.html('<h1>Your orders</h1>'));
    app.post('/orders', (c) => c.redirect('/orders/42?from=cart', 303));
    app.get('/data', (c) => c.json({ text: 'Your orders' }));
    const given = ApiE2ESpecification.for({ fetch: (r) => app.fetch(r) });

    it('htmlContainingAndRedirectsToCheckTheResponse', async () => {
      await given()
        .when((request) => request.get('/page'))
        .then(expectResponse(200), htmlContaining('Your orders', '<h1>'));

      await given()
        .when((request) => request.post('/orders'))
        .then(expectResponse(303), redirectsTo('/orders/42'));
    });

    it('htmlContainingFailsWhenTheTextIsMissing', async () => {
      await expect(
        given()
          .when((request) => request.get('/page'))
          .then(htmlContaining('Your payments')),
      ).rejects.toThrow();
    });

    it('htmlContainingFailsWhenTheResponseIsNotHtml', async () => {
      await expect(
        given()
          .when((request) => request.get('/data'))
          .then(htmlContaining('Your orders')),
      ).rejects.toThrow('Content type');
    });

    it('htmlNotContainingFailsWhenTheTextIsThere', async () => {
      await given()
        .when((request) => request.get('/page'))
        .then(htmlNotContaining('Your payments'));

      await expect(
        given()
          .when((request) => request.get('/page'))
          .then(htmlNotContaining('Your orders')),
      ).rejects.toThrow();
    });

    it('redirectsToFailsWhenThePathDiffers', async () => {
      await expect(
        given()
          .when((request) => request.post('/orders'))
          .then(redirectsTo('/orders/43')),
      ).rejects.toThrow();
    });

    it('redirectsToFailsWhenThereIsNoLocation', async () => {
      await expect(
        given()
          .when((request) => request.get('/page'))
          .then(redirectsTo('/orders/42')),
      ).rejects.toThrow('Location');
    });
  });

  describe('published messages', () => {
    const publishedBy = (...messages: PublishedMessage[]) => {
      const published: PublishedMessage[] = [];
      const given = ApiE2ESpecification.for({
        fetch: () => new Response(),
        sendMessages: () => {
          published.push(...messages);
          return Promise.resolve();
        },
        published: () => published,
      });
      return { given, published };
    };

    it('expectPublishedChecksOnlyWhatTheWhenStepSent', async () => {
      const { given } = publishedBy({ type: 'Sent', data: {} });

      await given(send({ type: 'Ignored', data: {} }))
        .when(send({ type: 'Ignored', data: {} }))
        .then(expectPublished({ type: 'Sent', data: {} }));
    });

    it('expectPublishedFailsWhenMessagesDifferOrAreOutOfOrder', async () => {
      const { given } = publishedBy(
        { type: 'First', data: {} },
        { type: 'Second', data: {} },
      );

      await given()
        .when(send({ type: 'Any', data: {} }))
        .then(
          expectPublished(
            { type: 'First', data: {} },
            { type: 'Second', data: {} },
          ),
        );

      await expect(
        given()
          .when(send({ type: 'Any', data: {} }))
          .then(
            expectPublished(
              { type: 'Second', data: {} },
              { type: 'First', data: {} },
            ),
          ),
      ).rejects.toThrow();

      await expect(
        given()
          .when(send({ type: 'Any', data: {} }))
          .then(expectPublished({ type: 'First', data: {} })),
      ).rejects.toThrow();
    });

    it('expectPublishedFailsWhenMessagesWithTheSameKeyAreOutOfOrder', async () => {
      const { given } = publishedBy(
        { type: 'First', data: {}, metadata: { key: 'order.1' } },
        { type: 'Second', data: {}, metadata: { key: 'order.1' } },
      );

      await expect(
        given()
          .when(send({ type: 'Any', data: {} }))
          .then(
            expectPublished(
              { type: 'Second', data: {} },
              { type: 'First', data: {} },
            ),
          ),
      ).rejects.toThrow();
    });

    it('expectPublishedIgnoresTheOrderBetweenDifferentKeys', async () => {
      const { given } = publishedBy(
        { type: 'First', data: {}, metadata: { key: 'order.1' } },
        { type: 'Second', data: {}, metadata: { key: 'order.2' } },
        { type: 'Third', data: {}, metadata: { key: 'order.1' } },
      );

      await given()
        .when(send({ type: 'Any', data: {} }))
        .then(
          expectPublished(
            { type: 'Second', data: {} },
            { type: 'First', data: {} },
            { type: 'Third', data: {} },
          ),
        );
    });

    it('expectPublishedFailsWhenAMessageIsMissingOrExtraWhateverTheKeys', async () => {
      const { given } = publishedBy(
        { type: 'First', data: {}, metadata: { key: 'order.1' } },
        { type: 'Second', data: {}, metadata: { key: 'order.2' } },
      );

      await expect(
        given()
          .when(send({ type: 'Any', data: {} }))
          .then(
            expectPublished(
              { type: 'Second', data: {} },
              { type: 'Third', data: {} },
            ),
          ),
      ).rejects.toThrow();

      await expect(
        given()
          .when(send({ type: 'Any', data: {} }))
          .then(expectPublished({ type: 'Second', data: {} })),
      ).rejects.toThrow();
    });

    it('expectPublishedChecksTheRoutingKeyOnlyWhenItIsGiven', async () => {
      const { given } = publishedBy({
        type: 'Sent',
        data: {},
        metadata: { key: 'ecommerce.order.1' },
      });
      const sendOne = () => given().when(send({ type: 'Any', data: {} }));

      await sendOne().then(expectPublished({ type: 'Sent', data: {} }));
      await sendOne().then(
        expectPublished({
          type: 'Sent',
          data: {},
          metadata: { key: 'ecommerce.order.1' },
        }),
      );

      await expect(
        sendOne().then(
          expectPublished({
            type: 'Sent',
            data: {},
            metadata: { key: 'ecommerce.order.2' },
          }),
        ),
      ).rejects.toThrow();
    });

    it('expectPublishedKeepsTheOrderOfMessagesWithTheSameKeyOnly', async () => {
      const first = { type: 'First', data: {}, metadata: { key: 'a' } };
      const second = { type: 'Second', data: {}, metadata: { key: 'a' } };
      const other = { type: 'Other', data: {}, metadata: { key: 'b' } };
      const { given } = publishedBy(first, other, second);
      const whenSent = () => given().when(send({ type: 'Any', data: {} }));

      await whenSent().then(expectPublished(first, other, second));
      await whenSent().then(expectPublished(other, first, second));
      await whenSent().then(expectPublished(first, second, other));

      await expect(
        whenSent().then(expectPublished(second, first, other)),
      ).rejects.toThrow();
      await expect(
        whenSent().then(expectPublished(first, other)),
      ).rejects.toThrow();
      await expect(
        whenSent().then(expectPublished(first, other, second, other)),
      ).rejects.toThrow();
      await expect(
        whenSent().then(
          expectPublished(first, other, {
            type: 'Third',
            data: {},
            metadata: { key: 'a' },
          }),
        ),
      ).rejects.toThrow();
    });

    it('expectNothingPublishedFailsWhenSomethingWasSent', async () => {
      const quiet = publishedBy();
      await quiet
        .given()
        .when(send({ type: 'Any', data: {} }))
        .then(expectNothingPublished());

      const { given } = publishedBy({ type: 'First', data: {} });
      await expect(
        given()
          .when(send({ type: 'Any', data: {} }))
          .then(expectNothingPublished()),
      ).rejects.toThrow();
    });
  });

  describe('appended events', () => {
    const appendingApp = () =>
      ApiE2ESpecification.for({
        getApplication: (eventStore) => {
          const app = new Hono();
          app.post('/streams/:stream/events/:type', async (c) => {
            await eventStore.appendToStream(c.req.param('stream'), [
              { type: c.req.param('type'), data: {} },
            ]);
            return c.body(null, 204);
          });
          return { fetch: (r) => app.fetch(r) };
        },
      });

    it('expectAppendedChecksOnlyWhatTheWhenStepAppended', async () => {
      const given = appendingApp();

      await given((request) => request.post('/streams/s/events/First'))
        .when((request) => request.post('/streams/s/events/Second'))
        .then(expectAppended(['s', [{ type: 'Second', data: {} }]]));

      await expect(
        given((request) => request.post('/streams/s/events/First'))
          .when((request) => request.post('/streams/s/events/Second'))
          .then(
            expectAppended([
              's',
              [
                { type: 'First', data: {} },
                { type: 'Second', data: {} },
              ],
            ]),
          ),
      ).rejects.toThrow();
    });

    it('expectNothingAppendedFailsWhenTheWhenStepAppended', async () => {
      const given = appendingApp();

      await given((request) => request.post('/streams/s/events/First'))
        .when((request) => request.get('/streams/s/events/Second'))
        .then(expectNothingAppended());

      await expect(
        given()
          .when((request) => request.post('/streams/s/events/Second'))
          .then(expectNothingAppended()),
      ).rejects.toThrow();
    });
  });

  it('checkingAppendedEventsWithoutAnEventStoreFailsNamingTheOption', async () => {
    const given = ApiE2ESpecification.for({ fetch: () => new Response() });

    await expect(
      given()
        .when((request) => request.get('/'))
        .then(expectNothingAppended()),
    ).rejects.toThrow('needs the getEventStore option');
  });

  describe('catching up', () => {
    it('catchUpRepeatsUntilARoundSendsNothingNew', async () => {
      const published: PublishedMessage[] = [];
      let rounds = 0;
      const given = ApiE2ESpecification.for({
        fetch: () => new Response(),
        sendMessages: () => Promise.resolve(),
        published: () => published,
        catchUp: () => {
          rounds++;
          if (rounds > 1) return Promise.resolve(false);
          published.push({ type: 'SentWhileCatchingUp', data: {} });
          return Promise.resolve(true);
        },
      });

      await given()
        .when(send({ type: 'Any', data: {} }))
        .then(expectPublished({ type: 'SentWhileCatchingUp', data: {} }));

      expect(rounds).toBe(2);
    });

    it('catchUpRunsAfterEveryStep', async () => {
      let rounds = 0;
      const given = ApiE2ESpecification.for({
        fetch: () => new Response(),
        catchUp: () => {
          rounds++;
          return Promise.resolve(false);
        },
      });

      await given(
        (request) => request.get('/first'),
        (request) => request.get('/second'),
      )
        .when((request) => request.get('/third'))
        .then();

      expect(rounds).toBe(3);
    });
  });

  describe('hooks', () => {
    const hooked = (log: string[]) => {
      const app = new Hono();
      app.get('/:step', (c) => {
        log.push(c.req.param('step'));
        return c.body(null, 204);
      });
      return ApiE2ESpecification.for({
        fetch: (r) => app.fetch(r),
        start: () => {
          log.push('start');
          return Promise.resolve();
        },
        stop: () => {
          log.push('stop');
          return Promise.resolve();
        },
      });
    };

    it('hooksStartBeforeTheFirstStepAndStopAfterTheLast', async () => {
      const log: string[] = [];

      await hooked(log)(
        (request) => request.get('/first'),
        (request) => request.get('/second'),
      )
        .when((request) => request.get('/third'))
        .then();

      expect(log).toEqual(['start', 'first', 'second', 'third', 'stop']);
    });

    it('hooksStopAlsoWhenStartFails', async () => {
      const log: string[] = [];
      const given = ApiE2ESpecification.for({
        fetch: () => new Response(),
        start: () => Promise.reject(new Error('Start failed')),
        stop: () => {
          log.push('stop');
          return Promise.resolve();
        },
      });

      await expect(
        given()
          .when((request) => request.get('/first'))
          .then(),
      ).rejects.toThrow('Start failed');

      expect(log).toEqual(['stop']);
    });

    it('hooksStopAlsoWhenAnExpectationFails', async () => {
      const log: string[] = [];

      await expect(
        hooked(log)()
          .when((request) => request.get('/first'))
          .then(expectResponse(500)),
      ).rejects.toThrow();

      expect(log).toEqual(['start', 'first', 'stop']);
    });
  });
});
