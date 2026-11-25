export const allModules = [
  'shopping_carts',
  'orders',
  'payments',
  'shipments',
] as const;

export type ModuleName = (typeof allModules)[number];
