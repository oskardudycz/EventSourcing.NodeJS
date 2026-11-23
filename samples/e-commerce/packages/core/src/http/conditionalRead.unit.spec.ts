import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { newerThan } from './conditionalRead';

const appReading = (versions: () => number | undefined) => {
  const app = new Hono();
  app.get('/doc', (c) =>
    newerThan(
      c,
      () => {
        const version = versions();
        return Promise.resolve(version === undefined ? null : { version });
      },
      {
        whenMissing: () => new Error('missing'),
        deadlineInMs: 300,
      },
    ),
  );
  return app;
};

describe('newerThan', () => {
  it('answersWithTheDocumentAndItsETagWithoutIfNoneMatch', async () => {
    const response = await appReading(() => 3).request('/doc');

    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('W/"3"');
    expect(await response.json()).toEqual({ version: 3 });
  });

  it('waitsForANewerVersionThanTheOneTheClientSaw', async () => {
    const startedAt = Date.now();
    const app = appReading(() => (Date.now() - startedAt > 150 ? 2 : 1));

    const response = await app.request('/doc', {
      headers: { 'If-None-Match': 'W/"1"' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('W/"2"');
  });

  it('answersNotModifiedAfterTheDeadlineWhenNothingNewerArrives', async () => {
    const startedAt = Date.now();

    const response = await appReading(() => 1).request('/doc', {
      headers: { 'If-None-Match': 'W/"1"' },
    });

    expect(response.status).toBe(304);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(290);
  });

  it('failsWithTheGivenErrorWhenTheDocumentNeverAppears', async () => {
    const response = await appReading(() => undefined).request('/doc');

    expect(response.status).toBe(500);
  });
});
