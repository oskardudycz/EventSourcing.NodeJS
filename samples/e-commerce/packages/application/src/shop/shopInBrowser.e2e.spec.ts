import { describe, it } from 'vitest';
import { browserE2ESpecification } from '../browserE2ESpecification';
import { warehouseKeeper } from '../shipments/sandbox/warehouseKeeper';
import { shopTestApplication } from '../shopTestApplication';
import { customerInBrowser } from './customerInBrowser';
import { ordersPageOf } from './shopUrls';

const shop = browserE2ESpecification(shopTestApplication());

const shopInBrowser = () => {
  return {
    ...shop,
    marty: customerInBrowser(shop, 'Marty McFly'),
    warehouse: warehouseKeeper(shop),
  };
};

describe('the tour of the shop and the developer pages that HOWTO.md shows', () => {
  it('aCustomerLogsInBuysTwoProductsAndPaysOnTheSandboxPage', () => {
    const {
      given,
      marty,
      warehouse,
      screenshot,
      expectPageAt,
      expectPageShowing,
      expectNoFailedResponses,
      expectScreenshot,
    } = shopInBrowser();

    return given(
      marty.typesTheirName(),
      screenshot('1-login'),
      marty.pressesLogIn(),
      screenshot('2-products'),
      marty.addsToCart(0),
      marty.addsToCart(1),
      screenshot('3-cart'),
      marty.checksOut(),
      screenshot('4-order-awaiting-payment'),
      marty.paysNow(),
      marty.typesTheTestCard(),
      screenshot('5-sandbox-checkout'),
      marty.pays(),
      warehouse.sendsThePackageOf(marty, '6-sandbox-warehouse'),
      marty.waitsUntilTheOrderIs('Completed'),
      screenshot('6-order-completed'),
    )
      .when(marty.opensOrders())
      .then(
        expectPageAt(new RegExp(`${ordersPageOf(marty.customerId)}$`)),
        expectPageShowing('Marty McFly', 'Completed'),
        expectNoFailedResponses,
        expectScreenshot('7-orders'),
      );
  });

  it('swaggerUiShowsTheWebApiOfEachModule', () => {
    const { given, opens, expectPageShowing, expectScreenshot } =
      shopInBrowser();

    return given()
      .when(opens('/swagger'))
      .then(
        expectPageShowing('/customers/{customerId}/orders'),
        expectScreenshot('8-swagger-ui'),
      );
  });

  it('asyncApiShowsTheChannelsAndCanPublish', () => {
    const {
      given,
      opens,
      expectPageShowing,
      expectPageNotShowing,
      expectScreenshot,
    } = shopInBrowser();

    return given()
      .when(opens('/asyncapi'))
      .then(
        expectPageShowing('Publish a message', 'Channels'),
        expectPageNotShowing('Auto-generated description'),
        expectScreenshot('9-asyncapi-ui'),
      );
  });
});
