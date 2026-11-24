import { paymentProvider } from './payments/paymentProvider';
import { warehouse } from './shipments/warehouse';
import { it } from 'vitest';
import { shopTestApplication, inMemoryBusOnSQLite } from './shopTestApplication';
import { shopRequests } from './shop/shopRequests';
import { customerIdOf } from './shop/customer';
import { demoProducts } from './shop/demoProducts';

it.each([['none', undefined], ['in-memory', inMemoryBusOnSQLite]])('debug %s', async (_n, environment) => {
  const app = shopTestApplication({ ...(environment ? { environment } : {}), gateways: { paymentGateway: paymentProvider(), warehouse: warehouse() } });
  const r = shopRequests(app.fetch);
  const name = 'Zed ' + _n;
  const id = customerIdOf(name);
  const t = Date.now();
  await app.given(
    r.postForm(`/shop/customers/${id}/cart/items`, { productId: demoProducts[0]!.id, quantity: '1' }, { as: name }),
  ).when(r.postForm(`/shop/customers/${id}/cart/checkout`, { version: '1' }, { as: name })).then(() => { console.log('done', Date.now() - t); });
}, 60000);
