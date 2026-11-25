import type { Page } from 'playwright';
import { OrderId } from '../orders/order';
import { ShoppingCartId } from '../shoppingCarts/shoppingCart';
import type { BrowserE2ESpecification } from '../browserE2ESpecification';
import { customerIdOf } from './customer';
import { orderPageOf, productsPageOf } from './shopUrls';

const button = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name });

export const customerInBrowser = (
  shop: Pick<
    BrowserE2ESpecification,
    'inBrowser' | 'inAnotherTab' | 'untilThePageShows'
  >,
  name = `Marty ${crypto.randomUUID().slice(0, 8)}`,
) => {
  const customerId = customerIdOf(name);
  const orderNumber = OrderId.numberOf(
    OrderId.derivedFrom(ShoppingCartId.of(customerId, 1)),
  );
  const orderPage = orderPageOf(customerId, orderNumber);

  const typesTheirName = async (page: Page) => {
    await page.goto('/shop');
    await page.getByLabel('Your name').fill(name);
  };
  const pressesLogIn = async (page: Page) => {
    await button(page, 'Log in').click();
    await page.waitForURL(`**${productsPageOf(customerId)}`);
  };
  const typesTheTestCard = (page: Page) =>
    page.locator('#cardNumber').fill('4242 4242 4242 4242');
  const pays = async (page: Page) => {
    await button(page, /^Pay \$/).click();
    await page.waitForURL(`**${orderPage}`);
  };

  return {
    name,
    shipmentTail: `${customerId}-1`,
    customerId,
    orderPage,
    logsIn: () =>
      shop.inBrowser(async (page) => {
        await typesTheirName(page);
        await pressesLogIn(page);
      }),
    typesTheirName: () => shop.inBrowser(typesTheirName),
    pressesLogIn: () => shop.inBrowser(pressesLogIn),
    addsToCart: (product: number) =>
      shop.inBrowser(async (page) => {
        await page.goto(productsPageOf(customerId));
        await button(page, 'Add to cart').nth(product).click();
        await page.waitForURL(/\/cart/);
      }),
    checksOut: () =>
      shop.inBrowser(async (page) => {
        await button(page, 'Check out').click();
        await page.waitForURL(`**${orderPage}`);
      }),
    paysNow: () =>
      shop.inBrowser(async (page) => {
        await button(page, 'Pay now').click();
        await page.waitForURL(/\/sandbox\/checkout\//);
      }),
    paysWithACardThatWorks: () =>
      shop.inBrowser(async (page) => {
        await typesTheTestCard(page);
        await pays(page);
      }),
    typesTheTestCard: () => shop.inBrowser(typesTheTestCard),
    pays: () => shop.inBrowser(pays),
    triesADeclinedCard: () =>
      shop.inBrowser(async (page) => {
        await page.locator('#cardNumber').fill('4000 0000 0000 0002');
        await button(page, /^Pay \$/).click();
      }),
    waitsUntilTheOrderIs: (progress: string) =>
      shop.untilThePageShows(progress),
    opensOrders: () =>
      shop.inBrowser(async (page) => {
        await page.getByRole('link', { name: 'Orders', exact: true }).click();
        await page.waitForURL(/\/orders$/);
      }),
    cancels: () =>
      shop.inBrowser(async (page) => {
        await button(page, 'Cancel order').click();
      }),
    cancelsInAnotherTab: () =>
      shop.inAnotherTab(async (tab) => {
        await tab.goto(orderPage);
        await button(tab, 'Cancel order').click();
        await tab.getByText('Canceled').first().waitFor();
      }),
  };
};
