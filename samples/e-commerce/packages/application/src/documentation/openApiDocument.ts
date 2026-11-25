import { OpenAPIHono } from '@hono/zod-openapi';
import { ordersTag } from '../orders/ordersApi';
import { shoppingCartsTag } from '../shoppingCarts/shoppingCartsApi';

export type OpenApiModules = {
  shopping_carts: OpenAPIHono;
  orders: OpenAPIHono;
};

export type OpenApiModuleName = keyof OpenApiModules;

const tagOf: Record<OpenApiModuleName, string> = {
  shopping_carts: shoppingCartsTag,
  orders: ordersTag,
};

export const openApiModuleNames: readonly OpenApiModuleName[] = [
  'shopping_carts',
  'orders',
];

export const openApiDocument = (
  modules: OpenApiModules,
  module?: OpenApiModuleName,
) => {
  const selected = module ? [module] : openApiModuleNames;
  const registry = new OpenAPIHono();

  for (const name of selected) registry.route('/', modules[name]);

  return registry.getOpenAPI31Document({
    openapi: '3.1.0',
    info: {
      title: 'E-commerce',
      version: '1.0.0',
      description: 'Shopping carts and orders of the e-commerce sample.',
    },
    tags: selected.map((name) => ({ name: tagOf[name] })),
  });
};
