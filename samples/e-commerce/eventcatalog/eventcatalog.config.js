import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const spec = (file) => path.join(__dirname, 'specs', file);
const modules = [
  { id: 'shopping-carts', name: 'Shopping carts', spec: 'shopping_carts', web: true },
  { id: 'orders', name: 'Orders', spec: 'orders', web: true },
  { id: 'payments', name: 'Payments', spec: 'payments', web: false },
  { id: 'shipments', name: 'Shipments', spec: 'shipments', web: false },
].map((module) => ({
  ...module,
  domain: { id: module.id, name: module.name, version: '1.0.0' },
}));
const service = (module, kind) => ({
  path: spec(`${kind}-${module.spec}.json`),
  id: `${module.id}-service`,
  name: module.name,
  owners: [module.id],
});

/** @type {import('@eventcatalog/core/bin/eventcatalog.config').Config} */
export default {
  cId: 'b4f6a0f6-8a3c-4e0e-9a43-5f1d3f4d9a11',
  tsd: 1794833529336,
  title: 'E-Commerce',
  tagline: 'The modules of the e-commerce sample, their endpoints and their channels',
  organizationName: 'Event Sourcing in Node.js',
  homepageLink: 'https://event-driven.io/?utm_source=event_sourcing_nodejs',
  repositoryUrl: 'https://github.com/oskardudycz/EventSourcing.NodeJS',
  trailingSlash: false,
  base: '/',
  generators: modules.flatMap((module) => [
    ...(module.web
      ? [['@eventcatalog/generator-openapi', { services: [service(module, 'openapi')], domain: module.domain }]]
      : []),
    ['@eventcatalog/generator-asyncapi', { services: [service(module, 'asyncapi')], domain: module.domain, parseChannels: true }],
  ]),
};
