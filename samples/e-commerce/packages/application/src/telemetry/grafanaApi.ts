import type { Expectation } from '@e-commerce/core';
import type { Page } from 'playwright';
import { expect } from 'vitest';
import { until } from '../testInfrastructure';

const ingestionInMs = 60_000;

type Json = Record<string, unknown>;

const isJson = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const arrayAt = (value: unknown, ...path: string[]): unknown[] => {
  let current = value;

  for (const key of path) current = isJson(current) ? current[key] : undefined;

  return Array.isArray(current) ? current : [];
};

export const grafanaApi = (grafanaUrl: string) => {
  const get = async (path: string): Promise<unknown> => {
    const response = await fetch(`${grafanaUrl}${path}`);

    return response.ok ? response.json() : undefined;
  };

  const proxied = (datasource: string, path: string, query: string) =>
    `/api/datasources/proxy/uid/${datasource}${path}?${query}`;

  const sum = async (promQl: string) =>
    arrayAt(
      await get(
        proxied(
          'prometheus',
          '/api/v1/query',
          new URLSearchParams({ query: promQl }).toString(),
        ),
      ),
      'data',
      'result',
    ).reduce<number>(
      (total, result) =>
        total + Number(arrayAt(result, 'value')[1] ?? Number.NaN),
      0,
    );

  const traceIds = async (traceQl: string) =>
    arrayAt(
      await get(
        proxied(
          'tempo',
          '/api/search',
          new URLSearchParams({ q: traceQl }).toString(),
        ),
      ),
      'traces',
    );

  const logLines = async (logQl: string) =>
    arrayAt(
      await get(
        proxied(
          'loki',
          '/loki/api/v1/query_range',
          new URLSearchParams({ query: logQl }).toString(),
        ),
      ),
      'data',
      'result',
    ).flatMap((stream) => arrayAt(stream, 'values'));

  const eventually = (what: string, check: () => Promise<boolean>) =>
    until(check, ingestionInMs).catch(() => {
      throw new Error(
        `Grafana did not show ${what} within ${ingestionInMs} ms`,
      );
    });

  const expectMetricInPrometheus =
    (promQl: string): Expectation =>
    () =>
      eventually(`a value above zero for ${promQl}`, async () => {
        const value = await sum(promQl);

        return value > 0;
      });

  const openDashboard = async (page: Page, dashboardUid: string) => {
    await page.goto(
      `${grafanaUrl}/d/${dashboardUid}?orgId=1&from=now-15m&to=now&kiosk`,
    );
    await page.waitForLoadState('networkidle');
    await page.locator('canvas').first().waitFor();
  };

  return {
    expectTracesInTempo:
      (traceQl: string): Expectation =>
      () =>
        eventually(`a trace for ${traceQl}`, async () => {
          const found = await traceIds(traceQl);

          return found.length > 0;
        }),
    expectMetricInPrometheus,
    expectEventsAppended: (eventType: string) =>
      expectMetricInPrometheus(
        `sum(emmett_event_appending_count_total{emmett_event_type="${eventType}"})`,
      ),
    expectLogsOf:
      (serviceName: string): Expectation =>
      () =>
        eventually(`log lines of ${serviceName}`, async () => {
          const lines = await logLines(`{service_name="${serviceName}"}`);

          return lines.length > 0;
        }),
    expectAlertRules:
      (...titles: string[]): Expectation =>
      async () => {
        const provisioned = arrayAt(
          { rules: await get('/api/v1/provisioning/alert-rules') },
          'rules',
        ).map((rule) => (isJson(rule) ? rule['title'] : undefined));

        for (const title of titles) expect(provisioned).toContain(title);
      },
    screenshotOf: async (page: Page, dashboardUid: string, file: string) => {
      await page.setViewportSize({ width: 1400, height: 1700 });
      await openDashboard(page, dashboardUid);
      await page.screenshot({ path: file });
    },
    screenshotOfRow: async (
      page: Page,
      dashboardUid: string,
      rowTitle: string,
      aPanel: string,
      file: string,
    ) => {
      await page.setViewportSize({ width: 1400, height: 900 });
      await openDashboard(page, dashboardUid);
      const row = page.getByText(rowTitle, { exact: true }).first();
      await row.waitFor();
      const box = await row.boundingBox();
      await page.mouse.move(700, 450);
      await page.mouse.wheel(0, (box?.y ?? 0) - 60);
      await page.waitForTimeout(1000);
      await page.getByText(aPanel).first().waitFor();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: file });
    },
    screenshotOfAlertRules: async (
      page: Page,
      folder: string,
      aRule: string,
      file: string,
    ) => {
      await page.setViewportSize({ width: 1400, height: 980 });
      await page.goto(
        `${grafanaUrl}/alerting/list?view=list&search=namespace:${folder}`,
      );
      await page.getByText(aRule).first().waitFor();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: file });
    },
  };
};
