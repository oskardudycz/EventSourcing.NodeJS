import { describe, expect, it } from 'vitest';
import { retryIfNotFound } from './longPolling';

describe('retryIfNotFound', () => {
  it('findsADocumentThatAppearsDuringTheWait', async () => {
    const appearsAt = Date.now() + 300;

    const found = await retryIfNotFound(
      () => Promise.resolve(Date.now() >= appearsAt ? { id: 'order' } : null),
      1000,
    );

    expect(found).toEqual({ id: 'order' });
  });

  it('givesUpWhenTheDocumentNeverAppears', async () => {
    const found = await retryIfNotFound(() => Promise.resolve(null), 300);

    expect(found).toBeNull();
  });
});
