import { serve } from '@hono/node-server';
import {
  action,
  ApiE2ESpecification,
  type Expectation,
  type TestStep,
} from '@e-commerce/core';
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright';
import { afterAll, expect } from 'vitest';
import type { ShopTestApplication } from './shopTestApplication';

const stayedOnPage = 'stayedOnPage';
const screenshotsFolder =
  process.env['SCREENSHOTS_DIR'] ?? 'test-results/screenshots';
const waitsUpToInMs = 15_000;

type Launched = {
  baseUrl: string;
  browser: Browser;
  closeServer: () => Promise<void>;
};

type Running = { baseUrl: string; context: BrowserContext; page: Page };

export const browserE2ESpecification = ({
  specification,
}: Pick<ShopTestApplication, 'specification'>) => {
  const browserErrors: string[] = [];
  const failedResponses: string[] = [];
  let running: Running | undefined;

  const runningShop = (): Running => {
    if (!running) throw new Error('The browser is not started');

    return running;
  };

  const watch = (page: Page, baseUrl: string) => {
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400 && response.url().startsWith(baseUrl))
        failedResponses.push(`${response.status()} ${response.url()}`);
    });
  };

  const launch = async (): Promise<Launched> => {
    const server = serve({ fetch: specification.fetch, port: 0 });

    await new Promise((resolve) => server.once('listening', resolve));

    const address = server.address();

    if (address === null || typeof address === 'string')
      throw new Error('The shop did not start on a port');

    return {
      baseUrl: `http://localhost:${address.port}`,
      browser: await chromium.launch(),
      closeServer: () =>
        new Promise((resolve) => void server.close(() => resolve())),
    };
  };

  let launched: Promise<Launched> | undefined;

  afterAll(async () => {
    const shop = await launched;

    await shop?.browser.close();
    await shop?.closeServer();
  });

  const start = async () => {
    await specification.start();

    const { baseUrl, browser } = await (launched ??= launch());
    const context = await browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 1280, height: 900 },
    });

    browserErrors.length = 0;
    failedResponses.length = 0;
    context.on('page', (page) => watch(page, baseUrl));

    running = { baseUrl, context, page: await context.newPage() };
  };

  const stop = async () => {
    await running?.context.close();
    running = undefined;
    await specification.stop();
  };

  const expectNoBrowserErrors: Expectation = () =>
    expect(browserErrors, 'Errors the browser reported').toEqual([]);

  const base = ApiE2ESpecification.for({ ...specification, start, stop });

  const given: ApiE2ESpecification = (...givenSteps) => ({
    when: (step) => ({
      then: (...expectations) =>
        base(...givenSteps)
          .when(step)
          .then(...expectations, expectNoBrowserErrors),
    }),
  });

  const inBrowser = (run: (page: Page) => Promise<void>): TestStep =>
    action(async () => {
      const { page } = runningShop();

      await run(page);
      await page.evaluate((marker) => {
        Object.assign(globalThis, { [marker]: true });
      }, stayedOnPage);
    });

  const inAnotherTab = (run: (tab: Page) => Promise<void>): TestStep =>
    action(async () => {
      const tab = await runningShop().page.context().newPage();

      try {
        await run(tab);
      } finally {
        await tab.close();
      }
    });

  const untilThePageShows = (text: string): TestStep =>
    action(async () => {
      await runningShop()
        .page.getByText(text)
        .first()
        .waitFor({ timeout: waitsUpToInMs });
    });

  const opens = (path: string): TestStep =>
    inBrowser(async (page) => {
      await page.goto(path);
    });

  const expectPage =
    (check: (page: Page) => Promise<void>): Expectation =>
    () =>
      check(runningShop().page);

  const expectPageShowing = (...texts: string[]): Expectation =>
    expectPage(async (page) => {
      for (const text of texts)
        await page.getByText(text).first().waitFor({ timeout: 5_000 });
    });

  const expectPageNotShowing = (...texts: string[]): Expectation =>
    expectPage(async (page) => {
      for (const text of texts)
        expect(await page.getByText(text).count()).toBe(0);
    });

  const expectPageAt = (path: RegExp): Expectation =>
    expectPage(async (page) => {
      await page.waitForURL(path, { timeout: 5_000 });
    });

  const screenshotOf = async (tab: Page, name: string) => {
    await tab.screenshot({
      path: `${screenshotsFolder}/${name}.png`,
      fullPage: true,
    });
  };

  const screenshot = (name: string): TestStep =>
    action(() => screenshotOf(runningShop().page, name));

  const expectScreenshot =
    (name: string): Expectation =>
    () =>
      screenshotOf(runningShop().page, name);

  const expectNoFailedResponses: Expectation = () =>
    expect(failedResponses, 'Responses with an error status').toEqual([]);

  const expectUpdatedInPlace: Expectation = expectPage(async (page) => {
    expect(
      await page.evaluate((marker) => marker in globalThis, stayedOnPage),
      'The page was reloaded',
    ).toBe(true);
  });

  return {
    given,
    baseUrl: () => runningShop().baseUrl,
    inBrowser,
    inAnotherTab,
    untilThePageShows,
    opens,
    expectPage,
    expectPageShowing,
    expectPageNotShowing,
    expectPageAt,
    expectNoFailedResponses,
    expectUpdatedInPlace,
    screenshotOf,
    screenshot,
    expectScreenshot,
  };
};

export type BrowserE2ESpecification = ReturnType<
  typeof browserE2ESpecification
>;
