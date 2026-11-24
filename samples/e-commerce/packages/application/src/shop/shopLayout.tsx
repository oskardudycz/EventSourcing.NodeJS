import { raw } from 'hono/html';
import type { Child, FC } from 'hono/jsx';

export type ShopLinks = { grafanaUrl: string; eventCatalogUrl: string };

export const defaultShopLinks: ShopLinks = {
  grafanaUrl: 'http://localhost:3000',
  eventCatalogUrl: 'http://localhost:3001',
};

export const formatPrice = (amount: number): string =>
  `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export type ShopSection = 'products' | 'cart' | 'orders';

type Visitor = {
  links: ShopLinks;
  customerId?: string | undefined;
  customerName?: string | undefined;
  current?: ShopSection | undefined;
};

export const ShopHeader: FC<Visitor> = ({
  links,
  customerId,
  customerName,
  current,
}) => (
  <header class="topbar">
    <a
      class="brand"
      href={customerId ? `/shop/customers/${customerId}/products` : '/shop'}
    >
      Demo Shop
    </a>
    <nav>
      {customerId && (
        <>
          <a
            href={`/shop/customers/${customerId}/products`}
            class={current === 'products' ? 'active' : undefined}
          >
            Products
          </a>
          <a
            href={`/shop/customers/${customerId}/cart`}
            class={current === 'cart' ? 'active' : undefined}
          >
            Cart
          </a>
          <a
            href={`/shop/customers/${customerId}/orders`}
            class={current === 'orders' ? 'active' : undefined}
          >
            Orders
          </a>
        </>
      )}
      <details class="menu">
        <summary>Developer tools</summary>
        <div class="menu-items">
          <a href={links.grafanaUrl} target="_blank" rel="noopener">
            Grafana: traces, metrics, logs
          </a>
          <a href={links.eventCatalogUrl} target="_blank" rel="noopener">
            EventCatalog: modules and messages
          </a>
          <a href="/sandbox/warehouse" target="_blank" rel="noopener">
            Sandbox warehouse: stock and packages
          </a>
        </div>
      </details>
      {customerName ? (
        <>
          <span class="customer">{customerName}</span>
          <form class="logout" method="post" action="/shop/logout">
            <button class="link" type="submit">
              Log out
            </button>
          </form>
        </>
      ) : (
        <a href="/shop/login">Log in</a>
      )}
    </nav>
  </header>
);

export const ShopPage: FC<
  Visitor & {
    title: string;
    refreshWithoutScript?: boolean;
    children?: Child;
  }
> = ({ title, refreshWithoutScript, children, ...visitor }) => (
  <>
    {raw('<!DOCTYPE html>')}
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {refreshWithoutScript && (
          <noscript>
            <meta http-equiv="refresh" content="1" />
          </noscript>
        )}
        <title>{title} · Demo Shop</title>
        <link rel="stylesheet" href="/css/shop.css" />
        <script src="/assets/htmx.min.js" defer></script>
      </head>
      <body>
        <ShopHeader {...visitor} />
        {children}
      </body>
    </html>
  </>
);
