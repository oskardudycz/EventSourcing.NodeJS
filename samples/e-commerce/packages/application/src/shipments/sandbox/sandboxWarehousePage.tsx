import { NotFoundError } from '@event-driven-io/emmett';
import type { WebApiSetup } from '@event-driven-io/emmett-honojs';
import { raw } from 'hono/html';
import { demoProductName, demoProducts } from '../../shop/demoProducts';
import { ShipmentId } from '../shipment';
import type { SandboxPackage, SandboxWarehouse } from './sandboxWarehouse';

const packageRow = ({ shipmentId, productItems }: SandboxPackage) => {
  const tail = ShipmentId.tailOf(shipmentId);

  return {
    tail,
    order: `Order #${ShipmentId.numberOf(shipmentId)} of customer ${tail.slice(0, 8)}`,
    products: productItems
      .map(
        ({ quantity, productId }) =>
          `${quantity} × ${demoProductName(productId)}`,
      )
      .join(', '),
  };
};

const WarehousePage = ({ warehouse }: { warehouse: SandboxWarehouse }) => {
  const packages = warehouse.packages();

  return (
    <>
      {raw('<!DOCTYPE html>')}
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Warehouse · Sandbox</title>
          <link rel="stylesheet" href="/css/shop.css" />
        </head>
        <body>
          <header class="topbar">
            <span class="brand">
              Warehouse <span class="badge sandbox">Sandbox</span>
            </span>
          </header>
          <main class="page">
            <h1>Stock</h1>
            <p class="muted">
              A product out of stock makes the next reservation of it fail: the
              order shows "Out of stock", and the customer can only cancel it.
            </p>
            <section class="card">
              <table class="lines">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Stock</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {demoProducts.map((product) => {
                    const inStock = warehouse.isInStock(product.id);

                    return (
                      <tr>
                        <td>{product.name}</td>
                        <td>
                          <span
                            class={`badge ${inStock ? 'Completed' : 'PaymentFailed'}`}
                          >
                            {inStock ? 'In stock' : 'Out of stock'}
                          </span>
                        </td>
                        <td class="number">
                          <form
                            method="post"
                            action={`/sandbox/warehouse/products/${product.id}/stock`}
                          >
                            <input
                              type="hidden"
                              name="inStock"
                              value={String(!inStock)}
                            />
                            <button class="button" type="submit">
                              {inStock ? 'Mark out of stock' : 'Restock'}
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            <h1>Packages</h1>
            <p class="muted">
              The shop asks the warehouse to send a package once the customer
              paid. The customer is charged when you send it.
            </p>
            {packages.length === 0 ? (
              <section class="card empty">
                <p>No packages yet. Pay for an order in the shop.</p>
              </section>
            ) : (
              <section class="card">
                <table class="lines">
                  <thead>
                    <tr>
                      <th>Shipment</th>
                      <th>Products</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((pack) => {
                      const row = packageRow(pack);

                      return (
                        <tr>
                          <td title={row.tail}>{row.order}</td>
                          <td>{row.products}</td>
                          <td>
                            <span class="badge">{pack.status}</span>
                          </td>
                          <td class="number actions">
                            {pack.status === 'Waiting' && (
                              <>
                                <form
                                  method="post"
                                  action={`/sandbox/warehouse/shipments/${row.tail}/send`}
                                >
                                  <button class="button primary" type="submit">
                                    Send
                                  </button>
                                </form>
                                <form
                                  method="post"
                                  action={`/sandbox/warehouse/shipments/${row.tail}/reject`}
                                >
                                  <button class="button" type="submit">
                                    Reject
                                  </button>
                                </form>
                              </>
                            )}
                            {pack.status === 'Sent' && (
                              <form
                                method="post"
                                action={`/sandbox/warehouse/shipments/${row.tail}/deliver`}
                              >
                                <button class="button" type="submit">
                                  Deliver
                                </button>
                              </form>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            )}
          </main>
        </body>
      </html>
    </>
  );
};

export const sandboxWarehousePage =
  (warehouse: SandboxWarehouse): WebApiSetup =>
  (router) => {
    const shipmentIdOf = (shipmentTail: string) => {
      const shipmentId = ShipmentId.of(shipmentTail);

      if (!warehouse.find(shipmentId))
        throw new NotFoundError({ type: 'Shipment', id: shipmentTail });

      return shipmentId;
    };

    router.get('/sandbox/warehouse', (context) =>
      context.html(<WarehousePage warehouse={warehouse} />),
    );

    router.post(
      '/sandbox/warehouse/products/:productId/stock',
      async (context) => {
        const body = await context.req.parseBody();

        warehouse.stock(
          context.req.param('productId'),
          body['inStock'] === 'true',
        );

        return context.redirect('/sandbox/warehouse', 303);
      },
    );

    router.post(
      '/sandbox/warehouse/shipments/:shipmentTail/send',
      async (context) => {
        await warehouse.send(shipmentIdOf(context.req.param('shipmentTail')));

        return context.redirect('/sandbox/warehouse', 303);
      },
    );

    router.post(
      '/sandbox/warehouse/shipments/:shipmentTail/reject',
      async (context) => {
        await warehouse.reject(shipmentIdOf(context.req.param('shipmentTail')));

        return context.redirect('/sandbox/warehouse', 303);
      },
    );

    router.post(
      '/sandbox/warehouse/shipments/:shipmentTail/deliver',
      async (context) => {
        await warehouse.deliver(
          shipmentIdOf(context.req.param('shipmentTail')),
        );

        return context.redirect('/sandbox/warehouse', 303);
      },
    );
  };
