import type { WebApiSetup } from '@event-driven-io/emmett-honojs';
import { NotFoundError } from '@event-driven-io/emmett';
import { raw } from 'hono/html';
import { formField } from '../../shop/formFields';
import { formatPrice } from '../../shop/shopLayout';
import { checkoutStyles } from './checkoutStyles';
import type {
  SandboxCheckout,
  SandboxPaymentGateway,
} from './sandboxPaymentGateway';

const CheckoutPage = ({
  checkout,
  expired,
  error,
}: {
  checkout: SandboxCheckout;
  expired: boolean;
  error?: string;
}) => (
  <>
    {raw('<!DOCTYPE html>')}
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Checkout · Sandbox</title>
        <link rel="stylesheet" href="/css/checkout.css" />
      </head>
      <body>
        <div class="checkout">
          <section class="summary">
            <a class="back" href={checkout.cancelUrl}>
              &larr; Back to Demo Shop
            </a>
            <p class="merchant">
              Demo Shop <span class="sandbox">Sandbox</span>
            </p>
            <p class="label">Pay Demo Shop</p>
            <p class="amount">{formatPrice(checkout.amount)}</p>
          </section>
          <section class="payment">
            {expired ? (
              <div class="expired">
                <h1>This checkout session has expired</h1>
                <p>Go back to the shop and choose "Pay now" again.</p>
                <a class="button" href={checkout.cancelUrl}>
                  Back to Demo Shop
                </a>
              </div>
            ) : (
              <form method="post" action={`/sandbox/checkout/${checkout.id}`}>
                <h1>Pay with card</h1>
                <label for="cardNumber">Card information</label>
                <div class="card-fields">
                  <input
                    id="cardNumber"
                    name="cardNumber"
                    inputmode="numeric"
                    autocomplete="off"
                    list="test-cards"
                    placeholder="1234 1234 1234 1234"
                    required
                  />
                  <datalist id="test-cards">
                    <option value="4242 4242 4242 4242">Pays</option>
                    <option value="4000 0000 0000 0002">Is declined</option>
                  </datalist>
                  <div class="row">
                    <input
                      aria-label="Expiration"
                      placeholder="MM / YY"
                      autocomplete="cc-exp"
                    />
                    <input
                      aria-label="CVC"
                      placeholder="CVC"
                      autocomplete="cc-csc"
                    />
                  </div>
                </div>
                <label for="name">Cardholder name</label>
                <input
                  id="name"
                  placeholder="Full name on card"
                  autocomplete="cc-name"
                />
                {error && <p class="error">{error}</p>}
                <button class="pay" type="submit">
                  Pay {formatPrice(checkout.amount)}
                </button>
                <p class="hint">
                  Sandbox: pick a test card in the card number field. 4242 4242
                  4242 4242 pays, 4000 0000 0000 0002 is declined.
                </p>
              </form>
            )}
          </section>
        </div>
      </body>
    </html>
  </>
);

export const sandboxCheckoutPage =
  (gateway: SandboxPaymentGateway): WebApiSetup =>
  (router) => {
    const checkoutOf = (sessionId: string) => {
      const checkout = gateway.checkout(sessionId);

      if (!checkout)
        throw new NotFoundError({ type: 'Checkout', id: sessionId });

      return checkout;
    };

    router.get('/css/checkout.css', (context) =>
      context.body(checkoutStyles, 200, { 'content-type': 'text/css' }),
    );

    router.get('/sandbox/checkout/:sessionId', (context) => {
      const checkout = checkoutOf(context.req.param('sessionId'));

      return context.html(
        <CheckoutPage checkout={checkout} expired={checkout.expired} />,
      );
    });

    router.post('/sandbox/checkout/:sessionId', async (context) => {
      const checkout = checkoutOf(context.req.param('sessionId'));
      const body = await context.req.parseBody();
      const outcome = await gateway.pay(
        checkout,
        formField(body, 'cardNumber'),
      );

      switch (outcome) {
        case 'Paid':
          return context.redirect(checkout.successUrl, 303);
        case 'Declined':
          return context.html(
            <CheckoutPage
              checkout={checkout}
              expired={false}
              error="Your card was declined."
            />,
          );
        case 'UnknownCard':
          return context.html(
            <CheckoutPage
              checkout={checkout}
              expired={false}
              error="Use a test card: 4242 4242 4242 4242 pays, 4000 0000 0000 0002 is declined."
            />,
          );
        case 'Expired':
          return context.html(<CheckoutPage checkout={checkout} expired />);
      }
    });
  };
