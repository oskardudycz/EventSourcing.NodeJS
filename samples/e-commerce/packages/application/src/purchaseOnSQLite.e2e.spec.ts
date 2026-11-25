import { describe } from 'vitest';
import { purchaseScenarios } from './purchaseScenarios';
import { sqliteWithoutABroker } from './shopTestApplication';

describe('purchases on SQLite without a broker', () => {
  purchaseScenarios(() =>
    Promise.resolve({
      environment: sqliteWithoutABroker,
      stop: () => Promise.resolve(),
    }),
  );
});
