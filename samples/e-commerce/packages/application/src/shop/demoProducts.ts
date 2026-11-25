export type DemoProduct = { id: string; name: string; description: string };

export const trailRunningShoes: DemoProduct = {
  id: '6f1d3a52-0c5e-4b8a-9d61-1f3c2a7e9b01',
  name: 'Trail running shoes',
  description: 'Light shoes with a grippy sole for wet trails.',
};

export const merinoTShirt: DemoProduct = {
  id: '6f1d3a52-0c5e-4b8a-9d61-1f3c2a7e9b02',
  name: 'Merino T-shirt',
  description: 'Soft wool that stays fresh on long days.',
};

export const rainJacket: DemoProduct = {
  id: '6f1d3a52-0c5e-4b8a-9d61-1f3c2a7e9b03',
  name: 'Rain jacket',
  description: 'Waterproof shell that packs into its own pocket.',
};

export const hikingSocks: DemoProduct = {
  id: '6f1d3a52-0c5e-4b8a-9d61-1f3c2a7e9b04',
  name: 'Hiking socks',
  description: 'Cushioned socks, two pairs.',
};

export const soldOutDemoProduct: DemoProduct = {
  id: '6f1d3a52-0c5e-4b8a-9d61-1f3c2a7e9b05',
  name: 'Limited edition trail shoes',
  description:
    'Sold out at the warehouse: buy them to see an order canceled for lack of stock.',
};

export const demoProducts: readonly DemoProduct[] = [
  trailRunningShoes,
  merinoTShirt,
  rainJacket,
  hikingSocks,
  soldOutDemoProduct,
];

export const demoProductName = (productId: string): string =>
  demoProducts.find(({ id }) => id === productId)?.name ?? productId;
