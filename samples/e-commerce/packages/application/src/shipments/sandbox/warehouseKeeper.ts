import type { Page } from 'playwright';
import type { BrowserE2ESpecification } from '../../browserE2ESpecification';

type PackageOwner = { shipmentTail: string };

const waitsForThePackageUpToInMs = 30_000;

export const warehouseKeeper = (
  shop: Pick<BrowserE2ESpecification, 'inAnotherTab' | 'screenshotOf'>,
) => {
  const packageOf = async (tab: Page, { shipmentTail }: PackageOwner) => {
    const row = tab.locator(`tr:has(td[title='${shipmentTail}'])`);
    const giveUpAt = Date.now() + waitsForThePackageUpToInMs;

    await tab.goto('/sandbox/warehouse');
    while ((await row.count()) === 0 && Date.now() < giveUpAt) {
      await tab.waitForTimeout(250);
      await tab.reload();
    }

    return row;
  };

  const press = async (tab: Page, owner: PackageOwner, button: string) => {
    const row = await packageOf(tab, owner);

    await row.getByRole('button', { name: button }).click();
    await tab.waitForURL(/\/sandbox\/warehouse$/);
  };

  return {
    sendsThePackageOf: (owner: PackageOwner, screenshotBefore?: string) =>
      shop.inAnotherTab(async (tab) => {
        if (screenshotBefore) {
          await (await packageOf(tab, owner)).waitFor();
          await shop.screenshotOf(tab, screenshotBefore);
        }
        await press(tab, owner, 'Send');
      }),
    rejectsThePackageOf: (owner: PackageOwner) =>
      shop.inAnotherTab((tab) => press(tab, owner, 'Reject')),
  };
};
