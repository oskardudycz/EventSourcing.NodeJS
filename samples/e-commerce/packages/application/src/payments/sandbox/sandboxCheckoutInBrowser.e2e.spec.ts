import { describe, expect, it } from 'vitest';
import { browserE2ESpecification } from '../../browserE2ESpecification';
import { customerInBrowser } from '../../shop/customerInBrowser';
import { shopTestApplication } from '../../shopTestApplication';

const shop = browserE2ESpecification(shopTestApplication());

const sandboxCheckout = () => {
  const customer = customerInBrowser(shop);

  return {
    ...shop,
    customer,
    orderAwaitingPayment: [
      customer.logsIn(),
      customer.addsToCart(0),
      customer.checksOut(),
    ],
  };
};

describe('the sandbox payment page, as a customer reaches it with "Pay now"', () => {
  it('payNowOpensThePaymentPageWithTheCardFormAndTheWayBack', () => {
    const {
      given,
      customer,
      orderAwaitingPayment,
      expectPageAt,
      expectPageShowing,
      expectNoFailedResponses,
    } = sandboxCheckout();

    return given(...orderAwaitingPayment)
      .when(customer.paysNow())
      .then(
        expectPageAt(/\/sandbox\/checkout\/.+/),
        expectPageShowing('Pay with card', 'Back to Demo Shop'),
        expectNoFailedResponses,
      );
  });

  it('theCardNumberFieldSuggestsTheTestCardsAndWhatEachDoes', () => {
    const { given, customer, orderAwaitingPayment, expectPage } =
      sandboxCheckout();

    return given(...orderAwaitingPayment)
      .when(customer.paysNow())
      .then(
        expectPage(async (page) => {
          const testCards = page.locator('#test-cards option');

          expect(await testCards.count()).toBe(2);
          expect(await testCards.nth(0).getAttribute('value')).toBe(
            '4242 4242 4242 4242',
          );
          expect(await testCards.nth(1).getAttribute('value')).toBe(
            '4000 0000 0000 0002',
          );
        }),
      );
  });

  it('aDeclinedCardStaysOnThePageSoTheCustomerCanTryAgain', () => {
    const {
      given,
      customer,
      orderAwaitingPayment,
      expectPageAt,
      expectPageShowing,
    } = sandboxCheckout();

    return given(...orderAwaitingPayment, customer.paysNow())
      .when(customer.triesADeclinedCard())
      .then(
        expectPageAt(/\/sandbox\/checkout\/.+/),
        expectPageShowing('Your card was declined.', 'Pay with card'),
      );
  });
});
